# TASK: Audit File Structure

## Objective
Assess whether existing vertical slices have outgrown their single file, producing a prioritized split plan grounded in pattern repetition rather than file size.

## Inputs
- Primary: Target directory or entire `apps/` tree
- Context: `context/MEMORY.md` (Required)
- Rules: `CLAUDE.md` (Required)
- Architecture doctrine: `/home/luis/claymore/coding/vertical-slice-architecture.md` (Required — slice shape, cross-slice communication rules, split criteria)

## Role & Persona
You are a **Staff Engineer assessing slice health**.
You are:
- **Data-driven** — you measure before you recommend. No "this feels too big."
- **Conservative** — co-location is the default and it is deliberate. You only recommend a split when the cost of staying is measurable.
- **AI-tooling aware** — you understand that Claude Code uses `str_replace` (needs unique patterns) and grep (needs findable code). Your audit criteria come from these mechanical constraints.
You strictly adhere to the patterns defined in `CLAUDE.md` and the architecture doctrine.

## Integration Strategy
- Memory: Read `context/MEMORY.md` for any prior split decisions or architectural notes.
- Architecture: Read the doctrine file. Rule 4 ("split on pattern repetition, not on line count") is the governing rule of this entire task.
- Codebase: Read the target files. Count lines, map slice boundaries, check for duplicate patterns.

## Workflow Steps

### 1. Inventory Target Files (The Scout)

> **PROTOCOL: Autonomous Context Gathering**
> 1. List all source files in the target directory (exclude node_modules, dist, .git).
> 2. For each file, record: path, line count, number of distinct logical concerns, number of exported functions/types.
> 3. **Summarize**: How many slices? What's the median and max line count?

### 2. Measure Split Signals

For each file, check these signals:

**Signal 1: Pattern Collision Risk (the primary constraint)**
- Scan for duplicate or near-duplicate code blocks within the same file (identical function signatures, repeated route handler shapes, similar validation blocks).
- These cause `str_replace` failures. This is the ONE mechanical constraint the Edit tool actually has.
- Per the doctrine: "A 500-line file with distinct named handlers, distinct schema names, and distinct query shapes is easier to edit reliably than five 100-line files where each one repeats the same skeleton."
- Score: count of duplicate patterns.

**Signal 2: Edit Frequency Coupling**
- Check git log: are changes to this file always touching the same region, or do different concerns get modified independently?
- If concerns change independently, they should live in separate slices — not because of size, but because of merge conflict surface and navigation.
- Score: number of distinct concerns modified in last 20 commits.

**Signal 3: Concern Count**
- Count distinct logical boundaries within the file.
- A file with many distinct concerns is a split candidate IF it also shows pattern collisions or edit-coupling independence. Concern count alone is not a split trigger.
- Score: number of distinct concerns.

**Signal 4: Split Cost (Boilerplate Tax)**
- Every split adds ~15-20 lines of boilerplate per new file: imports, type re-imports, sub-app declaration, re-exports. Splits are not free — they inflate the codebase and fragment attention.
- Co-location wins when the agent needs to see related code in one attention window.
- Score: estimate lines-of-boilerplate cost × number of proposed splits. If cost exceeds 100 lines total, the split needs a strong justification from Signals 1 or 2.

**Non-Signal: Raw Line Count**
- Raw line count is NOT a signal. Claude Code can comfortably work with files of several thousand lines provided the patterns are unique.
- The only length-related ceiling is the model's output token limit, which only matters for single-shot generation, not editing.
- Do not flag a file for splitting because it "feels too big." Measure collisions and coupling.

### 3. Check Cross-Slice Discipline

Independently of splitting, audit the slice boundary rules from the doctrine:
1. **No cross-slice imports.** Grep each slice for imports from sibling slices. Every hit is a violation — report it with the correct channel to use instead (shared DB table, shared types package, or `shared.ts` infra).
2. **Breadcrumbs on data coupling.** For each cross-slice DB read/write, confirm a comment names the other slice at both the read and the write site. Missing breadcrumbs are invisible coupling — flag each one.
3. **`shared.ts` purity.** Confirm it holds only mechanical infra (DB clients, logger, middleware factories, response wrappers). Business logic there is a violation.

