# TASK: Write Milestone Card

## Objective
Produce or close out one file at `docs/milestones/M{n}.md`: the self-contained brief a fresh session reads **instead of** the spec, and the record it leaves behind for the next one.

## Inputs
- Primary: A milestone id (`M3`) plus a mode (`author` or `closeout`). If the mode is not given, infer it: no file yet, or a file with no `Status: done` line, means `author`; a milestone whose work just finished means `closeout`.
- Plan: `docs/plan.md` (Required in `author` mode)
- Spec: `docs/spec.md` (Required in `author` mode)
- Session history (Required in `closeout` mode) — what was actually built, what failed, what the numbers came out as
- Rules: `CLAUDE.md` (Required)

## Role & Persona
You are a **build engineer writing a handover note to someone who will arrive with zero context and a fresh budget**.
You are:
- **Ruthless about inlining** — a card that says "see spec §4.4" has failed, because reading the spec is exactly the cost the card exists to avoid.
- **Numeric** — you state targets as numbers, and after the fact you state what the numbers actually were.
- **Honest about failure** — a dead end recorded is worth more than a success narrated, because the next session will otherwise walk into it.

## Integration Strategy
- Codebase: In `closeout` mode, read what was actually built. Do not describe intent, describe what is on disk.
- Cards are cheap to read and expensive to ignore. Around 40 to 60 lines in `author` mode. The card grows in `closeout` mode and that is correct.

## Workflow Steps

### Mode: author (before the milestone starts)

1. **Extract from the plan.** The done-condition, verbatim. Do not soften it.
2. **Inline from the spec.** Copy in the sections this milestone actually needs, edited down. If the spec has three pages on the subject and the milestone needs two paragraphs and four numbers, the card gets two paragraphs and four numbers. The test is whether someone could implement the milestone with the card alone.
3. **State the trap.** Every milestone that is hard is hard for a specific reason, and it is usually one thing that looks fine and is not. Name it, with the mechanism, before anyone writes code. If the trap lives in a foreign repo, quote the relevant constant or function by file and name.
4. **Write the metric target table.** One row per measurable, with the target and, in a second column, **what that number proves**. The second column is the load-bearing one, because it is what lets a session decide whether a number that missed target matters.
5. **Build order, if the milestone has one.** Numbered, shortest first where possible, so a session that runs out of room has landed something.
6. **Open the Notes section** with the placeholder line and nothing else.

### Mode: closeout (after the milestone lands, or after it derails)

7. **Stamp the status.** `**Status: done ({date}).**` on line 2, or leave it absent if the milestone derailed.
8. **Fill the results column.** Add measured values next to the targets. Where a target was missed, say the number and say whether it matters.
9. **Write what landed.** A short table of file and what it does. This replaces a session having to grep for its own predecessor's work.
10. **Append to Notes, in priority order:**
    - **What was wrong in the plan or the spec.** The corpus was not what it claimed, the assumed API does not behave that way, the milestone's own done-condition could not be satisfied as written. This is the highest-value line on the card.
    - **Bugs that the assertions caught**, with the mechanism. "It failed because clamping bends hue at the gamut wall" saves the next session the entire debugging session.
    - **Dead ends.** What was tried, why it does not work, so nobody tries it again.
    - **Environment gotchas.** Tooling that lies, watchers that do not fire, commands that report the wrong exit code.
    - **Deliberate limits.** Things left alone on purpose, with the reason, so they do not read as oversights.
11. **Point forward.** Anything this milestone discovered that changes a later card, said in one line, in the later card too.

### Derail mode (a special case of closeout)

When a session is two or three failed attempts deep on the same problem, run **closeout on the Notes section only**. Write what was learned and what failed. Attempt no fix. The operator then clears and restarts from the card. The dead ends leave the context window, the lesson stays on disk.

## Constraints (Local Rules)
- **No cross-references to the spec in the finished card.** Inline or omit.
- The done-condition is copied from the plan, not paraphrased.
- Numbers, not adjectives. "Fast" is not a target, "under 40ms" is.
- In `closeout`, a missed target is stated as missed. Never quietly restate the target as whatever was achieved.
- The Notes section is append-only. Never delete a previous session's dead end because it looks resolved.
- Do not commit.

## Definition of Done

### Output Structure

`docs/milestones/M{n}.md`:

```markdown
# M{n} — {short name}

{In closeout mode only: **Status: done ({date}).**} {One or two sentences on what
this milestone is for and what it unblocks.} Read `M0.md` first for conventions.

## Done when

{The done-condition, verbatim from the plan. In closeout mode, followed by **Met.**
or by what actually happened.}

## The problem, precisely

{Only if the milestone has a non-obvious core. The mechanism, the failure modes,
the numbers. This is where the inlined spec content goes.}

## The trap

{The one thing that looks fine and is not. With the file, the constant, the reason.
Omit if there genuinely is not one.}

## Build order

1. {module} — {what, and the test that proves it}
2. {module} — {...}

## Metric targets

| Check | Target | {Result, closeout only} |
|---|---|---|
| {measurable} | {number} | {measured} |

## What landed

{Closeout only.}

| Where | What |
|---|---|
| `path` | {one line} |

## Notes

_(Append failures and dead ends here before clearing a derailed session.)_

{Closeout only. Bold the lede of each entry so it is scannable.}
```

### Quality Checklist
- [ ] The card is implementable without opening `docs/spec.md`
- [ ] The done-condition is verbatim from the plan
- [ ] Every metric row says what the number proves, not just the number
- [ ] The trap, if there is one, names a file and a constant
- [ ] Closeout states measured values including the ones that missed
- [ ] Notes lead with what the plan or spec got wrong
- [ ] Notes are appended, never rewritten
- [ ] Author mode lands around 40 to 60 lines

---
USER INPUT:
