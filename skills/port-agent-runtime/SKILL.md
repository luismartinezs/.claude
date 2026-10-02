---
name: port-agent-runtime
description: Port an agent runtime that runs coding-agent CLIs (Claude Code, Codex) as subprocesses against the operator's own subscription instead of a metered API, with a runtime/model/effort selection contract, structured JSON output, per-runtime schema repair, isolation, cancellation, timeouts, unavailability fallback, and box-side credential renewal. Use when asked to add agentic work, an agent runtime, agent selector, "use my Claude Code / Codex subscription", "run claude -p / codex exec from the server", subscription credentials on a VPS, or to review an existing CLI-spawning integration. Contains the reference implementation, the capability fact table with provenance, isolation invariants, porting steps, real tests with a stub adapter, and a mutation check that proves every guard survived the port.
---

# port-agent-runtime: coding-agent CLIs as the app's model runtime

You are porting an agent runtime into the current codebase. It spawns `claude`
or `codex` as a subprocess, so the work is paid for by the operator's existing
subscription rather than per token.

The code in `reference/` is ONE instantiation (Hono API on Bun or Node, Zod
contracts package, Postgres, Vue SPA). Adapt placement, granularity, naming and
plumbing to the target. Do NOT impose the reference folder structure. The
**invariants** are what must survive; each one is pinned by a test you port
with the code.

Architecture doctrine: `/home/luis/claymore/coding/software-architecture.md`.
Deployment doctrine: `/home/luis/claymore/coding/infra.md`.

## FIRST: decide whether this belongs in the app at all

This skill is not the default way to call a model. It has real costs: a
subprocess per request, minutes of latency, credentials on the box, a renewal
timer, and a CLI whose flags change under you. Pay them only when you need what
they buy.

Answer these before porting anything:

| Question | Yes → | No → |
|---|---|---|
| Does the work need tools — read files, run commands, search, iterate against a result? | agent runtime | plain model call |
| Is the result a *judgement about a changing world* rather than generated text? | agent runtime | plain model call |
| Would a single prompt-and-parse round-trip do? | plain model call | agent runtime |
| Does a human wait on it in under ~10 seconds? | plain model call | agent runtime |
| Is it a typed decision (classify, route, gate, score)? | Jev, `skills/jev` | — |

Worked examples from this operator's own repos:

- **pawacook generates recipes.** One prompt, one structured answer, no tools.
  A plain model call. Do **not** port this skill into it.
- **upkeepo solves coding problems.** It reads a repository, runs commands, opens
  PRs. Agent runtime, and the reason the whole pattern exists.
- **pawaspec writes and audits a specification.** Long single responses under a
  strict schema, no tools needed — but 30-minute generations where subscription
  pricing changes the economics. Agent runtime, `--tools ''`.
- **upkeepo-business tags events.** Jev decides the event type. Neither this
  skill nor a plain call. Leave it.
- **upkeepo-business judges precision** (`evaluate.ts#callModel`). A stronger
  model re-reads a stored page and agrees or not. One call, no tools — a plain
  call today, and a candidate for this skill only because it runs unattended on
  a schedule where per-token cost accumulates.

**Mixed is normal and correct.** An app may hold an agent runtime, a plain
OpenRouter client and a Jev client at once. They are three different tools.
Porting this skill never means removing the others: transcription, embeddings,
typed decisions and cheap high-volume calls all stay where they are, because no
CLI serves them.

## What the feature is

- **A selection** is `{runtime, model, effort}`. `runtime` is `claude-code` or
  `codex`; the models and efforts each one accepts are a **measured fact**, held
  in `reference/contracts/agent-selection.json` with the provenance of where it
  was measured. The app validates every selection against it.
- **An invocation** turns a selection plus a JSON schema into a command line:
  `claude -p --output-format stream-json …` or `codex exec --json …`. All flag
  knowledge lives in one function (`invocation.ts`) and nowhere else.
- **A run** hands that command line to the process adapter, which executes it in
  an empty temporary directory with an allowlisted environment and its own
  process group, feeds the request on stdin, and enforces a timeout and a
  cancel.
- **The output** is one structured JSON object matching a schema the caller
  supplies. Each runtime wraps it differently and each has schema quirks that
  must be repaired before validation (`output.ts`).
- **Unavailability** — not installed, signed out, out of usage — is distinct
  from a bad answer. Only unavailability moves an `auto` request to the next
  runtime. A weak answer is a result.
- **Credentials** are a subscription login on the box, renewed by a timer, with
  a health check that reads whether the timer is working (`ops/credentials.md`).

## Invariants

Every one of these has a test in `reference/tests/`. If the port drops a test,
it dropped an invariant.

### Isolation — the subprocess is not trusted with the operator's machine

