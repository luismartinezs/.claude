#!/usr/bin/env python3
"""Break each guard the agent runtime depends on and prove a test goes red.

A ported test file that still passes with a guard removed did not port the guard, it ported a
description of one. Run this AFTER the tests are green, from the target repository root.

Edit PATHS to where the port actually put each file, and TEST_COMMAND to how the target runs its
unit tests. Anything printed as SURVIVED is a guard with no test behind it.
"""
import subprocess, sys

PATHS = {
    "invocation":  "apps/api/src/platform/agent/invocation.ts",
    "output":      "apps/api/src/platform/agent/output.ts",
    "availability":"apps/api/src/platform/agent/availability.ts",
    "run":         "apps/api/src/platform/agent/run.ts",
    "adapter":     "apps/api/src/platform/agent/process-adapter.ts",
    "contract":    "packages/contracts/src/agent.ts",
}
TEST_COMMAND = ["pnpm", "exec", "vitest", "run", "apps/api", "packages/contracts"]

# (file key, exact text to replace, replacement, what it breaks, which invariant)
MUTATIONS = [
    ("invocation",
     "const selection: AgentSelection = validateAgentSelection(selectionInput);",
     "const selection = selectionInput as AgentSelection;",
     "an unvalidated model string reaches argv", 9),
    ("invocation",
     "...claudeToolArgs(tools),",
     "",
     "Claude Code runs with every tool enabled", 6),
    ("invocation",
     "'--strict-mcp-config',",
     "",
     "the machine's own MCP servers are inherited", 7),
    ("invocation",
     "'--settings', '{\"disableAllHooks\":true}',",
     "",
     "the operator's hooks run inside a server request", 7),
    ("invocation",
     "'--ignore-user-config',",
     "",
     "Codex reads the machine's user config", 7),
    ("invocation",
     "'-c', 'approval_policy=\"never\"',",
     "",
     "a request can block on an approval prompt nobody answers", 6),
    ("adapter",
     "detached: true,",
     "detached: false,",
     "a cancel leaves the tool's children running", 3),
    ("adapter",
     "env: authenticationEnvironment(),",
     "env: process.env,",
     "the CLI can read the database URL and every API key", 2),
    ("adapter",
     "if (execution?.workingDirectory !== 'isolated-temporary-directory' || execution?.environment !== 'authentication-only') {",
     "if (false) {",
     "a caller can run the CLI in the repository", 1),
    ("adapter",
     "if (stdout.length > maximumOutputBytes) {",
     "if (false) {",
     "a runaway CLI grows the API process without limit", 4),
    ("adapter",
     "await rm(directory, { recursive: true, force: true });",
     "void directory;",
     "temporary directories and their contents accumulate", 1),
    ("availability",
     "  /is not installed or not on PATH/i,",
     "  /./,",
     "every failure counts as unavailable, so bad answers fall back", 10),
    ("output",
     "  if (!frames.some(frame => frame.type === 'turn.completed') || !messages.length) {",
     "  if (false) {",
     "half an answer from an interrupted turn is used as the answer", 13),
    ("output",
     "    return stdout.trim().length > 0;",
     "    return false;",
     "unparseable output is assumed to be no work, so work runs twice", 11),
    ("run",
     "  if (first.state !== 'failed' || first.didWork || !runtimeUnavailable(first.error)) return first;",
     "  if (first.state !== 'failed') return first;",
     "any failure falls back, including one that already did work", 10),
    ("run",
     "  if (!Number.isFinite(task.timeoutMs) || task.timeoutMs <= 0) {",
     "  if (false) {",
     "a task with no timeout can hang a request forever", 12),
    ("contract",
     "      const missing = labels[field].filter(label => !order[field].includes(label));",
     "      const missing: string[] = [];",
     "a label missing from the capability order is accepted, so it sorts weakest", 8),
    ("contract",
     "  if (new Set(contract.fallbackOrder).size !== contract.fallbackOrder.length) {",
     "  if (false) {",
     "a runtime repeated in the fallback order is accepted", 8),
]

def main() -> int:
    survived = []
    for key, old, new, label, invariant in MUTATIONS:
        path = PATHS[key]
        try:
            original = open(path).read()
        except OSError as error:
            print(f"SKIP (no file {path}): {label}"); continue
        if original.count(old) != 1:
            print(f"SKIP (pattern not unique in {path}): {label}")
            continue
        try:
            open(path, "w").write(original.replace(old, new))
            result = subprocess.run(TEST_COMMAND, capture_output=True, timeout=600)
            if result.returncode:
                print(f"caught   [inv {invariant}]: {label}")
            else:
                print(f"SURVIVED [inv {invariant}]: {label}")
                survived.append((invariant, label))
        finally:
            open(path, "w").write(original)
    print()
    if survived:
        print(f"{len(survived)} guard(s) have no test behind them:")
        for invariant, label in survived:
            print(f"  invariant {invariant}: {label}")
        return 1
    print("Every mutation was caught.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
