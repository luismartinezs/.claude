# Porting the agent runtime

Work in this order. Each step ends with something that runs, so a stall never
leaves the target half-wired.

## 0. Decide, and write the decision down

Answer the table at the top of `SKILL.md`. If the app needs a plain model call,
stop here and say so — porting this into an app that generates text is a
subprocess, a credential file and a renewal timer bought for nothing.

If it is a mixed app, name in one sentence which calls move and which stay. Put
that sentence in the project's decisions document. Six months later the question
"why does this app have two model clients?" needs an answer that is not
archaeology.

## 1. The capability table

Copy `reference/contracts/agent-selection.json` into the target's contracts
package, unchanged, **including its `source` block**.

Then check it is still true, because it is a measurement with a date on it:

```
claude --help | grep -A2 -- --model
claude --help | grep -A2 -- --effort
codex --help
cat ~/.codex/models_cache.json 2>/dev/null | head
```

If a label has appeared or gone, update the table, update `measured`, and point
`source` at this repository and this file — the copy is now the origin for
whoever copies it next. **Then tell the other repositories.** See "Drift" below.

## 2. The contracts

Copy `reference/contracts/agent.ts`. Adapt the imports (the target's `idSchema`
or equivalent), keep the `superRefine` bodies. Port the image half only if the
app sends images.

Export `agentSelectionSchema` from the contracts package so the SPA's selector
and the API's validation read one definition.

## 3. The runtime

Copy `reference/runtime/*` into one folder under the API's platform layer —
`apps/api/src/platform/agent/` in a doctrine-shaped repo. It is platform, not a
domain: it has no business rules, and no domain may import another domain to
reach it.

Keep the split. `process.ts` being a separate port from `process-adapter.ts` is
what lets every other file be tested without a CLI on the machine, and collapsing
them costs the whole `run.test.ts` suite.

Wire one task end to end before doing anything else:

```ts
const health: AgentTask<{ ok: boolean }> = {
  name: 'runtime-health',
  schema: z.object({ ok: z.boolean() }),
  timeoutMs: 60_000,
};
const outcome = await runAgentTask(
  createAgentProcessAdapter(), health, defaultAgentSelection(),
  'Answer with ok: true.',
);
```

Run it against both runtimes on the workstation before writing a real task. A
failure here is a CLI, a flag or a login, and it is much cheaper to find now.

## 4. Tasks

An `AgentTask` is the app's half. For each one:

- **Size the timeout from the work**, not from a round number. A task that returns
  a large document from an input that keeps growing needs minutes, and a timeout
  throws away everything the run had already produced. pawaspec's numbers: 30
  minutes to write a whole specification, 15 for a long read-and-answer, 5 for a
  short one.
- **Leave `tools` at `'none'`** unless the task needs them. If it does, say in a
  comment what for. A task with tools can have effects outside the process, which
  is what makes invariant 11 matter.
- **Keep the schema small and flat where you can.** Every optional property costs
  a Codex repair on the way out and on the way back; a top-level union costs an
  envelope.
- If the app routes tasks to different models, put the table in one file with a
  comment saying it is a starting point to tune from logs rather than a
  measurement. `pawaspec/packages/spec/src/agents/routing.ts` is the worked
  example.

## 5. Selection storage and the SPA

Store the selection as three columns or one jsonb, validated by
`agentSelectionSchema` on the way in. Never accept a model string from a request
body without it.

For the selector UI, port `port-agent-chat` — it reads the same contract.

## 6. Credentials and operations

Follow `reference/ops/credentials.md`:

1. Log in once as the app user on the box.
2. Confirm the API process reaches that home (`HOME` in the unit, or
   `CLAUDE_CONFIG_DIR` / `CODEX_HOME`).
3. Add the renewal timer and the `flock`.
4. Add the health check to the app's health screen, with the threshold derived
   from the renewal window.

Do not skip 4. A stopped renewal timer is silent until every agent request fails
at once, which per the project's own bitter lesson is the worst kind of failure
this codebase has.

## 7. Verification gate

In order. Do not report the port done before the last line passes.

```
# 1. Types, under the target's strict settings.
./check

# 2. The ported tests.
./test

# 3. The mutation check: every guard must have a test behind it.
python3 verify/mutate.py     # after editing PATHS and TEST_COMMAND

# 4. Runtime evidence: both runtimes answer the health task on this machine.
bun <the health task above>
```

The reference was verified this way before shipping: 77 tests pass, `tsc` is
clean under `strict` with `noUncheckedIndexedAccess`, and all 18 mutations are
caught. Anything the target's `mutate.py` prints as SURVIVED is a guard the port
described but did not keep.

**A port that skips step 3 has not been verified.** The tests can all pass
against code with the isolation removed; that is precisely what the mutation
check exists to find, and it found five such gaps while this reference was being
written.

## Adapting, and what must not be adapted

Adapt freely: file placement and granularity, naming, how the selection is
stored, error message wording, how tasks are queued, which tasks exist, the
routing table, whether images or skills are supported at all.

Do not adapt: the isolation set (empty temp cwd, env allowlist, own process
group, output cap, the execution contract check), validating a selection before it
reaches argv, the unavailable-versus-bad-answer split, the did-work check before
a fallback, and both schema repairs. Each is one line to remove and each has a
failure mode that is silent, expensive, or both.

## Drift

Nothing here pushes a fix back to the other repositories. That is the accepted
cost of copying instead of publishing, and it is only acceptable with a habit
attached:

1. **When you fix a bug in a ported copy, fix `reference/` in the same session.**
   Not "later" — the session that found it is the only one that still knows why.
2. **When you change the capability table, say so.** The apps carrying a copy
   today are `upkeepo`, `pawaspec`, `pawalist`, `pawacook-v2` and
   `upkeepo-business`. A one-line note in each project's decisions document, with
   the new `measured` date, is enough.
3. **The `source` block is how a copy is checked.** To see whether a copy has
   fallen behind:

   ```
   cd ~/dev/<origin-repo> && git show <commit>:<path> | sha256sum
   ```

   A hash that still matches means the copy is current. This is not theoretical:
   pawaspec's recorded hash of upkeepo's table still matched when this skill was
   written, months later, even though the commit had moved on.

A known gap, deliberately left: there is no tool that finds every copy and
reports which are stale. If the copies ever outgrow the habit, the smallest thing
that would help is a script in `~/dev/shared-infra` that walks `~/dev/*`, reads
each `agent-selection.json`'s `source`, and prints the ones whose hash no longer
matches the origin. Write it when the habit fails, not before.
