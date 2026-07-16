# Agentic Task Framework ("Legos")

## 1. Concept Definition
In this codebase, a Task is a self-contained, portable unit of work. It is a standardized Markdown specification that transforms a vague user intent into a specific, high-quality output.

* Philosophy: "Declarative over Imperative." We describe the *state* and *constraints* we want; the Task defines the *process* to get there.
* Role-Based: Each Task forces the Agent to adopt a specific, expert Persona (e.g., "Senior Architect" vs. "QA Engineer").
* Context-Aware: All Tasks are strictly grounded in the project's reality via `context/MEMORY.md`

## 2. Directory Structure
All tasks reside in `playbooks/tasks/`.
Each task is a single Markdown file named `{verb}-{noun}.md` (e.g., `plan-feature.md`, `debug-api.md`).

## 3. The Task Schema
Every Task file follows this structure. Agents creating or executing tasks adhere to these sections:

| Section            | Purpose                       | Agent Action                                                                 |
| :----------------- | :---------------------------- | :--------------------------------------------------------------------------- |
| Objective          | Defines success.              | Read this first to align on the goal.                                        |
| Inputs             | Required data/files.          | Verify these exist before starting.                                          |
| Role & Persona     | The specific expert required. | Shift context: Drop general assistant behavior; adopt this specific persona. |
| Integration        | Links to Memory/Codebase.     | Load Context: Read `MEMORY.md`; read relevant files.                         |
| Workflow           | The algorithm.                | Execute these steps sequentially. Do not skip steps.                         |
| Constraints        | Hard rules.                   | Verify the output against these rules before finishing.                      |
| Definition of Done | The contract & quality gate.  | Format the output exactly as requested and verify "Must Haves".              |

## 4. Execution Protocol
When a user triggers a Task (e.g., "Run `plan-feature` on this request"):

1.  Ingest: Read the Task file (e.g. `playbooks/tasks/plan-feature.md`) and the Global Rules (e.g. `CLAUDE.md`)
2.  Ground: Read `context/MEMORY.md` to load the latest project state.
3.  Adopt: Assume the Role defined in the Task.
4.  Execute: Follow the Workflow steps one by one.
5.  Output: Produce the artifact (code, plan, docs) using the Output Template.

## 5. Maintenance
* New Tasks: To create a new Lego, duplicate `playbooks/tasks/_template.md`.
* Refinement: If a Task fails or produces bad output, update the Constraints or Workflow in that specific Task file. Do not change the Global Rules unless the issue is systemic.
