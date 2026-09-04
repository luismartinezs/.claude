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

## Cost

The four numbers in each card's Cost table are filled in by the orchestrator
from what it actually saw: wall clock from the process, verify runs and duration
from its own checks, restarts from the retry count. Nothing is estimated, and
the `date -Iseconds` line at the top of every rung prompt is no longer needed.

## Notifications

Pushed to the same ntfy topic as `hooks/notify-phone.sh`, read from that file so
the topic is not duplicated into a tracked one. `ORCHESTRATOR_NO_NOTIFY=1` mutes it.
