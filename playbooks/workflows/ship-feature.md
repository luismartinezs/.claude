# Workflow: Ship Feature

## Starting State
A feature idea or rough requirement exists (could be a sentence, a spec draft, or a detailed brief).

## End State
Feature is specced, planned, implemented, tested, and reviewed. Ready to merge.

## Tools Discovered
- Tasks: `product/refine-spec`, `engineering/plan-feature`, `engineering/write-tests`, `engineering/review-code`
- Scripts: `bun run typecheck` (type verification)
- Gaps: Implementation step is ad-hoc (follows the plan from Step 2).

## Steps

1. **Refine Spec**
   - Input: Rough feature idea or draft spec
   - Task: `playbooks/tasks/product/refine-spec.md`
   - Output: Unambiguous spec with resolved decisions, engineering warnings, research topics
   - Gate: User confirms spec is complete before proceeding.
   - Skip condition: If user provides a detailed, unambiguous spec, skip to Step 2.

2. **Plan Implementation**
   - Input: Refined spec from Step 1
   - Task: `playbooks/tasks/engineering/plan-feature.md`
   - Output: Chosen approach with tradeoffs, atomic implementation steps, data models, testing strategy
   - Gate: User approves the plan before proceeding. If open questions remain, resolve them.

3. **Implement**
   - Input: Approved plan from Step 2
   - Task: ad-hoc (execute the atomic steps from the plan, in order)
   - Output: Working code, committed incrementally per atomic step
   - Constraint: Follow the plan's step order. Run `bun run typecheck` after each atomic step. If a step fails, diagnose before retrying — do not proceed with broken intermediate state.

4. **Write Tests**
   - Input: Implemented code from Step 3
   - Task: `playbooks/tasks/engineering/write-tests.md`
   - Output: Tests covering happy path, edge cases, and failure modes
   - Note: Can be interleaved with Step 3 (write tests per atomic step) or done after. Interleaving is preferred for complex features.

5. **Review**
   - Input: Full diff (all changes from Steps 3-4)
   - Task: `playbooks/tasks/engineering/review-code.md`
   - Output: Scored review with findings
   - Gate: If score < 70 or Critical findings exist, address them and re-review.

## Gaps & Recommendations
- Implementation step (Step 3) is ad-hoc by nature since it depends on the plan output. The plan-feature task structures it enough.
- For large features, consider splitting Step 3 into multiple PRs aligned to atomic step groups.
