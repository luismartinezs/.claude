import { describe, expect, it } from 'vitest';
import {
  agentSelectionContract,
  agentSelectionContractSchema,
  raisedToFloor,
  validateAgentSelection,
} from '../contracts/agent.ts';
import frozenAgentSelection from '../contracts/agent-selection.json' with { type: 'json' };
import { allAgentSelections, buildAgentInvocation } from '../runtime/invocation.ts';

const schema = { type: 'object', properties: { answer: { type: 'string' } }, required: ['answer'] };
const flagValue = (args: string[], flag: string): string | undefined => args[args.indexOf(flag) + 1];

describe('the capability contract', () => {
  it('records where it was measured', () => {
    // Pins invariant 8. A table with no provenance is a guess, and a copy with no provenance
    // cannot be diffed against the repository it came from.
    expect(agentSelectionContract.source.repository).toBeTruthy();
    expect(agentSelectionContract.source.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(agentSelectionContract.source.measured).toBeTruthy();
  });

  it('rejects a model the runtime does not accept', () => {
    expect(() => validateAgentSelection({ runtime: 'codex', model: 'opus', effort: 'high' })).toThrow();
    expect(() => validateAgentSelection({ runtime: 'claude-code', model: 'sol', effort: 'high' })).toThrow();
  });

  it('is the parsed table, not the raw file', () => {
    // Pins invariant 8. The exported constant must be the output of the schema, so a malformed
    // table fails the process at boot rather than one request later, in one caller, at 03:00.
    expect(() => agentSelectionContractSchema.parse(frozenAgentSelection)).not.toThrow();
    expect(agentSelectionContract).toEqual(agentSelectionContractSchema.parse(frozenAgentSelection));
  });

  it.each([
    ['a label missing from the capability order', (table: any) => {
      table.capabilityOrder['claude-code'].models = ['haiku', 'sonnet'];
    }],
    ['a Codex label with no native model name', (table: any) => {
      table.runtimes.codex.models = [...table.runtimes.codex.models, 'nova'];
    }],
    ['a default outside the accepted labels', (table: any) => {
      table.default = { runtime: 'codex', model: 'opus', effort: 'high' };
    }],
    ['a duplicated model label', (table: any) => {
      table.runtimes.codex.models = [...table.runtimes.codex.models, 'sol'];
    }],
    ['a source with no content hash', (table: any) => {
      table.source.sha256 = 'unknown';
    }],
    ['a runtime repeated in the fallback order', (table: any) => {
      table.fallbackOrder = ['codex', 'codex'];
    }],
  ])('refuses a table with %s', (_name, damage) => {
    const table = structuredClone(frozenAgentSelection) as any;
    damage(table);
    expect(agentSelectionContractSchema.safeParse(table).success).toBe(false);
  });

  it('rejects an effort the runtime does not accept', () => {
    // ultracode is Claude-only; codex tops out at xhigh.
    expect(() => validateAgentSelection({ runtime: 'codex', model: 'sol', effort: 'ultracode' })).toThrow();
  });

  it('raises a selection to a floor but never lowers it', () => {
    const weak = validateAgentSelection({ runtime: 'claude-code', model: 'haiku', effort: 'low' });
    expect(raisedToFloor(weak, { model: 'sonnet', effort: 'medium' })).toMatchObject({ model: 'sonnet', effort: 'medium' });
    const strong = validateAgentSelection({ runtime: 'claude-code', model: 'opus', effort: 'high' });
    expect(raisedToFloor(strong, { model: 'sonnet', effort: 'medium' })).toMatchObject({ model: 'opus', effort: 'high' });
  });
});

describe('building an invocation', () => {
  it('validates the selection before anything reaches argv', () => {
    // Pins invariant 9: the injection guard. Without validateAgentSelection inside
    // buildAgentInvocation, this string lands in argv as a model name.
    expect(() => buildAgentInvocation(
      { runtime: 'codex', model: 'sol --sandbox danger-full-access', effort: 'high' },
      'response.schema.json',
      schema,
    )).toThrow();
  });

  it('never lets a caller ask for a non-isolated execution', () => {
    // Pins invariant 5 at the type level, checked here as a value.
    for (const selection of [{ runtime: 'codex', model: 'sol', effort: 'high' }, { runtime: 'claude-code', model: 'opus', effort: 'high' }]) {
      const invocation = buildAgentInvocation(selection, 'response.schema.json', schema);
      expect(invocation.workingDirectory).toBe('isolated-temporary-directory');
      expect(invocation.environment).toBe('authentication-only');
    }
  });

  it('turns tools off by default on both runtimes', () => {
    // Pins invariant 6.
    const claude = buildAgentInvocation({ runtime: 'claude-code', model: 'opus', effort: 'high' }, 's.json', schema);
    expect(flagValue(claude.args, '--tools')).toBe('');
    const codex = buildAgentInvocation({ runtime: 'codex', model: 'sol', effort: 'high' }, 's.json', schema);
    expect(flagValue(codex.args, '--sandbox')).toBe('read-only');
    expect(codex.args.join(' ')).toContain('approval_policy="never"');
    for (const feature of ['shell_tool', 'browser_use', 'hooks']) {
      expect(codex.args.join(' ')).toContain(`features.${feature}=false`);
    }
  });

  it('inherits no user configuration', () => {
    // Pins invariant 7. Each of these is a channel through which the machine's own config would
    // change the answer, and the same request would answer differently on the box.
    const claude = buildAgentInvocation({ runtime: 'claude-code', model: 'opus', effort: 'high' }, 's.json', schema);
    expect(claude.args).toContain('--strict-mcp-config');
    expect(flagValue(claude.args, '--mcp-config')).toBe('{"mcpServers":{}}');
    expect(flagValue(claude.args, '--settings')).toContain('disableAllHooks');
    expect(flagValue(claude.args, '--setting-sources')).toBe('');
    const codex = buildAgentInvocation({ runtime: 'codex', model: 'sol', effort: 'high' }, 's.json', schema);
    expect(codex.args).toContain('--ignore-user-config');
    expect(codex.args).toContain('--ignore-rules');
    expect(codex.args).toContain('--ephemeral');
    expect(codex.args.join(' ')).toContain('project_doc_max_bytes=0');
  });

  it('keeps the three Claude stream flags together', () => {
    const claude = buildAgentInvocation({ runtime: 'claude-code', model: 'opus', effort: 'high' }, 's.json', schema);
    expect(flagValue(claude.args, '--input-format')).toBe('stream-json');
    expect(flagValue(claude.args, '--output-format')).toBe('stream-json');
    expect(claude.args).toContain('--verbose');
  });

  it('sends Codex the native model name and reads the prompt from stdin last', () => {
    const codex = buildAgentInvocation({ runtime: 'codex', model: 'sol', effort: 'high' }, 's.json', schema);
    expect(flagValue(codex.args, '--model')).toBe(agentSelectionContract.nativeModels.sol);
    // Anything after the marker is read as a positional argument.
    expect(codex.args.at(-1)).toBe('-');
    expect(flagValue(codex.args, '--output-schema')).toBe('s.json');
  });

  it('builds a command line for every selection the contract allows', () => {
    const selections = allAgentSelections();
    expect(selections.length).toBe(
      agentSelectionContract.runtimes.codex.models.length * agentSelectionContract.runtimes.codex.efforts.length
      + agentSelectionContract.runtimes['claude-code'].models.length * agentSelectionContract.runtimes['claude-code'].efforts.length,
    );
    for (const selection of selections) {
      expect(() => buildAgentInvocation(selection, 's.json', schema)).not.toThrow();
    }
  });
});
