---
description: Audit a codebase according to vertical slice architecture
argument-hint: Optionally provide claude additional instructions
---

Act as a Senior Software Architect specializing in Vertical Slice Architecture (VSA).
Conduct a rigorous audit of the current codebase and provide a "VSA Health Report."

$ARGUMENTS

### 1. EVALUATION CRITERIA
Review the codebase against these 4 pillars:
- **Pillar A: Isolation (Boundary Check):** Do slices in `src/modules/` import directly from the internal folders of other slices?
- **Pillar B: Gatekeeping (Public API):** Is the `{slice}.public.ts` (or `index.ts`) the ONLY entry point for each module?
- **Pillar C: Patterns (Logic Structure):** Are complex features implemented using the Command Pattern and Strategies, or is logic scattered in components/helpers?
- **Pillar D: Composition (Wiring):** Is cross-slice wiring handled exclusively at the Entry Point Layer (Pages/Routes/Main), or is there "hidden" dependency injection inside slices?

### 2. OUTPUT FORMAT
For each pillar, provide:
- **Score (1-10):** A quantitative assessment.
- **Evidence:** List specific files or import paths that violate or uphold the rule.
- **Architectural Friction:** Identify if current ESLint or Dependency-Cruiser rules are successfully blocking violations.

### 3. RED FLAG SUMMARY
List the top 3 "Tight Couplings" that must be refactored immediately to prevent the project from becoming a monolith.

### 4. ACTION PLAN
Provide a step-by-step refactoring guide to bring the score of the lowest-performing pillar up to a 9/10.