import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { AgentProcessAdapter, AgentProcessExecution } from '../runtime/process.ts';
import { runAgentTask, runRoutedAgentTask, type AgentTask } from '../runtime/run.ts';

// The whole runtime is tested against a stub adapter. That is what the port in process.ts buys:
// timeouts, cancellation, parsing, repair and fallback are provable without a CLI on the machine.

const answerTask: AgentTask<{ answer: string }> = {
  name: 'answer',
  schema: z.object({ answer: z.string() }),
  timeoutMs: 1_000,
};

const codex = { runtime: 'codex', model: 'sol', effort: 'high' } as const;
const claude = { runtime: 'claude-code', model: 'opus', effort: 'high' } as const;

const codexSuccess = (answer: string): string =>
  `${JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: JSON.stringify({ answer }) } })}\n`
  + `${JSON.stringify({ type: 'turn.completed' })}\n`;

type Call = { command: string; args: string[]; input: string; execution: AgentProcessExecution };

const stub = (
  responses: Array<Partial<{ stdout: string; stderr: string; exitCode: number; throws: unknown; hang: boolean }>>,
): { adapter: AgentProcessAdapter; calls: Call[] } => {
  const calls: Call[] = [];
  let index = 0;
  return {
    calls,
    adapter: {
      run: async (command, args, input, signal, execution) => {
        calls.push({ command, args, input, execution });
        const response = responses[Math.min(index++, responses.length - 1)] ?? {};
        if (response.throws) throw response.throws;
        if (response.hang) {
          return await new Promise((_resolve, reject) => {
            signal?.addEventListener('abort', () => reject(new Error('Generation canceled.')), { once: true });
          });
        }
        return { stdout: response.stdout ?? '', stderr: response.stderr ?? '', exitCode: response.exitCode ?? 0 };
      },
    },
  };
};

describe('a successful run', () => {
  it('returns the validated output', async () => {
    const { adapter } = stub([{ stdout: codexSuccess('yes') }]);
    const outcome = await runAgentTask(adapter, answerTask, codex, 'Say yes.');
    expect(outcome).toMatchObject({ state: 'complete', output: { answer: 'yes' } });
  });

  it('always passes the isolated execution contract to the adapter', async () => {
    // Pins invariant 5 from the caller's side: nothing in the run path can ask for a real cwd.
    const { adapter, calls } = stub([{ stdout: codexSuccess('yes') }]);
    await runAgentTask(adapter, answerTask, codex, 'Say yes.');
    expect(calls[0]!.execution.workingDirectory).toBe('isolated-temporary-directory');
    expect(calls[0]!.execution.environment).toBe('authentication-only');
    expect(calls[0]!.execution.responseSchemaPath).toBe('response.schema.json');
  });

  it('sends image metadata in the prompt and the bytes beside it', async () => {
    // Bytes in the prompt text overflow the CLI input limit on the second image.
    const { adapter, calls } = stub([{ stdout: codexSuccess('yes') }]);
    const image = {
      id: 'i1', inputId: 'in1', name: 'a.png', mediaType: 'image/png' as const, size: 8,
      bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString('base64'),
    };
    await runAgentTask(adapter, answerTask, codex, 'Look.', { images: [image] });
    expect(calls[0]!.input).not.toContain(image.bytes);
    expect(calls[0]!.input).toContain('a.png');
    expect(calls[0]!.execution.images[0]!.bytes).toBe(image.bytes);
  });
});

