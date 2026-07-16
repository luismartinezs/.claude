# Workflow: Fix Bug

## Starting State
A bug report exists (error message, stack trace, user report, or failing test).

## End State
Bug is fixed, fix is verified, code is reviewed, and lessons learned are captured in memory.

## Tools Discovered
- Tasks: `engineering/diagnose-bug`, `engineering/review-code`, `meta/update-memory`
- Scripts: `bun run typecheck` (type verification)
- Gaps: None. Code fix step is ad-hoc (implementation depends on the diagnosis).

## Steps

1. **Diagnose**
   - Input: Bug report (error message, reproduction steps, observed behavior)
   - Task: `playbooks/tasks/engineering/diagnose-bug.md`
   - Output: Root cause identified, fix strategy defined, hypothesis validated

2. **Fix**
   - Input: Diagnosis from Step 1
   - Task: ad-hoc (apply the fix identified in diagnosis)
   - Output: Code changed, minimal diff, targeted to root cause only
   - Constraint: Follow the "one hypothesis, one change, one validation" rule from the diagnosis task. Run `bun run typecheck` after applying the fix.

3. **Review**
   - Input: Diff of all changes from Step 2
   - Task: `playbooks/tasks/engineering/review-code.md`
   - Output: Scored review. If score < 70 or any Critical findings, return to Step 2.
   - Gate: Only proceed if verdict is APPROVE.

4. **Update Memory**
   - Input: Root cause and fix from Steps 1-2
   - Task: `playbooks/tasks/meta/update-memory.md`
   - Output: Updated `context/MEMORY.md` if the bug revealed something non-obvious (architectural gotcha, API quirk, pattern violation that worked before)
   - Constraint: Apply Pareto filter. Only record if it prevents future bugs.

## Gaps & Recommendations
- No gaps. All steps covered by existing tasks.
- If the codebase has no tests for the affected area, consider chaining `engineering/write-tests` after Step 2 to prevent regression.
