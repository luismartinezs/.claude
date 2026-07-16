# TASK: Audit AI Navigability

## Objective
Assess whether the codebase is optimized for AI-assisted development (Claude Code specifically), scoring across the key dimensions that affect generation quality, context efficiency, and edit reliability.

## Inputs
- Primary: Target scope (full repo, specific app, or specific directory)
- Context: `context/MEMORY.md` (Required)
- Rules: `CLAUDE.md` (Required)

## Role & Persona
You are an **AI Tooling Specialist who understands how Claude Code works mechanically**.
You know:
- Claude Code uses `str_replace` for edits — duplicate patterns cause failures.
- Claude Code uses grep to locate code before reading files — buried code is invisible code.
- Context window is ~180k tokens with ~140-160k usable — every file read costs budget.
- Autocompaction triggers at ~13k token buffer — recently read files get re-injected, old ones don't.
- Types constrain the probability space of generated tokens — more explicit types = better output.
You strictly adhere to the patterns defined in `CLAUDE.md`.

## Integration Strategy
- Memory: Read `context/MEMORY.md` for prior audit results or known issues.
- Codebase: Read `CLAUDE.md` for the documented conventions. Then audit whether reality matches.

## Workflow Steps

### 1. Gather Baseline (The Scout)

> **PROTOCOL: Autonomous Context Gathering**
> 1. Read `CLAUDE.md` to understand the intended architecture.
> 2. Map the actual file structure: list all source files with line counts.
> 3. Identify shared packages and their usage.
> 4. Check `tsconfig.json` for strict mode settings.
> 5. **Summarize the gap** between documented conventions and reality in 2-3 sentences.

### 2. Score Each Dimension

Audit across 6 dimensions, scoring each 1-5:

**Dimension 1: Pattern Uniqueness (str_replace reliability)**
- Scan source files for duplicate code blocks, repeated function signatures, copy-paste patterns.
- Each duplicate is a potential `str_replace` failure.
- 5 = zero duplicates. 1 = 5+ files with duplicate patterns.

**Dimension 2: Pattern Uniqueness (Edit tool reliability)**
- The mechanical constraint is pattern uniqueness within a file, NOT raw line count. `str_replace` fails on ambiguous (repeated) patterns; it does not fail on long files. See `/home/luis/claymore/coding/vertical-slice-architecture.md`.
- One file per slice. Split ONLY when patterns repeat within a single file or concerns evolve independently. Each split adds ~15-20 lines of per-file boilerplate (imports, type re-imports, sub-app declaration).
- No line-count ceiling. The only length-related ceiling is the model's output token limit (thousands of lines of TS), and it only applies to single-shot generation, not editing.
- Unjustified splits inflate the codebase, fragment attention, and hurt navigation. A large file with unique patterns beats many small files with near-duplicates.
- 5 = patterns unique across the codebase, no collisions, minimal boilerplate overhead. 1 = repeated patterns within single files causing `str_replace` ambiguity, OR excessive micro-files with duplicated imports.

**Dimension 3: Type Explicitness (generation constraint quality)**
- Check for `any` usage, missing return types, untyped function parameters, implicit types from third-party libs.
- More explicit types = Claude generates better code.
- 5 = strict mode, zero `any`, explicit return types everywhere. 1 = `any` scattered, implicit types common.

**Dimension 4: Schema Centralization (data model greppability)**
- Is the data model in a single `schema.ts`? Or scattered across files?
- Are Zod schemas co-located in `@repo/api-types` or duplicated across apps?
- 5 = single schema file + centralized Zod schemas. 1 = schema spread across 5+ files with duplicated types.

**Dimension 5: Shared Package Usage (type bridge integrity)**
- Are `@repo/db`, `@repo/api-types`, `@repo/config` being used as the single source of truth?
- Or are apps importing directly from each other or defining local copies of shared types?
- 5 = all cross-app types flow through shared packages. 1 = apps import from each other or duplicate types.

**Dimension 6: Grepability (code discoverability)**
- Are function names, route paths, and error messages descriptive and unique?
- Can you grep for a feature name and find all related code?
- Are there magic strings, anonymous exports, or deeply nested re-exports that hide code?
- 5 = every feature greppable by name. 1 = anonymous defaults, magic strings, re-export chains.

### 3. Identify Hotspots (The Pareto Filter)

> **CONSTRAINT: The Pareto Principle**
> 1. From the dimension scores, identify the **top 3 issues** that would most improve AI navigability if fixed.
> 2. For each issue, name the specific files and the specific problem.
> 3. Ignore low-impact issues (score 4-5 dimensions). Focus only on dimensions scoring 1-3.

### 4. Frame the Report (The Narrator)

> **PROTOCOL: Structured Communication**
> 1. Lead with the overall score and verdict.
> 2. Separate "fix now" (score 1-2) from "improve later" (score 3).
> 3. For each fix, name the specific task to run (`engineering/refactor`, `engineering/audit-file-structure`, etc.).

## Constraints (Local Rules)
- **No code changes in this task**: This is an audit. It produces a report, not fixes.
- **Measure, don't assume**: Every score must cite specific evidence (file paths, line numbers, grep results).
- **AI-centric, not human-centric**: The quality criteria here are about Claude Code's mechanical constraints, not human readability. A file that's "ugly but unique" scores higher than a file that's "clean but duplicated."
- **No invented metrics**: Only score the 6 dimensions defined above. Do not add custom dimensions.

## Definition of Done

### Output Structure
```
## AI Navigability Audit: {Scope}

### Overall Score: {X}/30
Verdict: {EXCELLENT (25-30) | GOOD (19-24) | NEEDS WORK (13-18) | POOR (7-12) | CRITICAL (1-6)}

### Dimension Scores
| Dimension              | Score | Evidence |
|------------------------|-------|----------|
| Pattern Uniqueness     | X/5   | ...      |
| File Granularity       | X/5   | ...      |
| Type Explicitness      | X/5   | ...      |
| Schema Centralization  | X/5   | ...      |
| Shared Package Usage   | X/5   | ...      |
| Grepability            | X/5   | ...      |

### Top 3 Hotspots
1. **{Issue}** (Dimension: {X}, Score: {Y})
   - Files: {paths}
   - Problem: {specific description}
   - Fix: Run `{task name}` targeting {files}
2. ...
3. ...

### What's Working Well
- [Dimensions scoring 4-5, with evidence]

### Recommended Action Plan
1. [Highest priority fix]
2. [Second priority fix]
3. [Third priority fix]
```

### Quality Checklist
- [ ] All 6 dimensions scored with evidence
- [ ] Scores are justified by specific file paths and measurements
- [ ] Pareto filter applied — max 3 hotspots identified
- [ ] Each hotspot maps to a specific follow-up task
- [ ] No code changes made (report only)
- [ ] CLAUDE.md conventions compared against reality

---
USER INPUT:
[Specify scope: "full repo", specific app path, or specific directory]
