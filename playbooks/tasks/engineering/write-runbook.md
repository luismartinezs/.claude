# TASK: Write Runbook

## Objective
Produce `docs/runbook.md`: the operator's execution procedure for `docs/plan.md`. A session ladder with copy-pasteable prompts, an explicit rule for when to clear context, and the recovery procedure for a derailed session.

## Inputs
- Primary: `docs/plan.md` (Required)
- Cards: `docs/milestones/*.md` (Required)
- Rules: `CLAUDE.md` (Required)

## Role & Persona
You are writing **for a single human operator driving an AI coding agent**, not for the agent.
You are:
- **Operational, never advisory** — the output is a procedure with literal text to paste. A list of principles is a failed runbook.
- **Specific about boundaries** — you say where one session ends and the next begins, and why.
- **Blunt about what does not work** — the section on what to skip saves more time than the section on what to do.

## Integration Strategy
- Read the plan for the milestone sequence and the taste boundary.
- Read each card for its done-condition, because the operator's check comes from there.
- Read `CLAUDE.md` for standing rules that must be repeated in every prompt (commit policy above all).

## Workflow Steps

### 1. Open with why this file exists

Two or three sentences naming this project's specific verification bottleneck, taken from the plan. Not generic advice about context. If the operator does not understand why the ladder is shaped this way, they will improvise and the shape is the whole value.

### 2. State the clear rule

One rule, stated once, in bold:

> **Clear when the next task needs a different set of files open than the one you just finished.** Not on a timer. Not when the conversation feels long.

Then the reason `/clear` beats `/compact` at a milestone boundary: compaction is a lossy summary you pay for once and throw away, while the same tokens spent filling in a milestone card produce an artifact every future session reads cheaply.

### 3. Build the ladder

> **PROTOCOL: Session Batching**
> One session per row. Decide the rows by asking, for each pair of adjacent
> milestones or modules: **do these need the same files open?**
> - **Batch** work that is pure, signature-driven, and carries no domain context.
>   Several such modules in one session cost barely more than one.
> - **Isolate** anything with real domain context, anything touching a second repo,
>   and anything hard enough that failed attempts will accumulate.
> - **Never batch** past the taste boundary. Short cycles, one thing at a time.

Each row gets:
- A heading with the session number and what it does
- A fenced code block with the **literal prompt to paste**, ending in the closeout line and then `No commits.`
- A **Check:** line naming what the operator verifies, taken from the card's done-condition
- **Then clear.**

Prompts reference the card, never the spec. That is what keeps them short. `Implement slices/{x}.ts per docs/milestones/M{n}.md. Tests first.` is a complete first line when the card is good.

> **PROTOCOL: Closeout Belongs In The Prompt**
> The milestone card is only worth writing if its Notes get filled in, and Notes
> get filled in at exactly the moment the operator most wants to move on. An
> operator who has to remember a second command after the work is done will not
> remember it. So the reminder does not go in a checklist, it goes in the text
> being pasted, and the agent does it unprompted before the session ends.
>
> Every rung's prompt therefore carries this as its second-to-last line, verbatim:
>
> ```
> When the done-condition is met, close out docs/milestones/M{n}.md: measured
> results next to the targets, what landed, and append to Notes what the plan or
> the spec got wrong. Then stop.
> ```
>
> `Then stop.` is load-bearing. It keeps the agent from rolling into the next
> milestone in a context that is now full of this one.

Session 0 is the exception: it runs in whatever session already has the plan loaded, since re-loading the plan into a fresh session is pure waste.

### 4. Write the derail procedure

The trigger, stated as a count: two or three failed attempts on the same problem. The reason: those failures sit in history costing tokens on every turn and biasing the next attempt toward the same dead end. Then the literal prompt:

```
Write what you learned and what failed into docs/milestones/<M>.md under "Notes".
Do not attempt a fix.
```

Then clear and restart from the card.

### 5. Handle the cards that do not exist yet

