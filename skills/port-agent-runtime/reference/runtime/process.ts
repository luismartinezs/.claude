import type { AgentImage } from '../contracts/agent.ts';

// The port the API implements to run one agent CLI. It exists so the whole runtime — timeouts,
// cancellation, parsing, fallback — is tested against a stub instead of a real subprocess, and so
// the isolation requirements are part of the call rather than a convention in the implementation.

export type AgentProcessResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

/** THE LITERAL TYPES ARE THE POINT. A caller cannot ask for the repository as the working
 *  directory or for the full environment, because there is no value it could pass to say so, and
 *  the adapter re-checks both at runtime for callers that reached it as `any`. */
export type AgentProcessExecution = {
  workingDirectory: 'isolated-temporary-directory';
  environment: 'authentication-only';
  /** Relative, so it resolves inside the temporary directory and nowhere else. */
  responseSchemaPath: string;
  responseSchema: unknown;
  images: AgentImage[];
};

export type AgentProcessAdapter = {
  run: (
    command: string,
    args: string[],
    input: string,
    signal: AbortSignal | undefined,
    execution: AgentProcessExecution,
  ) => Promise<AgentProcessResult>;
};
