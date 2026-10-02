import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AgentImage } from '../contracts/agent.ts';
import type { AgentProcessAdapter, AgentProcessResult } from './process.ts';

// Runs one agent command line tool. The tool sees an empty temporary directory, only the
// environment variables its own authentication needs, and nothing of the operator's other
// credentials.

/** THE WHOLE ENVIRONMENT THE CHILD GETS. Not process.env minus secrets, which fails the moment
 *  someone adds a variable: an allowlist fails closed, a denylist fails open. A CLI that has just
 *  read a third-party web page must not be one getenv away from the database URL. */
const authenticationEnvironmentKeys = [
  'PATH',
  'HOME',
  'USER',
  'LOGNAME',
  'LANG',
  'TMPDIR',
  // Where each CLI keeps the subscription login. Set on the box when the app user is not the
  // account that logged in; unset on a workstation, where HOME already points at it.
  'CODEX_HOME',
  'CLAUDE_CONFIG_DIR',
  'CLAUDE_CODE_OAUTH_TOKEN',
];

export const authenticationEnvironment = (source: NodeJS.ProcessEnv = process.env): Record<string, string> =>
  Object.fromEntries(authenticationEnvironmentKeys
    .filter(key => source[key])
    .map(key => [key, source[key] as string]));

const imageExtension = (mediaType: string): string =>
  ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' }[mediaType] ?? 'png');

/** Codex takes image paths as arguments before the stdin marker; Claude Code takes them inside the
 *  message as content blocks. Inserted before the trailing `-` rather than appended, because
 *  anything after it is read as a further positional argument. */
export const codexImageArguments = (args: string[], imagePaths: string[]): string[] => {
  const next = [...args];
  if (!imagePaths.length) return next;
  const stdinIndex = next.lastIndexOf('-');
  next.splice(stdinIndex < 0 ? next.length : stdinIndex, 0, '--image', ...imagePaths);
  return next;
};

export const claudeImageInput = (input: string, images: AgentImage[]): string =>
  `${JSON.stringify({
    type: 'user',
    message: {
      role: 'user',
      content: [
        { type: 'text', text: input },
        ...images.map(image => ({
          type: 'image',
          source: { type: 'base64', media_type: image.mediaType, data: image.bytes },
        })),
      ],
    },
  })}\n`;

/** A runaway CLI must not grow the API process until the box swaps. */
const maximumOutputBytes = 2_000_000;
/** Enough to name the failure, little enough that a stack-trace flood cannot be the payload. */
const maximumStderrBytes = 4_000;

export const createAgentProcessAdapter = (): AgentProcessAdapter => ({
  async run(command, args, input, signal, execution) {
    // Re-checked here and not only in the type, because a caller that reached this through `any`
    // would otherwise get the repository as a working directory with no complaint.
    if (execution?.workingDirectory !== 'isolated-temporary-directory' || execution?.environment !== 'authentication-only') {
      throw new Error('Agent process isolation requirements are missing.');
    }
    if (execution.responseSchemaPath.startsWith('/') || execution.responseSchemaPath.includes('..')) {
      throw new Error('The response schema path must stay inside the isolated temporary directory.');
    }

    const directory = await mkdtemp(join(tmpdir(), 'agent-'));
    let abort: (() => void) | undefined;
    try {
      await writeFile(join(directory, execution.responseSchemaPath), JSON.stringify(execution.responseSchema));
      const images = execution.images ?? [];
      let processArgs = [...args];
      let processInput = input;
      if (command === 'codex' && images.length) {
        const imagePaths: string[] = [];
        for (const [index, image] of images.entries()) {
          const path = join(directory, `input-image-${index + 1}.${imageExtension(image.mediaType)}`);
          await writeFile(path, Buffer.from(image.bytes, 'base64'));
          imagePaths.push(path);
        }
        processArgs = codexImageArguments(processArgs, imagePaths);
      } else if (command === 'claude') {
        processInput = claudeImageInput(input, images);
      }
      if (signal?.aborted) throw new Error('Generation canceled.');

      const child = spawn(command, processArgs, {
        cwd: directory,
        env: authenticationEnvironment(),
        stdio: ['pipe', 'pipe', 'pipe'],
        // ITS OWN PROCESS GROUP, so a cancel kills the tool AND everything it started. Without
        // this, Stop kills `claude` and leaves its sandboxes, shells and model calls running: the
        // screen says stopped and the box says otherwise.
        detached: true,
      });

      let stdout = '';
      let stderr = '';
      let forcedError = '';
      const kill = (): void => {
        try {
          if (child.pid) process.kill(-child.pid, 'SIGKILL');
          else child.kill('SIGKILL');
        } catch {
          child.kill('SIGKILL');
        }
      };
      abort = () => {
        forcedError = 'Generation canceled.';
        kill();
      };
      signal?.addEventListener('abort', abort, { once: true });

      const result = new Promise<AgentProcessResult>((resolve, reject) => {
        child.on('error', reject);
        child.stdout.on('data', (chunk: Buffer) => {
          stdout += chunk.toString();
          if (stdout.length > maximumOutputBytes) {
            forcedError = 'The agent response exceeded the local limit.';
            kill();
          }
        });
        child.stderr.on('data', (chunk: Buffer) => {
          stderr = (stderr + chunk.toString()).slice(-maximumStderrBytes);
        });
        // The CLI can exit before the prompt is fully written; that is a close, not a crash.
        child.stdin.on('error', () => {});
        child.on('close', exitCode => {
          if (forcedError) return reject(new Error(forcedError));
          resolve({ stdout, stderr, exitCode: exitCode ?? 1 });
        });
      });
      child.stdin.end(processInput);
      return await result;
    } finally {
      if (abort) signal?.removeEventListener('abort', abort);
      // In a finally, so a throw anywhere above still removes the directory and whatever the tool
      // decided to write into it.
      await rm(directory, { recursive: true, force: true });
    }
  },
});
