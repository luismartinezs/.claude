# Strategies Library

*Copy-paste these blocks into your Tasks. Select only what the task actually needs.*

## The rule that decides what belongs here

**A strategy earns its place only if following it produces an artifact or an
observable act that would not otherwise exist.** Instructions that describe how
to think ("be adversarial", "consider failure modes", "read the surrounding
code", "simulate the logic mentally") measured as worth nothing: in 8 A/B runs
across 3 task types, playbooks built from them found exactly the same defects as
a plain request while costing 61% to 153% more. A capable model already thinks
that way, so restating it buys tokens and latency and no findings.

What did measure: commanded actions. Run a check that fails on the broken
version. Apply the fix and prove it. Stop and ask instead of assuming. Write the
decision rule down. Those change what happens, so they are what this file holds.

**Before adding a strategy, ask: if the model ignored this line, would the output
be observably different?** If you cannot name the difference, do not add it.

---

## 1. The Prover (negative test)

*Use when:* the task claims something now works, is guarded, is fixed, or is safe.
*Placement:* inside "Definition of Done", as a gate on reporting completion.

> **GATE: Prove it with a check that can fail**
> Do not report done on the strength of reading the code.
> 1. Run a check that **fails against the unfixed or unguarded version** and
>    passes against yours. If you cannot make it fail, the check proves nothing
>    and you have not verified anything.
> 2. Prefer the failure mode that is **slow or partial** over the one that is
>    total. A dependency that is stopped refuses instantly and passes even when
>    your timeout is broken; a dependency that is hung is what actually exercises
>    the guard.
> 3. Report the observed values, not the conclusion: "pre-fix FAIL got 800,
>    expected 500; post-fix 11 assertions pass", not "verified".
> 4. If the check crashes rather than failing cleanly, that is a finding about
>    the target, not a flaky test. Diagnose it before re-running.

---

## 2. The Decision Rule (branch points)

*Use when:* the task hits something that legitimately differs per target or per project.
*Placement:* wherever the task names a choice.

> **CONSTRAINT: Every branch point ships with its classes and its actions**
> Naming a thing to "check" without saying what to do per outcome creates the
> feeling of having handled it while forcing the next agent to improvise.
> 1. List the **classes** the situation can fall into.
> 2. Give the **action for each class**.
> 3. State the **null class explicitly** (the target has none of this, the file
>    does not exist, there is no precedent), and what to do then. The null class
>    is where improvisation does the most damage.

---

## 3. The Gatekeeper (stop and ask)

*Use when:* proceeding on a wrong reading would waste the whole task.
*Placement:* top of "Workflow Steps".

> **GATE: Stop before building on an assumption**
> 1. Name the decisions this task cannot make for itself.
> 2. **IF** one is genuinely undetermined by the input and the codebase: stop,
>    ask 1-3 specific questions, and wait.
> 3. **ELSE** proceed. Do not manufacture questions to satisfy this step, and do
>    not ask about anything you could settle by reading a file.

---

## 4. The Ratchet (checkpoint per unit)

*Use when:* multi-step changes where a silent failure compounds into later steps.
*Placement:* wrapping each step of "Workflow Steps".

> **PROTOCOL: Validate before stacking**
> 1. Break the work into units that can each be verified on their own.
> 2. After each unit, run the target's own check (typecheck, tests, build).
> 3. **IF** it fails, diagnose the cause before retrying. Do not repeat the same
>    action expecting a different result.
> 4. Attach each toolchain check to the step that **first** needs it, not only to
>    final verification. A type error found after five steps invalidates five
>    steps.

---

## 5. The Pareto Filter (forbidden scope)

*Use when:* refactors, audits, optimizations, anything with an unbounded surface.
*Placement:* inside "Constraints".

> **CONSTRAINT: You are forbidden from fixing everything**
> 1. Name the 20% that carries the value or the risk.
> 2. Change only that.
> 3. Everything else you noticed goes in the report as one line each, unfixed.

---

## 6. The Friction Report (close the loop)

*Use when:* the task is reusable, so its own defects are worth capturing.
*Placement:* final instruction of the task.

> **INSTRUCTION: Report what this task got wrong**
> If the work forced a deviation from these instructions, or hit a trap they did
> not warn about, tell the user and propose the edit as a **generalized rule**,
> not a patch for this one case. A reusable task is a hypothesis until something
> real runs through it.

---

## Output-format blocks (not strategies)

These change how the answer is presented, not what work happens. Use them when
you want the format; do not expect them to improve the findings.

**Severity grouping.** Group findings as Critical (causes a production incident)
/ Warning (causes one under specific conditions) / Nit (style), and give every
finding a file, a line, and a concrete fix.

**Scored verdict.** `Score: X/100` with a metric breakdown, plus one of
APPROVE / REQUEST CHANGES / NEEDS DISCUSSION and a one-sentence justification.

---

## Retired

Cut after measurement showed no effect on output quality. Do not reintroduce
without a test that shows a difference.

| Retired | Why |
|---|---|
| The Historian (find 2 similar files, mimic) | No additional findings in either `review-code` replicate, and it burns a paragraph explaining itself when the repo has no precedent. If you need it, it is a Decision Rule with a null class, not a strategy. |
| The Red Team (identify 3 failure modes) | Both arms found the same defects. The model is adversarial by default. |
| The Simulator (mental walkthrough) | Not observable in the output. Superseded by The Prover, which demands a real check. |
| The Scout (read related files first) | Every plain-request arm already read the files before answering. |
| The Quantifier (confidence score) | Real, but it is a format, not a strategy. Moved to output-format blocks. |
| The Narrator (lead with the outcome) | Duplicates the "How to Structure an Explanation" rules in `~/.claude/CLAUDE.md`, which apply to every session already. |
| The Explorer (3 approaches, pros/cons) | Untested. Kept out until measured, since it reads as describe-thinking. Re-add with evidence. |
| The Architect (atomic decomposition) | Folded into The Ratchet, which carries the same decomposition plus the check that makes it observable. |

**Migration status, as of 2026-08-06.** Retiring a block here does not edit the
tasks that already inlined it, because tasks are self-contained by design. Three
tasks were rewritten against this doctrine and measured (`review-code`,
`write-tests`, `diagnose-bug`). Roughly 15 others still carry retired blocks
inline, most of them the `audit-*` family, which is built almost entirely from
Historian, Red Team and Quantifier and should therefore behave like the old
`review-code` (no additional findings, 61% to 153% more cost). Rewrite them when
you next touch one; do not batch-edit them unmeasured.