Cards are authored only up to the taste boundary in the first pass, so the ladder must not point at a file nobody wrote. The **last rung before the boundary** ends by authoring the next one, as part of the same prompt:

```
Then author docs/milestones/M{n+1}.md per playbooks/tasks/engineering/write-milestone-card.md,
using what this milestone actually taught you. Then stop.
```

That placement is deliberate. The session that just closed out M{n} is the only one holding the evidence that should change M{n+1}, and it is about to be cleared.

### 6. Standing conventions

Only rules that apply to every session, each with its reason in the same line. Always includes the commit policy. Include the project-specific ones the plan implies, for example how the agent is allowed to verify its own output, and how many slices may be in context at once.

### 7. What does not help

A short list of things that look like optimizations and are not, for this project. Subagent fan-out is almost always on it: it optimizes wall-clock and costs more tokens, because each agent re-grounds independently. Name the exception if there is one. `/compact` at a milestone boundary belongs here too.

### 8. Verify

Every prompt in the file must be pasteable with zero edits. Read each one and ask whether it would work verbatim in a fresh session that has read nothing.

## Constraints (Local Rules)
- **Every rung's prompt ends with the closeout line and then `No commits.`** No exceptions, including Session 0. A rung that ends at "Then clear." leaks the card's Notes.
- Prompts are literal and complete. No `{placeholders}` the operator must fill in, except a milestone id where the same prompt repeats.
- No prompt sends the agent to `docs/spec.md`. If a prompt needs the spec, the card is incomplete and that is the finding to report.
- The check on each rung is the operator's, not the agent's. Say what the human looks at.
- Do not restate the plan. The runbook is how, the plan is what.
- Under 200 lines. A runbook nobody rereads is not a runbook.

## Definition of Done

### Output Structure

`docs/runbook.md`:

```markdown
# {Project} — Build Runbook

How to execute `docs/plan.md` without burning context. Companion to `docs/spec.md`
and `docs/plan.md`. Written {date}.

## Why this file exists

{This project's verification bottleneck, in two or three sentences, and the two or
three things that fix it.}

## The one rule for `/clear`

**Clear when the next task needs a different set of files open than the one you
just finished.** Not on a timer. Not when the conversation feels long.

{Why clearing beats compacting at a milestone boundary.}

## The ladder

Copy the prompt, run it, check the signal, clear.

### Session 0 — {name}

{Any preconditions.}

```
{literal prompt}
When the done-condition is met, close out docs/milestones/M{n}.md: measured
results next to the targets, what landed, and append to Notes what the plan or
the spec got wrong. Then stop.
No commits.
```

**Check:** {what the operator verifies}. **Then clear.**

{... one section per session ...}

### Sessions {n} onward

```
Implement M{n} per docs/milestones/M{n}.md.
When the done-condition is met, close out docs/milestones/M{n}.md: measured
results next to the targets, what landed, and append to Notes what the plan or
the spec got wrong. Then stop.
No commits.
```

| Milestone | Your check |
|---|---|
| M{n} {name} | {the human-visible signal} |

**From M{n} on the pattern changes.** {The protocol past the taste boundary.}

## When a session derails

{Trigger, reason, the literal prompt, then clear.}

## Standing conventions

- **Never commit.** {...}
- {Project-specific rules, each with its reason.}

## What does not help

- {Anti-pattern, and why it costs more than it saves.}
```

### Quality Checklist
- [ ] Every prompt is literal, complete, carries the closeout line, and ends in `No commits.`
- [ ] No prompt references the spec
- [ ] Every rung has a human check drawn from a card's done-condition
- [ ] Session boundaries are justified by which files need to be open
- [ ] The taste boundary appears with its own protocol
- [ ] No rung points at a milestone card that does not exist yet; the rung before the boundary authors the next one
- [ ] The derail procedure has a stated trigger count and a literal prompt
- [ ] "What does not help" is present and specific to this project
- [ ] Under 200 lines

---
USER INPUT:
