- The benefit of every `bun install` must heavily outweight its cost, to earn its place
- Prefer vanilla TS over frameworks where possible.
- Functional Purity: No classes. Pure functions only. Zod for validation.
- No em-dashes (—) in content copy, marketing text, or user-facing writing. Use periods, commas, or restructure the sentence instead. Em-dashes are an obvious AI tell.

### Git

Never `git commit` or `git push` on your own unless the user explicitly says "commit and push".

### Playbooks (Tasks & Workflows)

My reusable task and workflow library lives at `~/.claude/playbooks/`. A **task** is
one job with a fixed schema (Objective / Inputs / Role & Persona / Integration /
Workflow / Constraints / Definition of Done). A **workflow** chains tasks, each step
emitting a file that feeds the next.

**How I invoke one.** Three doors, all equivalent: `/task <name>`, `/wf <name>`, or
naming it in prose ("run compose-workflow", "use plan-feature"). A local playbook I
can also `@`-mention directly by path.

**Resolution: local first, then global.** Whichever door I used, resolve in this order:

1. `playbooks/{tasks,workflows}/**/<name>.md` in the current project
2. `~/.claude/playbooks/{tasks,workflows}/**/<name>.md`

First hit wins. A project copy always overrides the global one. Read the file on
demand when the task is invoked. Never preload the library. If a name does not
resolve, say so and list near matches. Never improvise a playbook from its name.

Global holds what is project-agnostic: the framework (`_template.md`,
`_strategies.md`, `tasks.spec.md`), all of `meta/`, and my standard-stack
engineering, product, and ops tasks. Projects keep only genuinely
project-specific tasks locally. If a global task needs an edit that would only
suit one project, that is a signal to copy it local, not to fork global.

Grounding is per project: tasks read `context/MEMORY.md` and `CLAUDE.md` relative
to the project root. Architecture doctrine is global and lives at
`/home/luis/claymore/coding/vertical-slice-architecture.md`.

Legacy note: some repos still carry a full local `playbooks/` predating this split. Local-first means they keep
working untouched. Do not migrate one unless I ask.

**Global library index** (names only, so you can suggest one without reading the
directory; the file is the source of truth, and `create-task` / `compose-workflow`
keep this list current):

- tasks/engineering: audit-ai-navigability, audit-contrast, audit-file-structure, audit-security, critique-ui, design-ui, diagnose-bug, plan-feature, plan-milestones, read-image-set, refactor-code, review-code, scaffold-project, write-milestone-card, write-runbook, write-tests
- tasks/marketing: audit-blog-geo, define-business-wedge, draft-blog-post, fact-check-content, generate-geo-strategy, plan-blog-topics, plan-research, publish-blog-post, research-blog-brief, restyle-text, setup-blog-infra, setup-distribution-surface
- tasks/meta: compose-workflow, create-port-skill, create-task, interview-me, update-memory
- tasks/ops: setup-deploy, verify-stripe-conventions
- tasks/product: create-design-system, refine-spec
- tasks/research: research-topic
- workflows: audit-context-efficiency, audit-security, bootstrap-geo-content, bootstrap-project, build-ui, create-blog-post, fix-bug, plan-buildout, refactor-module, ship-feature

### Code Intelligence

Prefer LSP over Grep/Glob/Read for code navigation:
- `goToDefinition` / `goToImplementation` to jump to source
- `findReferences` to see all usages across the codebase
- `workspaceSymbol` to find where something is defined
- `documentSymbol` to list all symbols in a file
- `hover` for type info without reading the file
- `incomingCalls` / `outgoingCalls` for call hierarchy

Before renaming or changing a function signature, use
`findReferences` to find all call sites first.

Use Grep/Glob only for text/pattern searches (comments,
strings, config values) where LSP doesn't help.

After writing or editing code, check LSP diagnostics before
moving on. Fix any type errors or missing imports immediately.

### Legibility Pass (code rot from agentic work)

While editing, note the spots where you burned effort because pre-existing code
was unclear, undocumented, or missing context: a file you had to read three or
more times, a function you could only understand by tracing it by hand. Mention
them in one line at the end of your reply if any were bad enough to matter.

Do not run a full pass unprompted. `/legibility` runs it on demand and holds the
tiering rules. Measured 2026-08-06: running it automatically on every
code-editing session cost $0.10 and 17 seconds per session and returned no
finding on 3 of 3 firings, so it is now invoked rather than triggered.

### Google Calendar

Use the "Claude Tasks" calendar for scheduling actions, reminders, and deadlines.
- Calendar ID: `515eca68a9a433d17d4b58f8c51d1fd2dd1ea29e1dcfd33fd6e43c94bb1345dc@group.calendar.google.com`
- Timezone: Asia/Bangkok
- Do NOT put events on Luis's personal or "schedule" calendars. Only use "Claude Tasks".

