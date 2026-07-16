# Spec for agentic tasks

Tasks are pure Markdown (no XML) and integrate with your `CLAUDE.md` and `context/MEMORY.md`.

### 1. The Architecture

The library is global. Projects inherit it by reference and carry no copy.

```text
~/.claude/
├── CLAUDE.md                 # GLOBAL LAWS (style, prohibited patterns, resolution order)
└── playbooks/
    ├── tasks/
    │   ├── _template.md      # The standard definition (copy this)
    │   ├── _strategies.md    # Cognitive patterns to embed
    │   └── {domain}/         # ORCHESTRATORS ("The Legos"), {verb}-{noun}.md
    └── workflows/            # Chained tasks, {verb}-{noun}.md

<project>/
├── CLAUDE.md                 # PROJECT LAWS (stack, conventions)
├── context/
│   └── MEMORY.md             # PROJECT STATE (decisions log, roadmap status)
└── playbooks/                # OPTIONAL. Only for project-only overrides.
                              # A file here wins over the global one of the same name.
```

Resolution is local first, then global. See `tasks.README.md` for naming rules and the
execution protocol.

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
- Rules: `CLAUDE.md` (Required)

## Role & Persona
You are a [Role, e.g., Principal Architect].
You prioritize [Core Value, e.g., maintainability over speed].
You strictly adhere to the patterns defined in `CLAUDE.md`.

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

### 3. Concrete Example: `playbooks/tasks/engineering/plan-feature.md`

Here is how a real "Lego" looks using this spec.

```markdown
# TASK: Plan Feature Implementation

## Objective
Create a comprehensive, step-by-step implementation plan for a new feature, ensuring no architectural conflicts.

## Inputs
- Primary: Feature Request (User Input)
- Context: `context/MEMORY.md`

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

1.  Reference the task file (e.g., `@playbooks/tasks/engineering/plan-feature.md`) in your AI coding agent.
2.  Provide your input after the task prompt.

The agent will now autonomously:
1.  Adopt the **Role**.
2.  Read your **Memory** and **Global Rules**.
3.  Execute the **Workflow**.
4.  Produce the **Output** in the correct format.

```