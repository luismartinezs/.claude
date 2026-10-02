import { z } from 'zod';
import {
  describeSelection,
  validateAgentSelection,
  type AgentImage,
  type AgentSelection,
} from '../contracts/agent.ts';
import { fallbackSelection, runtimeUnavailable } from './availability.ts';
import { buildAgentInvocation, type AgentTools } from './invocation.ts';
import type { AgentProcessAdapter } from './process.ts';
import {
  didAnyWork,
  hasTopLevelUnion,
  parseNativeAgentOutput,
  removeCodexOptionalNulls,
  requireCodexObjectProperties,
  stdoutFailure,
  unionEnvelopeSchema,
  unwrapUnionEnvelope,
} from './output.ts';

// One agent run: build the command line, run it under a timeout and a cancel, read the answer,
// repair it for the runtime that produced it, and validate it against the caller's schema.
//
// The app supplies the task. This file knows nothing about what the app asks for, which is what
// keeps it portable: a task is a name, a Zod schema, a timeout and whether it needs tools.

export type AgentTask<T> = {
  /** Named in every status and error, so a log line says which task was slow or failed. */
  name: string;
  /** The shape of the answer. Also becomes the CLI's response schema. */
  schema: z.ZodType<T>;
  /** How long this task may take. Size it from the work, not from a round number: a task that
   *  returns a large document from a growing input needs minutes, and a timeout here throws away
   *  everything the run had already produced. */
  timeoutMs: number;
  tools?: AgentTools;
};

export type AgentRunOutcome<T> =
  | { state: 'complete'; output: T; selection: AgentSelection; status: string }
  | { state: 'failed'; error: string; selection: AgentSelection; didWork: boolean }
  | { state: 'canceled'; selection: AgentSelection };

export type AgentRunOptions = {
  signal?: AbortSignal;
  images?: AgentImage[];
  /** Extra text placed before the instruction. Reference material, never instructions to the tool. */
  preamble?: string;
  responseSchemaPath?: string;
};

const errorText = (error: unknown): string => error instanceof Error ? error.message : String(error);

const durationText = (ms: number): string =>
  ms >= 60_000 ? `${Math.round(ms / 60_000)} minutes` : `${ms} ms`;

