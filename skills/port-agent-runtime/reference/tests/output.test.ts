import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  didAnyWork,
  hasTopLevelUnion,
  parseNativeAgentOutput,
  removeCodexOptionalNulls,
  requireCodexObjectProperties,
  stdoutFailure,
  unionEnvelopeSchema,
  unwrapUnionEnvelope,
} from '../runtime/output.ts';

const line = (frame: unknown): string => `${JSON.stringify(frame)}\n`;

describe('reading a Claude Code stream', () => {
  it('takes the structured output from the last result frame', () => {
    const stdout = line({ type: 'assistant', message: { usage: { output_tokens: 4 } } })
      + line({ type: 'result', is_error: false, structured_output: { answer: 'yes' } });
    expect(parseNativeAgentOutput('claude-code', stdout)).toEqual({ answer: 'yes' });
  });

  it('falls back to the text answer, fenced or not', () => {
    const stdout = line({ type: 'result', is_error: false, result: '```json\n{"answer":"yes"}\n```' });
    expect(parseNativeAgentOutput('claude-code', stdout)).toEqual({ answer: 'yes' });
  });

  it('throws the CLI error message when the result frame is an error', () => {
    const stdout = line({ type: 'result', is_error: true, result: 'Claude AI usage limit reached' });
    expect(() => parseNativeAgentOutput('claude-code', stdout)).toThrow(/usage limit/i);
  });

  it('throws a readable error when the stream ends with no result frame', () => {
    // Not "Unexpected end of JSON input", which sends the reader looking for a malformed response
    // when the runtime simply stopped early.
    expect(() => parseNativeAgentOutput('claude-code', line({ type: 'assistant' }))).toThrow(/without a result/i);
    expect(() => parseNativeAgentOutput('claude-code', line({ type: 'system', subtype: 'init' })))
      .toThrow(/without a result/i);
  });

  it('accepts the single-frame --output-format json shape', () => {
    expect(parseNativeAgentOutput('claude-code', line({ is_error: false, result: '{"answer":"yes"}' })))
      .toEqual({ answer: 'yes' });
  });
});

describe('reading a Codex stream', () => {
  it('requires both a completed turn and a message', () => {
    // Pins invariant 13's Codex half: a stream that stops mid-turn can still carry a
    // complete-looking message, and acting on it means acting on half an answer.
    const message = line({ type: 'item.completed', item: { type: 'agent_message', text: '{"answer":"yes"}' } });
    expect(() => parseNativeAgentOutput('codex', message)).toThrow(/without a complete response/i);
    expect(parseNativeAgentOutput('codex', message + line({ type: 'turn.completed' }))).toEqual({ answer: 'yes' });
  });

  it('surfaces a turn.failed error message', () => {
    const stdout = line({ type: 'turn.failed', error: { message: 'You have hit your usage limit.' } });
    expect(() => parseNativeAgentOutput('codex', stdout)).toThrow(/usage limit/i);
  });
});

describe('schema repair', () => {
  it.each([
    // Zod emits anyOf for a plain union and oneOf for a discriminated one. A check for only one of
    // them passes today and fails the first time someone writes the other kind.
    ['union', z.union([z.object({ kind: z.literal('a'), a: z.string() }), z.object({ kind: z.literal('b'), b: z.string() })])],
    ['discriminatedUnion', z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('a'), a: z.string() }),
      z.object({ kind: z.literal('b'), b: z.string() }),
    ])],
  ])('wraps a top-level %s in a result envelope and unwraps it again', (_name, schema) => {
    const jsonSchema = z.toJSONSchema(schema, { target: 'draft-7' }) as Record<string, unknown>;
    expect(hasTopLevelUnion(jsonSchema)).toBe(true);
    const wrapped = unionEnvelopeSchema(jsonSchema);
    expect(wrapped.type).toBe('object');
    expect((wrapped.properties as any).result.anyOf).toHaveLength(2);
    expect(unwrapUnionEnvelope({ result: { kind: 'a', a: 'x' } }, true)).toEqual({ kind: 'a', a: 'x' });
    expect(() => unwrapUnionEnvelope({ kind: 'a', a: 'x' }, true)).toThrow(/required result object/i);
  });

  it('does not see a plain object as a union', () => {
    expect(hasTopLevelUnion(z.toJSONSchema(z.object({ answer: z.string() }), { target: 'draft-7' }))).toBe(false);
  });

  it('makes every Codex object property required and nullable', () => {
    // Codex refuses a schema with a property outside `required`, so an optional one goes out as
    // anyOf [T, null] and required.
    const schema = z.toJSONSchema(z.object({ answer: z.string(), note: z.string().optional() }), { target: 'draft-7' });
    const repaired = requireCodexObjectProperties(schema) as any;
    expect(repaired.required.sort()).toEqual(['answer', 'note']);
    expect(repaired.properties.note.anyOf).toEqual([{ type: 'string' }, { type: 'null' }]);
    // A property that was already required is untouched.
    expect(repaired.properties.answer).toEqual({ type: 'string' });
  });

  it('strips the nulls Codex had to fill in', () => {
    const schema = z.toJSONSchema(z.object({ answer: z.string(), note: z.string().optional() }), { target: 'draft-7' });
    expect(removeCodexOptionalNulls({ answer: 'yes', note: null }, schema)).toEqual({ answer: 'yes' });
    // A required null stays, because the app's schema is what decides whether that is legal.
    expect(removeCodexOptionalNulls({ answer: null, note: 'x' }, schema)).toEqual({ answer: null, note: 'x' });
  });

  it('round-trips through the repair pair', () => {
    const app = z.object({ answer: z.string(), note: z.string().optional() });
    const jsonSchema = z.toJSONSchema(app, { target: 'draft-7' });
    requireCodexObjectProperties(jsonSchema);
    const fromCodex = { answer: 'yes', note: null };
    expect(app.safeParse(fromCodex).success).toBe(false);
    expect(app.safeParse(removeCodexOptionalNulls(fromCodex, jsonSchema)).success).toBe(true);
  });
});

describe('failure reporting', () => {
  it('finds a failure in stdout when stderr is empty', () => {
    // Pins the reason stdoutFailure exists: Claude Code reports most failures in its result frame.
    const stdout = line({ type: 'result', is_error: true, result: 'Not logged in' });
    expect(stdoutFailure('claude-code', stdout)).toMatch(/not logged in/i);
    expect(stdoutFailure('claude-code', '')).toBe('');
  });
});

describe('whether the runtime did any work', () => {
  it('sees output, token usage and tool activity as work', () => {
    // Pins invariant 11. Each of these means the run may have had effects outside this process.
    expect(didAnyWork('claude-code', line({ type: 'assistant', message: { usage: { output_tokens: 1 } } }))).toBe(true);
    expect(didAnyWork('codex', line({ type: 'item.started', item: {} }))).toBe(true);
    expect(didAnyWork('claude-code', line({ type: 'system', subtype: 'init' }))).toBe(false);
  });

  it('treats unparseable output as work rather than guessing', () => {
    // The guess in the other direction is the one that runs the work twice.
    expect(didAnyWork('codex', 'not json at all')).toBe(true);
    expect(didAnyWork('codex', '')).toBe(false);
  });
});