describe('failures', () => {
  it('names the selection and the budget in a timeout', async () => {
    // Pins invariant 12.
    const { adapter } = stub([{ hang: true }]);
    const outcome = await runAgentTask(adapter, { ...answerTask, timeoutMs: 20 }, codex, 'Say yes.');
    expect(outcome.state).toBe('failed');
    if (outcome.state !== 'failed') return;
    expect(outcome.error).toContain('Codex sol at high');
    expect(outcome.error).toMatch(/20 ms|1 minutes/);
  });

  it('reports a missing CLI as an unavailability', async () => {
    const { adapter } = stub([{ throws: Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' }) }]);
    const outcome = await runAgentTask(adapter, answerTask, codex, 'Say yes.');
    expect(outcome).toMatchObject({ state: 'failed', didWork: false });
    if (outcome.state === 'failed') expect(outcome.error).toMatch(/not installed or not on PATH/);
  });

  it('names the first schema problems rather than saying the output was invalid', async () => {
    const stdout = `${JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: '{"reply":"yes"}' } })}\n`
      + `${JSON.stringify({ type: 'turn.completed' })}\n`;
    const { adapter } = stub([{ stdout }]);
    const outcome = await runAgentTask(adapter, answerTask, codex, 'Say yes.');
    expect(outcome.state).toBe('failed');
    if (outcome.state === 'failed') expect(outcome.error).toContain('answer');
  });

  it('uses stdout when the exit code is non-zero and stderr is empty', async () => {
    const stdout = `${JSON.stringify({ type: 'result', is_error: true, result: 'Not logged in' })}\n`;
    const { adapter } = stub([{ stdout, exitCode: 1 }]);
    const outcome = await runAgentTask(adapter, answerTask, claude, 'Say yes.');
    if (outcome.state === 'failed') expect(outcome.error).toMatch(/not logged in/i);
  });
});

describe('cancellation', () => {
  it('ends as canceled rather than as a failure', async () => {
    // Pins invariant 14.
    const controller = new AbortController();
    const { adapter } = stub([{ hang: true }]);
    const running = runAgentTask(adapter, answerTask, codex, 'Say yes.', { signal: controller.signal });
    controller.abort();
    expect(await running).toMatchObject({ state: 'canceled' });
  });

  it('does not start a run that is already cancelled', async () => {
    const controller = new AbortController();
    controller.abort();
    const { adapter, calls } = stub([{ stdout: codexSuccess('yes') }]);
    expect(await runAgentTask(adapter, answerTask, codex, 'Say yes.', { signal: controller.signal }))
      .toMatchObject({ state: 'canceled' });
    expect(calls).toHaveLength(0);
  });
});

describe('routed runs', () => {
  it('moves to the next runtime when the first is out of usage', async () => {
    const limit = `${JSON.stringify({ type: 'turn.failed', error: { message: 'You have hit your usage limit.' } })}\n`;
    const claudeAnswer = `${JSON.stringify({ type: 'result', is_error: false, structured_output: { answer: 'yes' } })}\n`;
    const { adapter, calls } = stub([{ stdout: limit, exitCode: 1 }, { stdout: claudeAnswer }]);
    const outcome = await runRoutedAgentTask(adapter, answerTask, codex, 'Say yes.');
    expect(outcome.state).toBe('complete');
    if (outcome.state === 'complete') {
      expect(outcome.selection.runtime).toBe('claude-code');
      // The status says the first runtime was unavailable, so a log shows the switch happened.
      expect(outcome.status).toMatch(/unavailable/i);
    }
    expect(calls.map(call => call.command)).toEqual(['codex', 'claude']);
  });

  it('does not fall back on a bad answer', async () => {
    // Pins invariant 10 end to end.
    const bad = `${JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: '{"reply":"yes"}' } })}\n`
      + `${JSON.stringify({ type: 'turn.completed' })}\n`;
    const { adapter, calls } = stub([{ stdout: bad }]);
    const outcome = await runRoutedAgentTask(adapter, answerTask, codex, 'Say yes.');
    expect(outcome.state).toBe('failed');
    expect(calls).toHaveLength(1);
  });

  it('does not fall back when the first runtime already did work', async () => {
    // Pins invariant 11 end to end: a run that hit its limit mid-turn may have had side effects,
    // and running it again on another subscription does them twice.
    const midway = `${JSON.stringify({ type: 'item.started', item: { type: 'command_execution' } })}\n`
      + `${JSON.stringify({ type: 'turn.failed', error: { message: 'You have hit your usage limit.' } })}\n`;
    const { adapter, calls } = stub([{ stdout: midway, exitCode: 1 }]);
    const outcome = await runRoutedAgentTask(adapter, { ...answerTask, tools: 'full' }, codex, 'Do it.');
    expect(outcome.state).toBe('failed');
    expect(calls).toHaveLength(1);
  });

  it('refuses a timeout that is not a positive number', async () => {
    const { adapter } = stub([{ stdout: codexSuccess('yes') }]);
    await expect(runAgentTask(adapter, { ...answerTask, timeoutMs: 0 }, codex, 'x')).rejects.toThrow(/positive/i);
  });
});

describe('the process adapter contract', () => {
  it('refuses a run whose execution is not the isolated one', async () => {
    // Pins invariant 5 in the adapter itself, for a caller that arrived through `any`.
    const { createAgentProcessAdapter } = await import('../runtime/process-adapter.ts');
    const adapter = createAgentProcessAdapter();
    await expect(adapter.run('claude', [], '', undefined, {
      workingDirectory: process.cwd() as any,
      environment: 'authentication-only',
      responseSchemaPath: 'response.schema.json',
      responseSchema: {},
      images: [],
    })).rejects.toThrow(/isolation requirements/i);
  });

  it('refuses a schema path that escapes the temporary directory', async () => {
    const { createAgentProcessAdapter } = await import('../runtime/process-adapter.ts');
    const adapter = createAgentProcessAdapter();
    for (const path of ['/etc/passwd', '../escape.json']) {
      await expect(adapter.run('claude', [], '', undefined, {
        workingDirectory: 'isolated-temporary-directory',
        environment: 'authentication-only',
        responseSchemaPath: path,
        responseSchema: {},
        images: [],
      })).rejects.toThrow(/inside the isolated temporary directory/i);
    }
  });

  it('passes only the allowlisted environment', async () => {
    // Pins invariant 2. A denylist fails open the moment someone adds a variable.
    const { authenticationEnvironment } = await import('../runtime/process-adapter.ts');
    const environment = authenticationEnvironment({
      PATH: '/usr/bin', HOME: '/home/app',
      DATABASE_URL: 'postgres://secret', STRIPE_SECRET_KEY: 'sk_live_x', OPENROUTER_API_KEY: 'or-x',
    } as NodeJS.ProcessEnv);
    expect(environment).toEqual({ PATH: '/usr/bin', HOME: '/home/app' });
  });

  it('inserts Codex image paths before the stdin marker', async () => {
    const { codexImageArguments } = await import('../runtime/process-adapter.ts');
    expect(codexImageArguments(['exec', '--json', '-'], ['/tmp/a.png']))
      .toEqual(['exec', '--json', '--image', '/tmp/a.png', '-']);
  });
});
