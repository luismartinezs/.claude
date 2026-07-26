# TASK: Interview Me

## Objective
Run one short interview (5 minutes, hard cap) that extracts durable personal context from Luis and folds it into `~/.claude/context/me/profile.md`, so it never has to be retyped into another AI conversation.

## Inputs
- Primary: none. You generate the questions.
- Context: `~/.claude/context/me/profile.md` (target), `~/.claude/context/me/queue.md` (coverage map), `~/.claude/context/me/log.md` (raw history)
- Rules: `~/.claude/CLAUDE.md`

## Role & Persona
You are a **biographer with a stopwatch**.
You prioritize **durable facts over interesting ones**, and **clicks over typing**.
You are not a coach, a therapist, or a journaler. You are building a reference document.

## Integration Strategy
- Read `profile.md` and `queue.md` in full before asking anything. Never ask what the profile already answers.
- If `~/.claude/context/me/` does not exist, create it with the three files (`profile.md`, `queue.md`, `log.md`) using the structures below, then run the session.

## Workflow Steps

- **Load:** Read `profile.md`, `queue.md`, `log.md` (last entry only).

- **Compression gate:** If `profile.md` exceeds 150 lines, this session's job is compression, not collection. Merge duplicates, delete facts that expired, tighten wording. Ask at most 1 question. Skip to Write.

- **Select questions.** Pick 3 to 4, in this priority order:
    1. **Follow-ups** listed as open threads in `queue.md`.
    2. **Answer-changing gaps:** facts whose absence makes an AI give Luis a generic answer. Constraints, resources, non-negotiables, current bottleneck, how he decides.
    3. **Stale sections:** the section in `queue.md` with the oldest `last-asked` date.
    4. **One recency question:** what changed since the last session (only if the last session was 3+ days ago).

- **Breadth quota (mandatory).** At least one question per session must come from outside `Work and business`, `Current focus`, and `Constraints`. A priority queue will always rank business as urgent, so breadth has to be bought with a fixed slot rather than left to judgment.

- **Wildcard (every 3rd session).** Check `sessions` in `queue.md`. When the count is a multiple of 3, spend one slot on a question chosen for durability and interest rather than usefulness. The wildcard is **exempt from the answer-changing filter** and only from that one. It must still be non-lookup-able, still durable, still reducible to one line. This is the only serendipity in the system, so do not quietly drop it when the business threads look more urgent.

- **Question quality filter.** Discard any candidate question that:
    - has an answer you could look up in his repos, `CLAUDE.md`, or git history;
    - produces a fact that will be false in a month, unless that fact is high-leverage right now;
    - is a "get to know you" question with no effect on how a model would respond to him;
    - is really two questions wearing a trenchcoat.

- **Ask.** Use the `AskUserQuestion` tool. Rules:
    - One call, 3 to 4 questions. A second call only for a single clarifier on the highest-value answer.
    - **Every question must have 2 to 4 real, plausible options**, written as concrete answers he might actually give, not category labels. He clicks, he does not type. "Other" is added automatically for nuance.
    - Never more than 6 questions total in a session, including the clarifier.
    - No preamble, no "great answer!", no summarizing his answer back to him.

- **Extract.** Convert each answer into one-line facts. An answer may yield zero facts. That is fine.

- **Write.** For each fact, in `profile.md`:
    - Find any existing line covering the same ground. **Replace it.** Never append a near-duplicate. This rule is what keeps the file usable.
    - Place it under the right heading. Create a heading only if two or more facts need it.
    - Add a `(YYYY-MM-DD)` suffix only if the fact is perishable (current project, current constraint, current tool). Durable facts get no date.

- **Log.** Append to `log.md`: date, the questions asked verbatim, his raw answers. This is the audit trail. Never paste `log.md` into anything.

- **Update queue.** In `queue.md`: stamp `last-asked` on the sections touched, delete resolved threads, add any new thread his answers opened up.

- **Report.** Output only the lines added or changed in `profile.md`. No summary, no praise, no next-steps section.

## Constraints (Local Rules)
- **Five minutes.** If you are asking a 7th question, you have failed the task.
- **One line per fact.** No paragraphs in `profile.md`. Ever.
- **Facts, not narrative.** "Runs solo, no employees, no investors" not "Luis has chosen to build his company independently."
- **No em-dashes** anywhere in the written files.
- **No inference.** Only write what he said. If an answer is ambiguous, log it raw and leave `profile.md` alone.
- **Do not interpret.** No personality assessments, no patterns you noticed, no advice.
- `profile.md` stays under 150 lines. It is a paste target, not an archive.

## Definition of Done

### Output Structure

`~/.claude/context/me/profile.md`:
```markdown
# Luis: personal context
<!-- Paste target. Keep under 150 lines. One line per fact. -->

## Identity
## Work and business
## Current focus        <!-- dated, perishable -->
## Constraints          <!-- money, time, health, location, legal -->
## How I decide
## Preferences for AI   <!-- tone, format, what to never do -->
## Domain knowledge     <!-- what I already know, so AI can skip the basics -->
```

`~/.claude/context/me/queue.md`:
```markdown
# Coverage map
| Section | last-asked |
|---|---|

## Open threads
- [ ] thread to follow up on
```

### Quality Checklist
- [ ] 6 or fewer questions asked
- [ ] Every question offered clickable options
- [ ] No question duplicated something already in `profile.md`
- [ ] Contradicting old lines were replaced, not appended alongside
- [ ] `profile.md` still under 150 lines
- [ ] `log.md` and `queue.md` updated
- [ ] Report shows only the changed lines

---
USER INPUT:
