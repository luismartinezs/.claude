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

Keep this to two or three lines. A persona does not change what gets found; it
only sets tone. The work happens in Core Model and Workflow Steps.

## Core Model
[**The most valuable section, and the one to write first.** Put here the domain
knowledge the model cannot infer from the code in front of it: a distinction that
decides the whole task, a classification scheme, a failure mode with a name, the
reason a non-obvious rule exists.

The test: would a capable model with no access to this file arrive at the same
framing on its own? If yes, delete the section rather than filling it. If the
task has no such knowledge, that is a signal the task may not be worth writing.

Worked example, from `meta/create-port-skill.md`: "Every piece of the feature
must be classified into exactly one of invariants (must survive any port),
adaptation points (expected to differ per target), or reference instantiation
(one concrete example, never literal truth). Misclassifying instantiation as
invariant is the main failure mode of ported features."]

## Workflow Steps
- Ingest: read the input and the files it names.
- [Step Name]: [a specific instruction. Prefer commanded actions over described
  thinking. "Run the target's typecheck" beats "consider type safety".]
- [Step Name]: [Specific instruction]
- Verify: [name the check that must pass, and what it is run against]
- Definition of Done: [the objective criteria, e.g. "typecheck clean", "the
  negative test fails on the unfixed version"]

## Constraints (Local Rules)
- [Rule 1, e.g., "Do not remove existing comments."]
- [Rule 2, e.g., "Report findings outside the named scope as one line each, unfixed."]

## Definition of Done

### Output Structure
[Insert the exact format you want the agent to produce here]

### Quality Checklist
- [ ] [Criterion 1, stated so it can be answered yes or no from the output alone]
- [ ] [Criterion 2]

---
USER INPUT:
