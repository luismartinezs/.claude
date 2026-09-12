# orchestrator

Runs a `plan-buildout` ladder without you sitting there clearing and pasting.

One fresh `claude -p` session per rung, which is what makes the clearing free: a
new process is a new context. After the session ends the orchestrator runs the
milestone's check itself, in a clean shell, and only commits if that check
passes. The agent is never asked whether it is done.

## Use

```
cd project-xyz
build
```

That is the whole interface. In a project with nothing in it, `build` plans
first: it hands you a session for the spec interview, works out the milestones
and their checks on its own, comes back to you with the check list and at most
five product decisions, then writes the cards, the runbook and the ladder. From
there it builds, and you are not involved again unless it asks.

In a project that already has `docs/ladder.json` it skips straight to building.
Interrupt it whenever; `build` again picks up where it stopped.

The ladder it starts with is not the whole job. Cards past the taste boundary
are written when their milestone arrives, because each milestone teaches the
next one what its card should say, so `docs/ladder.json` covers a prefix of
`docs/plan.md` and grows. When the rungs run out, `build` asks the plan whether
anything is left. If something is, it writes that milestone's card, puts its
rung on the ladder and carries on. It says complete only when the plan has
nothing left in it.

The other three commands exist for the moments it asks you something:

```
build answer S4 pass
build answer S4 fail "the right edge drifts"
build status
build reset S4
```

`orchestrator` is the same program under its own name, if you prefer it.

## Phases

| | | |
|---|---|---|
| P0 | spec | you and a session, talking |
| P1 | plan | on its own |
| P2 | decisions | you, on the checks and at most five product calls |
| P3 | cards | on its own |
| P4 | runbook and ladder | on its own |
| S0..Sn | the build | on its own, until it asks |
| X\<M> | the next card and its rung | on its own, whenever the rungs run out before the plan does |

Exit codes: `0` complete, `10` waiting on you, `1` it could not proceed.

## When it stops and pings you

| | |
|---|---|
| **human** | The rung's oracle is your judgement. It ran the work, now it wants a verdict. |
| **derail** | Three attempts failed. Every attempt's notes are in the card. |
| **tautology** | The check was already green before any work happened, so it is not measuring the milestone. |
| **budget** | `budgetUsd.total` reached. |

Everything else it handles alone. A first or second failed attempt is not a ping.

## Rules it keeps

- **The agent never commits.** The orchestrator commits, once per rung, after its
  own check passes, and tags the commit with the rung id. So every commit on the
  branch is one that passed an oracle.
- **A failed attempt keeps its lesson and loses its code.** The session appends
  what failed to the card's Notes, that gets committed on its own, then the code
  is discarded and the next attempt starts fresh from the card plus those notes.
- **It refuses to build on `main`.** `ladder.branch` has to be a build branch.
- **It refuses to start on a dirty tree.**
- **The check runs before the work too**, and has to fail. A check that is green
  before anything is built would let the ladder march straight past the milestone.
- **Finishing the rungs is not finishing.** Every milestone `docs/plan.md` names
  gets a rung before the build is called complete. `X<M>`'s own check asserts
  both halves of its job: the card exists, and `docs/ladder.json` now has a rung
  covering that milestone. Three failed attempts at it park like any other rung.

## Tests

```
bun test
```

Eleven scenarios, twelve seconds, no tokens. Each one drives the real `run.ts`
in a real throwaway git repo; the only thing that is not real is the session.
That substitution is honest rather than convenient, because the orchestrator
never asks a session whether it is done. It asks a check, in a clean shell,
and a process that writes the files a real session would have written is
indistinguishable from one that thought about it first.

`test/fake-claude.ts` is that process. Behaviour comes from a JSON array of
steps matched against the prompt, so a scenario can make a session build a
milestone, grow the ladder, raise a question, fail twice and land on the third,
or hit a usage limit. It lives outside the repo under test, because a failed
attempt runs `git clean -fd` and a harness inside the working tree would be
deleted by the very rule it is there to check.

What is covered: planning from an empty repo through both conversations,
growing the ladder past the taste boundary, a human oracle taking a rejection
and then a pass, the question mailbox, a derail after three attempts, a check
that was green before the work, a usage limit giving the attempt back, the
budget, the refusal to build on `main`, an extension that writes a card but no
rung, and the app serving what the orchestrator wrote. The first test asserts
that the shim really does shadow the installed `claude`, so the suite fails
rather than silently starts spending if it ever stops.

## Cost

The four numbers in each card's Cost table are filled in by the orchestrator
from what it actually saw: wall clock from the process, verify runs and duration
from its own checks, restarts from the retry count. Nothing is estimated, and
the `date -Iseconds` line at the top of every rung prompt is no longer needed.

## Notifications

Pushed to the same ntfy topic as `hooks/notify-phone.sh`, read from that file so
the topic is not duplicated into a tracked one. `ORCHESTRATOR_NO_NOTIFY=1` mutes it.
