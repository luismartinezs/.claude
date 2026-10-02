import {
  agentSelectionContract,
  validateAgentSelection,
  type AgentSelection,
} from '../contracts/agent.ts';

// THE ONLY PLACE IN THE CODEBASE THAT KNOWS A CLI FLAG.
//
// Every flag here is load-bearing and most of them are here to take something away. Read the
// comments before removing one: several look redundant and are the difference between a request
// that answers the same way on a workstation and on the box, and one that does not.

export type AgentTools = 'none' | 'read-only' | 'full';

export type AgentInvocation = {
  command: 'claude' | 'codex';
  args: string[];
  workingDirectory: 'isolated-temporary-directory';
  environment: 'authentication-only';
};

/** Codex features that are off unless a task asks for them. Each is a way for the tool to reach
 *  something outside the temporary directory, or to spend a lot of tokens deciding to. */
const disabledCodexFeatures = [
  'shell_tool',
  'unified_exec',
  'apps',
  'plugins',
  'multi_agent',
  'browser_use',
  'computer_use',
  'code_mode',
  'js_repl',
  'view_image',
  'image_generation',
  'memory_tool',
  'hooks',
];

const claudeToolArgs = (tools: AgentTools): string[] => {
  // '' is an empty allowlist, which is not the same as omitting the flag: omitted means every tool.
  if (tools === 'none') return ['--tools', ''];
  if (tools === 'read-only') return ['--tools', 'Read,Grep,Glob'];
  return [];
};

const codexSandboxArgs = (tools: AgentTools): string[] => {
  if (tools === 'full') return ['--sandbox', 'workspace-write'];
  return ['--sandbox', 'read-only'];
};

/**
 * One selection plus one JSON schema becomes one command line.
 *
 * `schemaPath` is relative and is written into the isolated temporary directory by the process
 * adapter: Codex reads the schema from a file, Claude Code takes it inline.
 */
export const buildAgentInvocation = (
  selectionInput: unknown,
  schemaPath: string,
  schema: unknown,
  tools: AgentTools = 'none',
): AgentInvocation => {
  // BEFORE ANY STRING REACHES ARGV. An unvalidated model or effort from a request body is an
  // argument-injection surface, and the capability table is the allowlist.
  const selection: AgentSelection = validateAgentSelection(selectionInput);

  if (selection.runtime === 'claude-code') {
    return {
      command: 'claude',
      args: [
        '-p',
        // stream-json input is needed for image content blocks, is only accepted alongside
        // stream-json output, and that output is only accepted with --verbose. The three travel
        // together; removing one makes the CLI reject the other two.
        '--input-format', 'stream-json',
        '--output-format', 'stream-json',
        '--verbose',
        '--json-schema', JSON.stringify(schema),
        // An empty MCP config plus --strict-mcp-config means the empty list is the WHOLE list,
        // rather than it plus whatever ~/.claude.json on this machine happens to carry.
        '--strict-mcp-config',
        '--mcp-config', '{"mcpServers":{}}',
        // Hooks, settings files and project docs are the operator's workstation configuration. A
        // server request that inherits them answers differently here than on the box, and the
        // difference is invisible in the output.
        '--settings', '{"disableAllHooks":true}',
        '--setting-sources', '',
        ...claudeToolArgs(tools),
        '--no-session-persistence',
        '--model', selection.model,
        '--effort', selection.effort,
      ],
      workingDirectory: 'isolated-temporary-directory',
      environment: 'authentication-only',
    };
  }

  // The frozen contract is validated at load: every Codex label has exactly one native name.
  const nativeModel = agentSelectionContract.nativeModels[selection.model]!;
  return {
    command: 'codex',
    args: [
      'exec',
      '--json',
      '--ignore-user-config',
      '--ignore-rules',
      '--ephemeral',
      // The temporary directory is not a repository, and Codex otherwise refuses to run in one.
      '--skip-git-repo-check',
      ...codexSandboxArgs(tools),
      '--model', nativeModel,
      // JSON.stringify, not a bare interpolation: this value is a config expression, and the
      // quoting is what keeps a label from being read as one.
      '-c', `model_reasoning_effort=${JSON.stringify(selection.effort)}`,
      // There is no human at the keyboard to answer an approval prompt. A request that waits for
      // one hangs until the timeout and reports nothing useful.
      '-c', 'approval_policy="never"',
      '-c', 'web_search="disabled"',
      '-c', 'project_doc_max_bytes=0',
      ...disabledCodexFeatures.flatMap(feature => ['-c', `features.${feature}=false`]),
      '--output-schema', schemaPath,
      // Prompt on stdin. Anything appended after this is read as a positional argument.
      '-',
    ],
    workingDirectory: 'isolated-temporary-directory',
    environment: 'authentication-only',
  };
};

/** Every selection the contract allows, for a compatibility sweep against the installed CLIs.
 *  Run it when a CLI updates: that sweep is what produced the fact table in the first place. */
export const allAgentSelections = (): AgentSelection[] =>
  agentSelectionContract.fallbackOrder.flatMap(runtime =>
    agentSelectionContract.runtimes[runtime].models.flatMap(model =>
      agentSelectionContract.runtimes[runtime].efforts.map(effort =>
        validateAgentSelection({ runtime, model, effort }))));
