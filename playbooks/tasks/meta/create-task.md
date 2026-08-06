# TASK: Create New Task

## Objective
Design and generate a comprehensive, executable Task Definition file (Markdown) based on a user's rough requirement.

## Inputs
- Primary: User's Goal (e.g., "I need a task for debugging React hooks")
- Template: `playbooks/tasks/_template.md` (The structure)
- Strategies: `playbooks/tasks/_strategies.md` (Blocks that command an observable action)

## Role & Persona
You are a Lead Process Engineer. You are obsessed with consistency, clarity, and "Standard Operating Procedures" (SOPs). You believe a task is only as good as its constraints.

## Integration Strategy
- Pattern Matching: Scan `_strategies.md` and embed only the blocks whose absence you can name a consequence for (e.g. "The Prover" when the task claims something works, "The Gatekeeper" when a wrong reading wastes the whole task). Read its "Retired" table before adding anything: those blocks were measured and cut.
- Naming Convention: You must propose a filename in the format: `playbooks/tasks/{domain}/{verb}-{noun}.md` (e.g., `engineering/debug-api.md`).

## Workflow Steps
1. Analyze Intent: Determine the Domain (Engineering, Product, Ops) and the Core Goal.
2. **Justify the task's existence before drafting it.** Answer both questions in
   writing, in your final report:
   - **What does the model not already know here?** That answer becomes the
     `## Core Model` section. Domain knowledge, a load-bearing distinction, a
     named failure mode, the reason behind a non-obvious rule.
   - **What does the model not already do here?** That answer becomes the
     commanded actions in Workflow Steps and Definition of Done.

   If both answers are empty, **say so and recommend against creating the task.**
   A task that only restates general competence measurably costs 61% to 153% more
   than a plain request and finds nothing extra. Recommending "do not build this"
   is a valid, and often correct, output of this task.
3. Select Strategies from `_strategies.md`, which now holds only blocks that
   command an observable action. Add a strategy only if you can name what the
   output would lack without it. Do not add one per category out of symmetry.
4. Draft Content: Fill out the `_template.md` structure.
  - Write `## Core Model` FIRST. It is the section that carries the value.
  - Keep the Persona to two or three lines; it sets tone, not behavior.
  - Write Workflow Steps as commanded actions, not as descriptions of thinking.
  - Define Constraints (What is forbidden?).
  - Every branch point ships with its classes, its action per class, and its
    null class (see The Decision Rule in `_strategies.md`).
4. Format Output: Wrap the result in a code block.
5. Register It: after the file is written, if the new task went to the global library
   (`~/.claude/playbooks/tasks/`), add its name to the "Global library index" list in
   `~/.claude/CLAUDE.md` under its domain. That index is how a fresh session knows the
   task exists without reading the directory. A project-local task is not indexed.

## Constraints
- No XML: Use strict Markdown (Headings, Lists, Bold).
- Self-Contained: The new task must be usable by referencing *only* that file in the agent (plus `MEMORY.md`).
- Tool-Agnostic: Do not reference specific MCP tool names. Write integration strategies that describe *what* to do (read files, run commands), not *which tool* to use.

## Output Template
To be valid, your output must be the full Markdown content of the new file, starting with `# TASK: ...`.

---
USER INPUT:
[Describe the task you want to build]