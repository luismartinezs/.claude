# Workflow: Plan Buildout

## Starting State
A product idea exists, rough or refined. The build is large enough that it will not fit in one Claude Code session, and probably not in ten.

## End State
`docs/spec.md`, `docs/plan.md`, `docs/milestones/M0.md`..`Mn.md`, `docs/runbook.md` and `docs/ladder.json` exist. The operator can execute the whole build by pasting one prompt per session and clearing between them, without reloading the spec.

## When to use this
Greenfield or a large subsystem, where the work spans many sessions and the expensive part is not writing code but verifying it. If the work is one feature inside an existing codebase, use `wf:ship-feature` instead.

## Scope, stated honestly
This covers the portion of a build whose correctness a script can decide. It does not cover work whose done-condition is human judgment, and `plan-milestones` is required to name the milestone where that starts. Past that line the runbook stops being a ladder and becomes a short-cycle loop.

## Tools Discovered
- Tasks: `product/refine-spec`, `engineering/plan-milestones`, `product/route-decisions`, `engineering/write-milestone-card`, `engineering/write-runbook`
- Gaps: Execution (Step 5) is driven by the generated ladder, not by a task. That is the point. `~/.claude/orchestrator` runs it; `/build` is the cockpit.

## Steps

1. **Refine Spec**
   - Input: Rough idea or draft spec
   - Task: `playbooks/tasks/product/refine-spec.md`
   - Output: `docs/spec.md`, unambiguous
   - Gate: User confirms before proceeding.
   - Skip condition: A detailed spec already exists.

2. **Plan Milestones**
   - Input: `docs/spec.md`
   - Task: `playbooks/tasks/engineering/plan-milestones.md`
   - Output: `docs/plan.md` with the verification bottleneck named, milestones ordered, done-conditions written, taste boundary marked
   - Gate: User approves the sequence and the taste boundary. A milestone whose done-condition could not be written is resolved here, not later. Read the check commands themselves, not just the milestone names: running unattended they are the only thing between a wrong build and a green one.

3. **Route Decisions**
   - Input: `docs/plan.md` + `docs/spec.md`
   - Task: `playbooks/tasks/product/route-decisions.md`
   - Output: `docs/decisions.md`, at most five questions that are genuinely yours, each with a recommendation and a default that fires on silence. Everything else is decided for you and listed.
   - Gate: Answer them, or let the defaults stand knowingly. This is the gate that replaces "read the plan and approve it", because approving a document is not a decision and answering five questions is.
   - Why here: the answers change the cards, and the cards are written next.

4. **Write Milestone Cards**
   - Input: `docs/plan.md` + `docs/spec.md`
   - Task: `playbooks/tasks/engineering/write-milestone-card.md`, mode `author`, once per milestone
   - Output: `docs/milestones/M0.md`..`Mn.md`
   - Constraint: Author cards only up to the taste boundary in the first pass. Cards past it are written when their milestone arrives, since the earlier milestones will change what they should say.
   - Gate: Spot-check one card by asking whether the milestone could be implemented from it alone. If not, the card is not done.

5. **Write Runbook**
   - Input: `docs/plan.md` + the cards
   - Task: `playbooks/tasks/engineering/write-runbook.md`
   - Output: `docs/runbook.md`
   - Gate: Read every prompt and confirm it is pasteable with zero edits.
   - Note: Run steps 2 through 5 in the same session. They share the same files and clearing between them costs a full reload of the spec.

6. **Execute**
   - Input: `docs/ladder.json` under the orchestrator, or `docs/runbook.md` by hand.
   - Task: none, by design.

   **Automated, the default.** Run `/build`. The orchestrator starts one fresh
   session per rung, so clearing happens by itself, then runs that rung's check
   in a clean shell after the session has ended and commits only what its own
   check passed. It stops and pings you for four reasons and no others: a rung
   whose oracle is your judgement, three failed attempts on one rung, a check
   that was already green before the work started, and the budget.

   On a failed attempt it writes the session's Notes into the card, commits those
   on their own, discards the code, and starts the next attempt from the card plus
   those notes. That is the derail protocol, run by the loop.

   **By hand.** Paste the prompt, check the done-condition, clear. Closeout is
   carried inside the rung's own prompt, so the agent writes the card's results
   and Notes before it stops. The operator is never asked to remember a second
   command. On derail: `/task write-milestone-card M<n> derail` (Notes only, no
   fix attempt), then clear and restart from the card.

## Gaps & Recommendations
- **This is extracted from one project.** Until it has produced a usable runbook on a second, unrelated build, treat the tasks as a draft. The signal to watch is Step 4: if the emitted runbook needs heavy hand-editing, those edits are the real content and belong back in `write-runbook.md`.
- **Closeout is the load-bearing half of Step 5 and the easiest to lose.** A card without its Notes is a brief; a card with them is a handover. It is inside the rung prompt for that reason. If you ever hand-edit a rung, do not drop those lines.
- **Derail no longer needs you, when the orchestrator is driving.** The claim it
  replaced, that an agent cannot reliably notice it is three attempts deep, is
  true inside a context and false outside one. The counter lives in the loop, not
  in the model. Running the ladder by hand, the call is still yours.
- **The checks are now the whole safety budget.** Driving by hand you inspect
  every rung, shallowly. Under the orchestrator nothing is inspected and the
  oracles are exact, which is a better trade only while the oracles are good. The
  operator attention this frees belongs in `plan-milestones`, sharpening checks.