1. **The working directory is a fresh empty temporary directory**, created per
   run and removed in a `finally`. Never the repository, never `HOME`, never a
   path the caller chose. A CLI that decides to write a file writes it somewhere
   that is about to be deleted.
2. **The environment is an allowlist**, never `process.env`. Only what the
   tool's own authentication needs: `PATH`, `HOME`, `USER`, `LOGNAME`, `LANG`,
   `TMPDIR`, `CODEX_HOME`, `CLAUDE_CONFIG_DIR`, `CLAUDE_CODE_OAUTH_TOKEN`. The
   app's database URL, Stripe key and API tokens must not be reachable from a
   process that just read a third-party web page.
3. **The child gets its own process group** (`detached: true`), and a cancel
   sends the signal to `-pid`. Killing only the CLI leaves the models, sandboxes
   and shells it started running. This is the difference between Stop working
   and Stop appearing to work.
4. **Output is capped** (`maximumOutputBytes`). A runaway CLI must not grow the
   API process until the box swaps.
5. **The adapter refuses a run whose execution contract is not the isolated
   one.** `workingDirectory: 'isolated-temporary-directory'` and
   `environment: 'authentication-only'` are passed as literal types and checked
   at runtime, so a future caller cannot quietly ask for the repository as cwd.
6. **Tools are off unless the task needs them.** `--tools ''` for Claude Code;
   `--sandbox read-only`, `approval_policy="never"` and the disabled feature
   list for Codex. A task that needs tools turns them on explicitly, and says in
   a comment what it needs them for.
7. **No user configuration is inherited.** `--strict-mcp-config` with an empty
   `--mcp-config`, `--settings '{"disableAllHooks":true}'`, `--setting-sources ''`
   for Claude; `--ignore-user-config --ignore-rules --ephemeral` and
   `project_doc_max_bytes=0` for Codex. Otherwise the answer depends on whatever
   `~/.claude.json`, `AGENTS.md` or a hook on the box happens to say, and the
   same request gives different results on a workstation and on the box.

### Correctness

8. **The capability table is measured, not remembered.** Models and efforts come
   from the frozen contract; a selection outside it is rejected at the boundary.
   Never accept a model string straight from a request.
9. **A selection is validated before it reaches a command line.** String
   interpolation of an unvalidated model or effort into argv is how a selector
   becomes an argument-injection surface.
10. **Unavailability is matched on patterns, and only it triggers fallback.**
    `runtimeUnavailable` in `availability.ts`. A schema violation, a weak answer
    or a refusal is a result the caller decides about — retrying it silently
    doubles the spend and hides the problem.
11. **Work must not run twice.** Before moving to another runtime, check that
    the first produced no output and no tool activity. `isAgentActivity` exists
    because a runtime that already started working and then hit a limit has
    done real, possibly externally visible work.
12. **A timeout is a failure with a number in it.** Say which selection, and how
    long it was given, in the message. "The agent failed" sends whoever reads it
    to the wrong place.
13. **Every runtime's schema quirks are repaired in one place**
    (`output.ts`): neither CLI accepts a top-level union, so unions travel
    inside `{result}`; Codex requires every object property to be listed in
    `required`, so optional properties become `anyOf: [T, null]` on the way out
    and the nulls are stripped on the way back. Discovering this per call site
    is how one task starts working and its neighbour does not.
14. **A cancel is observable.** The request that was cancelled ends as
    `canceled`, not as a failure and not as a success with no output.

### Operations

15. **Credentials are a measurement, not a schedule.** Remaining token life says
    whether the renewal timer is working. The remedy for a low number is to look
    at the timer, and the message must say so. See `ops/credentials.md`.
16. **One process owns renewal, under an OS lock.** Concurrent starts must not
    each run a refresh; `flock` and re-read.
17. **Nothing in a log or an error message contains a token.** Credential
    failures name a remedy (`AGENT_CLAUDE_LOGIN_REQUIRED: log in once as the app
    user with claude auth login`), never a value.

## Reference map

```
reference/
  contracts/
    agent-selection.json   the measured capability table, with provenance
    agent.ts               selection + image schemas, validated against it
  runtime/
    process.ts             the adapter port (so the runtime tests with a stub)
    process-adapter.ts     the real subprocess: isolation, groups, caps
    invocation.ts          THE ONLY place that knows CLI flags
    output.ts              per-runtime parsing and schema repair
    availability.ts        unavailable-vs-bad-answer, and the fallback order
    run.ts                 one run: timeout, cancel, parse, validate
  ops/
    credentials.md         subscription login on the box, renewal, health
  tests/
    invocation.test.ts     flags, validation, injection
    output.test.ts         envelopes, quirks, failure frames
    availability.test.ts   which errors fall back
    run.test.ts            timeout, cancel, isolation contract, caps
  verify/
    mutate.py              breaks each guard; the tests must go red
```

Read `PORTING.md` for the order of work and the verification gate.
