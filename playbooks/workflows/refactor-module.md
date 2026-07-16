# Workflow: Refactor Module

## Starting State
A module or area of the codebase has accumulated complexity, duplication, or structural debt that impedes further work.

## End State
Code is restructured with identical external behavior, reviewed, and lessons captured.

## Tools Discovered
- Tasks: `engineering/refactor-code`, `engineering/review-code`, `meta/update-memory`
- Scripts: `bun run typecheck` (type verification)
- Gaps: None. All steps covered.

## Steps

1. **Refactor**
   - Input: Target module/files and the specific improvement goal
   - Task: `playbooks/tasks/engineering/refactor-code.md`
   - Output: Restructured code with atomic commits, validated incrementally, no behavior changes
   - Constraint: Pareto-scoped. Only the critical 20%. Existing patterns followed.

2. **Review**
   - Input: Full diff of all refactoring changes
   - Task: `playbooks/tasks/engineering/review-code.md`
   - Output: Scored review focused on: behavior preservation, pattern consistency, no scope creep
   - Gate: If the review finds behavior changes, STOP. That's a feature change, not a refactor. Revert and re-scope.
   - Gate: If score < 70 or Critical findings, address and re-review.

3. **Update Memory**
   - Input: Architectural insights from the refactor
   - Task: `playbooks/tasks/meta/update-memory.md`
   - Output: Updated `context/MEMORY.md` if the refactor revealed non-obvious patterns, gotchas, or architectural decisions worth preserving
   - Constraint: Apply Pareto filter. Only record what prevents future confusion.

## Gaps & Recommendations
- No gaps. All steps covered.
- For large refactors spanning multiple modules, consider running Steps 1-2 per module rather than batching all changes into a single review.
- If the refactor exposes untested code, consider chaining `engineering/write-tests` before Step 1 to establish a safety net.
