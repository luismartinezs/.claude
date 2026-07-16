# Spec for agentic tasks

It places the `tasks` folder inside `context/`, uses pure Markdown (no XML), and explicitly integrates with your `CLAUDE.md`, `.claude/skills`, and `MEMORY.md`.

### 1. The Architecture

Your codebase structure for Agentic Workflows:

```text
.
├── CLAUDE.md             # GLOBAL LAWS (Style guide, prohibited patterns)
├── .claude/
│   ├── skills/           # ATOMIC CAPABILITIES (e.g., create-component.md)
│   └── config.json       # MCP TOOLS (e.g., filesystem, postgres)
├── context/
│   ├── MEMORY.md         # PROJECT STATE (Decisions log, roadmap status)
├── playbook/
│   └── tasks/            # ORCHESTRATORS ("The Legos")
│       └── _template.md  # The standard definition (Copy this)

```

---

### 2. The Spec: `_template.md`

Save this file as `playbooks/tasks/_template.md`. It is the master pattern.

```markdown
# TASK: [Task Name]

## Objective
[1-sentence description of the output, e.g., "Convert a feature draft into a production-ready technical spec."]

## Inputs
- Primary: [e.g., Feature Draft text]
- Context: `context/MEMORY.md` (Required)
- Rules: `context/CLAUDE.md` (Required)

## Role & Persona
You are a [Role, e.g., Principal Architect].
You prioritize [Core Value, e.g., maintainability over speed].
You strictly adhere to the patterns defined in `context/CLAUDE.md`.

## Integration Strategy
- Memory: Read `context/MEMORY.md` for project state and recent decisions.
- Codebase: Read relevant files to verify current state before making changes. Do not guess.
- Relevant Paths:
    - `apps/backend/src/modules/`: Backend feature slices
    - `apps/frontend/src/modules/`: Frontend feature slices
    - `apps/mobile/modules/`: Mobile feature slices
    - `packages/api-types/src/`: Shared types and Zod schemas

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

```

---

### 3. Concrete Example: `playbooks/tasks/plan-feature.md`

Here is how a real "Lego" looks using this spec.

```markdown
# TASK: Plan Feature Implementation

## Objective
Create a comprehensive, step-by-step implementation plan for a new feature, ensuring no architectural conflicts.

## Inputs
- Primary: Feature Request (User Input)
- Context: `context/MEMORY.md`, `context/ARCHITECTURE.md`

## Role & Persona
You are a Senior Technical Lead. You assume the user's draft is incomplete and requires you to fill in edge cases and error handling. You value Atomic Commits and Type Safety.

## Integration Strategy
- Memory: Check `context/MEMORY.md` for recent library changes.
- Codebase: Read `package.json` and relevant files to verify installed versions before planning. Do not guess.

## Workflow Steps
- Analyze: Identify the core value and data mutations required.
- Gap Analysis: Read existing related files. Identify what is missing.
- Draft Plan: Create the plan using the Output Template.
- Review: Verify the plan handles "Sad Paths" (network errors, validation failures).
- Definition of Done: Ensure the plan includes Zod schemas, component hierarchy, and a testing strategy.

## Constraints
- No Mocking: Plan for real API integration from step 1.
- Database: Schema changes must be defined in Zod first.
- Testing: Every logical step must have a corresponding test strategy.

## Definition of Done

### Output Structure
# Implementation Plan: {Feature Name}

### 1. Data Modeling
```typescript
// Zod Schemas

```

### 2. Component Hierarchy
- `Parent`
- `Child`

### 3. Execution Checklist
- [ ] Step 1: Create types
- [ ] Step 2: Setup API Mock (if needed)
- [ ] Step 3: Implement UI

### Quality Checklist
- [ ] Zod schemas defined for all data models
- [ ] Component hierarchy diagram/list provided
- [ ] Execution checklist created with "sad path" coverage
- [ ] No "shared" folder imports unless absolutely necessary

---

USER INPUT:

```

### 4. How to Run It

1.  Reference the task file (e.g., `@playbooks/tasks/plan-feature.md`) in your AI coding agent.
2.  Provide your input after the task prompt.

The agent will now autonomously:
1.  Adopt the **Role**.
2.  Read your **Memory** and **Global Rules**.
3.  Execute the **Workflow**.
4.  Produce the **Output** in the correct format.

```