export const runAgentTask = async <T>(
  adapter: AgentProcessAdapter,
  task: AgentTask<T>,
  selectionInput: unknown,
  instruction: string,
  options: AgentRunOptions = {},
): Promise<AgentRunOutcome<T>> => {
  const selection = validateAgentSelection(selectionInput);
  if (!Number.isFinite(task.timeoutMs) || task.timeoutMs <= 0) {
    throw new Error('Agent timeout must be a positive number.');
  }

  const schemaPath = options.responseSchemaPath ?? 'response.schema.json';
  const domainSchema = z.toJSONSchema(task.schema, { target: 'draft-7' }) as Record<string, unknown>;
  const useUnionEnvelope = hasTopLevelUnion(domainSchema);
  const envelopeSchema = useUnionEnvelope ? unionEnvelopeSchema(domainSchema as any) : domainSchema;
  const responseSchema = selection.runtime === 'codex'
    ? requireCodexObjectProperties(envelopeSchema)
    : envelopeSchema;

  const invocation = buildAgentInvocation(selection, schemaPath, responseSchema, task.tools ?? 'none');

  const controller = new AbortController();
  let stop: ((reason: 'canceled' | 'timeout') => void) | undefined;
  const stopped = new Promise<'canceled' | 'timeout'>(resolve => { stop = resolve; });
  const cancel = () => {
    controller.abort();
    stop?.('canceled');
  };
  options.signal?.addEventListener('abort', cancel, { once: true });
  if (options.signal?.aborted) {
    options.signal.removeEventListener('abort', cancel);
    return { state: 'canceled', selection };
  }
  const timer = setTimeout(() => {
    controller.abort();
    stop?.('timeout');
  }, task.timeoutMs);

  // Image bytes travel separately — files for Codex, content blocks for Claude — because keeping
  // them in the prompt text overflows the CLI's input limit on the second image.
  const payload = JSON.stringify({
    task: task.name,
    instruction: [options.preamble, instruction].filter(Boolean).join('\n\n'),
    images: (options.images ?? []).map(({ bytes: _bytes, ...image }) => image),
  });

  const attempted = adapter.run(invocation.command, invocation.args, payload, controller.signal, {
    workingDirectory: invocation.workingDirectory,
    environment: invocation.environment,
    responseSchemaPath: schemaPath,
    responseSchema,
    images: options.images ?? [],
  }).then(
    result => ({ kind: 'result' as const, result }),
    error => ({ kind: 'error' as const, error }),
  );

  try {
    const outcome = await Promise.race([attempted, stopped]);
    if (outcome === 'canceled') return { state: 'canceled', selection };
    if (outcome === 'timeout') {
      return {
        state: 'failed',
        selection,
        // WHICH SELECTION AND HOW LONG. "The agent timed out" sends whoever reads it to the wrong
        // place; this sentence says whether to raise the budget or lower the model.
        error: `${task.name}: the ${describeSelection(selection)} request did not finish within ${durationText(task.timeoutMs)}.`,
        didWork: true,
      };
    }
    if (outcome.kind === 'error') {
      if (options.signal?.aborted) return { state: 'canceled', selection };
      // ENOENT is the CLI not being installed, which is an unavailability and must read as one so
      // the fallback recognises it.
      const startup = (outcome.error as { code?: string })?.code === 'ENOENT';
      return {
        state: 'failed',
        selection,
        error: startup ? `${invocation.command} is not installed or not on PATH.` : errorText(outcome.error),
        didWork: !startup,
      };
    }

    const { stdout, stderr, exitCode } = outcome.result;
    if (exitCode !== 0) {
      const detail = stderr.trim() || stdoutFailure(selection.runtime, stdout) || `exit code ${exitCode}`;
      return {
        state: 'failed',
        selection,
        error: `${task.name}: the ${describeSelection(selection)} CLI failed: ${detail}`,
        didWork: didAnyWork(selection.runtime, stdout),
      };
    }

    try {
      const native = parseNativeAgentOutput(selection.runtime, stdout);
      const unwrapped = unwrapUnionEnvelope(native, useUnionEnvelope);
      const repaired = selection.runtime === 'codex'
        ? removeCodexOptionalNulls(unwrapped, domainSchema)
        : unwrapped;
      const parsed = task.schema.safeParse(repaired);
      if (!parsed.success) {
        // Name the first problems: whoever retries needs to tell a weak model from a request the
        // model cannot satisfy, and "invalid output" does not distinguish them.
        const issues = parsed.error.issues.slice(0, 3).map(issue => `${issue.path.join('.') || 'output'}: ${issue.message}`);
        throw new Error(`the structured output was invalid (${issues.join('; ')})`);
      }
      return {
        state: 'complete',
        output: parsed.data,
        selection,
        status: `${task.name}: ${describeSelection(selection)} completed.`,
      };
    } catch (error) {
      return {
        state: 'failed',
        selection,
        error: `${task.name}: the ${describeSelection(selection)} response could not be used: ${errorText(error)}`,
        // It answered. Another runtime will probably answer the same way, and the caller decides.
        didWork: true,
      };
    }
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', cancel);
  }
};

/**
 * The same task on the next runtime when this one is unavailable — missing, signed out, or out of
 * usage — and nothing else.
 *
 * THE TWO GUARDS ARE BOTH REQUIRED. `runtimeUnavailable` keeps a bad answer from being retried on a
 * second subscription; `didWork` keeps a run that already started doing something from being done
 * again. Either one alone has a failure mode that costs real money or real side effects.
 */
export const runRoutedAgentTask = async <T>(
  adapter: AgentProcessAdapter,
  task: AgentTask<T>,
  selectionInput: unknown,
  instruction: string,
  options: AgentRunOptions = {},
): Promise<AgentRunOutcome<T>> => {
  const first = await runAgentTask(adapter, task, selectionInput, instruction, options);
  if (first.state !== 'failed' || first.didWork || !runtimeUnavailable(first.error)) return first;
  const fallback = fallbackSelection(first.selection);
  if (!fallback) return first;

  const second = await runRoutedAgentTask(adapter, task, fallback, instruction, options);
  const unavailable = `${describeSelection(first.selection)} was unavailable (${first.error})`;
  if (second.state === 'complete') return { ...second, status: `${unavailable}. ${second.status}` };
  if (second.state === 'failed') return { ...second, error: `${unavailable}. ${second.error}` };
  return second;
};
