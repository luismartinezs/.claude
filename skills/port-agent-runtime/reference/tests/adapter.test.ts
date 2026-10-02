import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createAgentProcessAdapter } from '../runtime/process-adapter.ts';
import type { AgentProcessExecution } from '../runtime/process.ts';

// The isolation invariants, proved against REAL subprocesses rather than a mocked spawn. A mock can
// only show that the adapter passed an option; these show that the option had the effect claimed.
//
// POSIX only (pwd, printenv, sh, sleep). On a target that must also run on Windows, replace each
// command with its `node -e` equivalent; the assertions are unchanged.

const isolated = (overrides: Partial<AgentProcessExecution> = {}): AgentProcessExecution => ({
  workingDirectory: 'isolated-temporary-directory',
  environment: 'authentication-only',
  responseSchemaPath: 'response.schema.json',
  responseSchema: { type: 'object' },
  images: [],
  ...overrides,
});

const adapter = createAgentProcessAdapter();

describe('the working directory', () => {
  it('is a temporary directory, not the repository', async () => {
    // Pins invariant 1. A CLI that decides to write a file must not write it into the project.
    const result = await adapter.run('pwd', [], '', undefined, isolated());
    const directory = result.stdout.trim();
    expect(result.exitCode).toBe(0);
    expect(directory).not.toBe(process.cwd());
    expect(directory.startsWith(process.cwd())).toBe(false);
  });

  it('holds the response schema and is removed afterwards', async () => {
    const result = await adapter.run('sh', ['-c', 'pwd; cat response.schema.json'], '', undefined, isolated());
    const [directory, schema] = result.stdout.trim().split('\n');
    expect(JSON.parse(schema!)).toEqual({ type: 'object' });
    // Pins the cleanup half of invariant 1: without the rm in the finally, these accumulate one
    // directory per request for as long as the process lives.
    expect(existsSync(directory!)).toBe(false);
  });

  it('is removed even when the run fails', async () => {
    const result = await adapter.run('sh', ['-c', 'pwd; exit 3'], '', undefined, isolated());
    expect(result.exitCode).toBe(3);
    expect(existsSync(result.stdout.trim())).toBe(false);
  });
});

describe('the environment', () => {
  it('reaches the child as the allowlist and nothing else', async () => {
    // Pins invariant 2 where it matters: in the child's own environment. Testing
    // authenticationEnvironment() alone would still pass if the adapter handed over process.env.
    process.env.MUTATION_PROBE_SECRET = 'postgres://secret@localhost/db';
    try {
      const result = await adapter.run('printenv', [], '', undefined, isolated());
      expect(result.stdout).not.toContain('MUTATION_PROBE_SECRET');
      expect(result.stdout).not.toContain('postgres://secret');
      // PATH is on the allowlist, so the child is not left unable to resolve anything.
      expect(result.stdout).toContain('PATH=');
    } finally {
      delete process.env.MUTATION_PROBE_SECRET;
    }
  });
});

describe('cancellation', () => {
  it('kills the process group, not just the tool', async () => {
    // Pins invariant 3. The grandchild stands in for the sandboxes, shells and model calls a real
    // CLI starts: without its own process group the signal reaches the CLI and none of them, and
    // Stop appears to work while the box says otherwise.
    //
    // The pid is written outside the isolated directory, because that directory is removed as part
    // of the very run being cancelled.
    const scratch = await mkdtemp(join(tmpdir(), 'adapter-test-'));
    const pidFile = join(scratch, 'grandchild.pid');
    const controller = new AbortController();

    const running = adapter.run(
      'sh',
      ['-c', `sleep 30 & echo $! > ${pidFile}; wait`],
      '',
      controller.signal,
      isolated(),
    );

    try {
      const start = Date.now();
      let grandchild = 0;
      while (!grandchild && Date.now() - start < 5_000) {
        await new Promise(resolve => setTimeout(resolve, 25));
        try {
          grandchild = Number((await readFile(pidFile, 'utf8')).trim());
        } catch { /* not written yet */ }
      }
      expect(grandchild).toBeGreaterThan(0);
      // Still alive before the cancel, so the assertion after it means something.
      expect(() => process.kill(grandchild, 0)).not.toThrow();

      controller.abort();
      await expect(running).rejects.toThrow(/canceled/i);

      await new Promise(resolve => setTimeout(resolve, 250));
      // Signal 0 only asks whether the pid is still there.
      expect(() => process.kill(grandchild, 0)).toThrow();
    } finally {
      await rm(scratch, { recursive: true, force: true });
    }
  });
});

describe('the output cap', () => {
  it('stops a runaway CLI instead of growing the API process', async () => {
    // Pins invariant 4. 3 MB against a 2 MB cap.
    await expect(adapter.run(
      'sh',
      ['-c', "awk 'BEGIN { while (i++ < 3000000) printf \"x\" }'"],
      '',
      undefined,
      isolated(),
    )).rejects.toThrow(/exceeded the local limit/i);
  });
});

describe('the isolation contract', () => {
  it('refuses a working directory that is not the isolated one', async () => {
    // Pins invariant 5 for a caller that arrived through `any`.
    await expect(adapter.run('pwd', [], '', undefined, isolated({ workingDirectory: process.cwd() as any })))
      .rejects.toThrow(/isolation requirements/i);
  });

  it('refuses a full environment', async () => {
    await expect(adapter.run('pwd', [], '', undefined, isolated({ environment: 'inherit' as any })))
      .rejects.toThrow(/isolation requirements/i);
  });

  it.each(['/etc/passwd', '../escape.json'])('refuses the schema path %s', async path => {
    await expect(adapter.run('pwd', [], '', undefined, isolated({ responseSchemaPath: path })))
      .rejects.toThrow(/inside the isolated temporary directory/i);
  });
});
