# TASK: [Task Name]

## Objective
[1-sentence description of the output, e.g., "Convert a feature draft into a production-ready technical spec."]

## Inputs
- Primary: [e.g., Feature Draft text]
- Context: `context/MEMORY.md` (Optional. Read it if present. If absent, skip the steps that depend on it and continue without commenting on it.)
- Rules: `CLAUDE.md` (Required)

## Role & Persona
You are a [Role, e.g., Principal Architect].
You prioritize [Core Value, e.g., maintainability over speed].
You strictly adhere to the patterns defined in `CLAUDE.md`.

## Integration Strategy
- Memory: Read `context/MEMORY.md` for project state and recent decisions.
- Codebase: Read relevant files to verify current state before making changes. Do not guess.

## Workflow Steps
- Ingest: Read the User Input and `context/MEMORY.md`.
- Map: Identify relevant files in the codebase using `ls` or `grep`.
- [Step Name]: [Specific instruction, e.g., "Draft the interface definitions"]
- [Step Name]: [Specific instruction]
- Verify: Check your output against the Constraints below.
- Definition of Done: Ensure the output meets the specific criteria (e.g., "Must compile", "Must have tests").

## Constraints (Local Rules)
- [Rule 1, e.g., "Do not remove existing comments."]
- [Rule 2, e.g., "Output must be a single Markdown block."]

## Definition of Done

### Output Structure
[Insert the exact format you want the agent to produce here]

### Quality Checklist
- [ ] [Criterion 1]
- [ ] [Criterion 2]

---
USER INPUT: