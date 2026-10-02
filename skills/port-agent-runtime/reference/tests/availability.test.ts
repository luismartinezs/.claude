import { describe, expect, it } from 'vitest';
import { validateAgentSelection } from '../contracts/agent.ts';
import { fallbackSelection, nextRuntime, runtimeUnavailable, translatedSelection } from '../runtime/availability.ts';

describe('unavailable versus a bad answer', () => {
  it.each([
    'codex is not installed or not on PATH.',
    'Claude AI usage limit reached',
    'You have hit your usage limit.',
    'rate-limit exceeded',
    'insufficient quota',
    'Not logged in. Please run /login',
    'Your credit balance is too low',
    'unauthorized',
  ])('treats %s as unavailable', message => {
    expect(runtimeUnavailable(message)).toBe(true);
  });

  it.each([
    'the structured output was invalid (answer: Required)',
    'The agent exited without a complete response.',
    'the request did not finish within 5 minutes.',
    'I cannot help with that.',
    'exit code 1',
  ])('treats %s as a result, not an unavailability', message => {
    // Pins invariant 10. Every one of these falling back would spend a second subscription to get
    // the same answer, and hide a prompt or schema problem behind it.
    expect(runtimeUnavailable(message)).toBe(false);
  });
});

describe('the fallback order', () => {
  it('runs out rather than looping', () => {
    expect(nextRuntime('codex')).toBe('claude-code');
    expect(nextRuntime('claude-code')).toBeNull();
    expect(fallbackSelection(validateAgentSelection({ runtime: 'claude-code', model: 'opus', effort: 'high' }))).toBeNull();
  });

  it('keeps the requested strength when translating between runtimes', () => {
    // The two label lists are different lengths and are not even ordered the same way, so position
    // in the capability order is the only translation that does not silently downgrade.
    const strongest = validateAgentSelection({ runtime: 'codex', model: 'astra', effort: 'xhigh' });
    expect(translatedSelection(strongest, 'claude-code')).toMatchObject({ runtime: 'claude-code', model: 'fable' });
    const weakest = validateAgentSelection({ runtime: 'codex', model: 'spark', effort: 'low' });
    expect(translatedSelection(weakest, 'claude-code')).toMatchObject({ runtime: 'claude-code', model: 'haiku', effort: 'low' });
  });

  it('only ever produces a selection the contract allows', () => {
    const translated = translatedSelection(validateAgentSelection({ runtime: 'codex', model: 'sol', effort: 'xhigh' }), 'claude-code');
    expect(translated).not.toBeNull();
    expect(() => validateAgentSelection(translated)).not.toThrow();
  });
});
