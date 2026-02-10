---
description: Audit a videogame codebase
argument-hint: Optionally provide claude additional instructions
---

# Vertical Slice Architectural Audit (Game Dev Edition)

Act as a Senior Game Architect. Review the current codebase and provide a "VSA Health Report" based on the following criteria. **Since we are using Classes, do not penalize for class syntax, but ensure they are properly encapsulated within their slices.**

$ARGUMENTS

### 1. EVALUATION CRITERIA

* **Pillar A: Boundary Isolation (The "Import" Test):** Do classes in one module (e.g., `Combat`) import directly from the internal files of another (e.g., `Inventory`)?
* **Pillar B: Gatekeeping (The "Public" Test):** Is the `{module}.public.ts` (or `index.ts`) the ONLY entry point for each module?
* **Pillar C: Logic vs. State (The "Command" Test):** Are game actions (DealDamage, UseItem) encapsulated in **Command Classes** with an `.execute()` method, or is logic leaking into global managers?
* **Pillar D: The Composition Root (The "Loop" Test):** Is the Main Game Loop correctly acting as the **Composition Root**, or are modules "wiring themselves" together via hidden dependencies?

### 2. AUDIT OUTPUT FORMAT

For each pillar, provide:

* **Score (1-10):** A quantitative assessment of health.
* **Evidence:** List specific files or import paths that violate or uphold the rule.
* **Action Required:** A one-sentence instruction to fix any identified violation.

### 3. RED FLAG SUMMARY

List the top 3 "Tight Couplings" where two modules are so entangled that deleting one would break the compiler in the other.

### 4. REFACTORING BLUEPRINT

Identify the module with the lowest score and provide a step-by-step plan to:

1. Extract its logic into **Command Classes**.
2. Define its **Public API**.
3. Move its cross-module communication to the **Event Bus**.