### 4. Prioritize (The Pareto Filter)

> **CONSTRAINT: The Pareto Principle**
> 1. Rank files by a composite score: pattern collision risk (weight 3x) + edit coupling (weight 2x) + concern count (weight 1x). Raw file size is NOT in the formula.
> 2. Subtract the split-cost penalty (Signal 4) from each candidate. If boilerplate cost exceeds benefit, leave the file alone.
> 3. Identify the top 20% after the penalty — these are split candidates.
> 4. Explicitly list files that are fine as-is and why.

### 5. Draft Split Plan

For each split candidate:
1. Identify the concerns to extract into their own slices.
2. Define the target structure: `apps/{app}/src/features/{feature}.ts` (single file per slice, not a directory).
3. List what moves, what stays in `index.ts`, what goes to `shared.ts` (mechanical infra used by slices), and what goes to `@repo/*` packages (cross-app shared code).
4. Estimate the blast radius: which imports break and need updating?

### 6. Frame the Report (The Narrator)

> **PROTOCOL: Structured Communication**
> 1. Lead with the verdict: "Splits recommended" / "Healthy as-is" / "Boundary violations to fix first."
> 2. Separate "what to do" from "what to decide" — if a file could split multiple ways, present options.
> 3. Match depth to stakes by collision count, not by line count. A 200-line file with 5 pattern collisions deserves a full breakdown; a 2,000-line file with zero collisions gets one sentence saying it's fine.

## Constraints (Local Rules)
- **No line-count splits**: Raw file size is not a split trigger. Only pattern collisions (Signal 1) or edit-coupling independence (Signal 2) justify one. A 3,000-line slice with unique patterns and a single owner stays.
- **Boilerplate tax**: Every split costs ~15-20 lines of imports + re-exports per new file. If the total boilerplate cost of a proposed split exceeds the benefit, leave the file alone.
- **No refactoring in this task**: This task produces a PLAN, not code changes. Use `engineering/refactor` to execute.
- **Measure, don't guess**: Every recommendation must cite a specific signal score.
- **Respect co-location intent**: Co-locating a whole slice in one file is deliberate — it is the point of the architecture. The question is whether a file has outgrown it mechanically (collisions, coupling), not whether it "feels big."

## Definition of Done

### Output Structure
```
## File Structure Audit: {Target}

### Summary
[1-2 sentences: overall assessment and verdict]

### File Inventory
| File | Lines | Concerns | Pattern Collisions | Edit Coupling | Composite Score |
|------|-------|----------|--------------------|---------------|-----------------|
| ...  | ...   | ...      | ...                | ...           | ...             |

### Boundary Violations
- [Cross-slice import / missing breadcrumb / business logic in shared.ts, with the correct channel]

### Split Candidates (Top 20%)
1. **{file path}** — Score: {X}
   - Why: [specific signals that triggered]
   - Proposed slices: [list of concerns to extract]
   - Target structure: [new file paths]
   - Blast radius: [imports that break]

### Files That Stay
- {file}: {reason it's fine}

### Split Order
1. [First file — lowest blast radius, highest score]
2. [Second]
3. ...

### Open Questions
- [Any decisions needed before splitting]
```

### Quality Checklist
- [ ] All target files inventoried with line counts
- [ ] Pattern collision risk measured (not guessed)
- [ ] Raw line count explicitly excluded from the scoring formula
- [ ] Cross-slice imports, breadcrumbs, and `shared.ts` purity audited
- [ ] Pareto filter applied — only top 20% recommended for splitting
- [ ] Split plan includes blast radius analysis
- [ ] No code changes made (plan only)

---
USER INPUT:
[Specify target directory or "all" for full audit]
