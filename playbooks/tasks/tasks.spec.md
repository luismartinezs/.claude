# Spec for agentic tasks

Tasks are pure Markdown (no XML). A **task** is one job with a fixed schema. A
**workflow** chains tasks, each step emitting a file that feeds the next.

This file is the doctrine. It deliberately **does not copy** `_template.md` or any
example task, because the previous version did and both copies drifted out of
date. Read the real files instead; the paths are below.

---

## 1. Architecture

The library is global. Projects inherit it by reference and carry no copy.

```text
~/.claude/
├── CLAUDE.md                 # GLOBAL LAWS (style, prohibited patterns, resolution order)
└── playbooks/
    ├── tasks/
    │   ├── _template.md      # The schema. Copy this to start a task.
    │   ├── _strategies.md    # Blocks that command an observable action
    │   └── {domain}/         # Tasks, {verb}-{noun}.md
    └── workflows/            # Chained tasks, {verb}-{noun}.md

<project>/
├── CLAUDE.md                 # PROJECT LAWS (stack, conventions)
├── context/
│   └── MEMORY.md             # PROJECT STATE (decisions log, roadmap status)
└── playbooks/                # OPTIONAL. Only for project-only overrides.
                              # A file here wins over the global one of the same name.
```

Resolution is local first, then global. See `tasks.README.md` for naming rules
and the execution protocol.

---

## 2. What earns a place in a task

This is the load-bearing section, and it was written from measurement rather than
taste. In 8 A/B runs across 3 task types (2026-08-06), playbook sections that
**described how to think** produced exactly the same findings as a plain request
while costing 61% to 153% more. Sections that **commanded an action** changed the
output every time.

So a task is worth writing only if it carries at least one of two things.

1. **Knowledge the model cannot infer** from the code in front of it. A
   distinction that decides the task, a classification scheme, a named failure
   mode, the reason behind a non-obvious rule. This goes in `## Core Model`.
2. **An action the model would not take by default.** Run a check that fails on
   the broken version. Apply the fix and prove it. Stop and ask rather than
   assume. Delete the scratch file. This goes in Workflow Steps and in the gate
   under Definition of Done.

If a draft task has neither, **do not create it.** `meta/create-task.md` is
required to check this and is explicitly allowed to recommend against building
the task. A task that only restates general competence is measurably worse than
typing the request directly.

**What does not earn a place:** personas beyond two or three lines, instructions
to be adversarial or thorough or careful, "read the surrounding code first",
mental simulation, and confidence scores. The first five are things a capable
model already does. The last is a presentation choice, kept in `_strategies.md`
under output-format blocks and labelled as such.

---

## 3. The schema

Defined by `_template.md`, which is the single source of truth. Sections, in
order:

1. `## Objective` (one sentence, names the output)
2. `## Inputs` (primary, plus context files and whether each is optional)
3. `## Role & Persona` (two or three lines, sets tone only)
4. `## Core Model` (the knowledge; write this first, or reconsider the task)
5. `## Workflow Steps` (commanded actions, in order)
6. `## Constraints (Local Rules)` (what is forbidden)
7. `## Definition of Done` (the gate, the output structure, the quality checklist)

Rules that hold across every task:

- **Self-contained.** A task must be usable by referencing only that file plus
  `CLAUDE.md`. Strategy blocks are inlined, not linked. The consequence is that
  retiring a block from `_strategies.md` does not edit tasks that already copied
  it, so `_strategies.md` carries a migration note listing what is stale.
- **Tool-agnostic.** "Run the target's typecheck command", never a command copied
  from one repo.
- **Every branch point ships a decision rule**: the classes, the action per class,
  and the null class stated explicitly.
- **Optional context degrades quietly.** If `context/MEMORY.md` is absent, skip
  the steps that need it and say nothing about it.
- **Quality checklist items must be answerable yes or no from the output alone.**

---

## 4. Worked examples, by what they demonstrate

Read the file, do not trust a summary of it.

| Read this | For |
|---|---|
| `meta/create-port-skill.md` | The best `## Core Model` in the library: the invariant / adaptation point / instantiation classification, and the failure mode of confusing the third for the first. |
| `engineering/diagnose-bug.md` | A Core Model that changes the analysis (discriminating vs confirming symptoms) plus a differential-check gate. Measured as an improvement at equal cost. |
| `engineering/write-tests.md` | A gate that costs real money and buys real assurance: the mutation check, and the rule against pinning a defect as the spec. |
| `engineering/review-code.md` | A gate with a known sharp edge: requiring a trigger raises evidence quality but can demote a true Critical, so it carries a named-class exception. |

---

## 5. How to run one

Three doors, all equivalent: `/task <name>`, `/wf <name>`, or naming it in prose
("run compose-workflow"). A local playbook can also be referenced by path with
`@`. Resolution is local first, then global; if a name does not resolve, the
command says so and lists near matches rather than improvising.

---

## 6. How the library changes

- **Adding a task**: `meta/create-task.md`, which must first justify the task
  against section 2 and register it in the global index in `~/.claude/CLAUDE.md`.
- **Adding a port skill**: `meta/create-port-skill.md`.
- **Fixing a task**: every reusable task ends with the friction-report
  instruction, so the agent that hit a trap proposes the generalized rule. A task
  is a hypothesis until something real runs through it.
- **Retiring a strategy**: move it to the Retired table in `_strategies.md` with
  the reason, and do not batch-rewrite the tasks that inlined it. Rewrite each
  when you next touch it, so every change stays attached to a real use.
