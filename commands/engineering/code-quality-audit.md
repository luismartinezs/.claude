---
description: Standard Operating Procedure; 80/20 Codebase Quality Audit
---

# Standard Operating Procedure: 80/20 Codebase Quality Audit

## Purpose
Quickly assess maintainability and DX for a bootstrap-stage repo. Output a 0–100 score and a short action list.

## Scope
Any single repo. Language-agnostic with JS/TS examples.

## Sampling rule
Audit the top churn files plus a random slice until you reach 10–20% of files or 30 files, whichever comes first.

## Procedure

1. Select sample

* Churn last 90 days:
  `git log --since='90 days' --name-only --pretty=format: | grep -E '\.(js|ts|py|go|java|rb|php)$' | sort | uniq -c | sort -nr | head -n 50`
* Take top 15 by churn. Add 10 random files from core dirs.

2. Run quick metrics

* LOC per file: `cloc --by-file --quiet .`
* Complexity: `python -m lizard -C 10 -T nloc=40 -T parameter_count=4 -x tests -x node_modules .` (adjust languages if needed)
* Test duration: run unit tests only; time it.
* Lint/format check: run repo scripts if present.

4. Perform the ten checks (pass/partial/fail)

A. Formatter + Linter

* One command runs both without changes or warnings.
* Example: `npm run format:check && npm run lint`
  Score: pass=10, partial=5 (minor warnings), fail=0.

B. File and function size

* Files ≤ 400 LOC. Functions ≤ 40 LOC.
* Use lizard output for function lengths.
  Score: ≥90% of sample within caps=10, 60–89%=5, <60%=0.

C. Single responsibility per module

* Each file exports one main thing. Helpers are internal.
* Manual check on sample.
  Score: clear single purpose in ≥80% files=10, \~50–79%=5, else 0.

D. Complexity caps

* Cyclomatic ≤ 10, nesting depth ≤ 3.
* From lizard; spot-check deep blocks.
  Score: ≥85% functions within caps=10, 60–84%=5, else 0.

E. Boundaries are explicit

* Inputs validated at edges. Types/schemas defined once and reused.
* Inspect 2 endpoints or 2 public modules.
  Score: both edges validated and typed=10, one edge=5, none=0.

F. Dependencies are thin

* No unused deps. Versions pinned. Volatile libs behind adapters.
* For JS: `npx depcheck` or manual scan + adapter presence.
  Score: clean deps and adapters present=10, minor unused or missing adapter=5, messy=0.

G. Tests cover the core

* Unit tests for pure logic in sample modules.
* At least one happy-path integration per service.
* Tests deterministic.
  Score: core covered and green=10, partial=5, poor/flake=0.

H. One-page dev doc

* README or CONTRIBUTING shows run, test, release in under \~200 lines.
* Followed without surprises.
  Score: present and accurate=10, present but stale/gaps=5, missing=0.

I. CI is strict and short

* Lint, type, test on PR. Typical runtime ≤ 10 min.
* Red stops merges.
  Score: policy and runtime met=10, missing one element=5, weak/absent=0.

J. Hotspot watch

* Some mechanism tracks churn × complexity.
* Top 5 hotspot list exists or is obvious in issues.
  Score: mechanism + list=10, ad-hoc awareness=5, none=0.

5. Red-flag overrides (fail fast)
   If any appear, note and set max total score to 60 until fixed.

* Secrets in repo.
* Tests fail locally or on main.
* Build not reproducible.
* Silent error handling in I/O paths.

6. Score

* Sum the ten checks (0/5/10 each). Max 100.
* Apply red-flag cap if triggered.
* Interpret:
  90–100 clean.
  75–89 acceptable with targeted fixes.
  60–74 risky soon.
  <60 spaghetti risk now.

7. Deliverables

* `code-quality-audit.md`
* 5-item action list, each with effort (S/M/L) and impact (Low/Med/High).

Audit template (copy, fill, submit)

```md
# 80/20 Codebase Audit

## Summary
Overall score: <0–100>
Red-flag cap applied: <yes/no>
Headline risks: <1–3 bullets>
Quick wins: <1–3 bullets>

## Sample
Files audited: <N> (~<%> of repo)
Selection: <top churn + random core>
Command(s) used: <paste churn/metrics commands>

## Checks
A Formatter+Linter: <pass/partial/fail> – notes
B Size limits: <pass/partial/fail> – notes
C Single responsibility: <pass/partial/fail> – notes
D Complexity caps: <pass/partial/fail> – notes
E Boundaries typed/validated: <pass/partial/fail> – notes
F Dependencies thin: <pass/partial/fail> – notes
G Core tests: <pass/partial/fail> – notes
H One-page dev doc: <pass/partial/fail> – notes
I CI strict+short: <pass/partial/fail> – notes
J Hotspot watch: <pass/partial/fail> – notes

## Metrics
- LOC/file highlights: <numbers>
- Functions > 40 LOC: <count/list>
- Functions > CC 10: <count/list>
- Unused deps: <list or none>

## Hotspots (top 5)
1. <file> — churn <n>, max CC <n>, notes
2. <file> — …
3. <file> — …
4. <file> — …
5. <file> — …

## Action List (max 5)
1. <action> — Impact <H/M/L>, Effort <S/M/L>, Owner <name>, Due <date>
2. <action> — …
3. <action> — …
4. <action> — …
5. <action> — …

## Notes
- Assumptions:
- Follow-ups:
```

Operating rules

* Stick to the instructions. Do not expand scope.
* If 8+ checks pass, proceed. If ≤7, fix top 3 items before shipping.
