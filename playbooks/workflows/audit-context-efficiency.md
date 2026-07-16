# Workflow: Audit Context Efficiency

## Starting State
A codebase that may have drifted from AI-optimal conventions over time (growing files, type erosion, scattered schemas, duplicate patterns).

## End State
Codebase is assessed against AI navigability criteria, hotspots are identified, and the most impactful fixes are applied and verified.

## Tools Discovered
- Tasks: `engineering/audit-ai-navigability`, `engineering/refactor-code`, `engineering/audit-file-structure`, `meta/update-memory`
- Scripts: `bun run typecheck` (validation)
- Gaps: None. All steps covered.

## Steps

1. **Audit AI Navigability**
   - Input: Target scope (usually full repo)
   - Task: `playbooks/tasks/engineering/audit-ai-navigability.md`
   - Output: Score across 6 dimensions (pattern uniqueness, file granularity, type explicitness, schema centralization, shared package usage, grepability), top 3 hotspots, recommended action plan
   - Gate: User reviews the report and approves which hotspots to fix.

2. **Fix Hotspots**
   - Input: Approved hotspots from Step 1
   - Task: Depends on the hotspot type:
     - Pattern collisions or slice boundary issues → `playbooks/tasks/engineering/audit-file-structure.md` (then `engineering/refactor-code` to execute any split it plans)
     - Type erosion (`any` usage, missing return types) → `playbooks/tasks/engineering/refactor-code.md` with goal "add explicit types"
     - Schema scatter → `playbooks/tasks/engineering/refactor-code.md` with goal "centralize schema"
     - Shared package bypass → `playbooks/tasks/engineering/refactor-code.md` with goal "route types through @repo/* packages"
     - Grepability issues → `playbooks/tasks/engineering/refactor-code.md` with goal "rename anonymous exports, eliminate magic strings"
   - Output: Targeted fixes, validated via typecheck
   - Constraint: Fix one hotspot at a time. Validate before moving to the next.

3. **Re-score**
   - Input: Post-fix codebase
   - Task: `playbooks/tasks/engineering/audit-ai-navigability.md` (re-run)
   - Output: Updated scores. Verify that fixed dimensions improved.
   - Skip condition: If only 1 hotspot was fixed and the fix was straightforward, skip the re-audit.

4. **Update Memory**
   - Input: Audit results and fixes applied
   - Task: `playbooks/tasks/meta/update-memory.md`
   - Output: Updated memory with any non-obvious findings (e.g., "Drizzle schema was split across 3 files due to circular dependency; consolidated by reordering table definitions")
   - Constraint: Only record surprises. "We added return types" is not worth recording.

## Gaps & Recommendations
- This workflow is designed to run periodically (e.g., every 2-4 weeks or before a major feature push). It's not a one-time audit.
- If the initial score is EXCELLENT (25-30), stop at Step 1. No fixes needed.
- If the score is POOR or CRITICAL (below 12), the problem is likely structural rather than a set of hotspots. Run `engineering/audit-file-structure` across the whole tree first and treat its split plan as the intervention, rather than patching dimensions one at a time.
