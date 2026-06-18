---
description: Restructure a codebase's meta/business layer into a standardized folder structure (playbooks, context, scripts, docs). Analyzes existing files, proposes a mapping, and executes after confirmation.
---

# Restructure Codebase

You are restructuring the meta/business layer of this codebase into a standardized structure. You do NOT touch application code (apps/, packages/, src/, lib/, etc.) or runtime data directories.

## Target Structure

The target organizes non-code files around two concepts:
- **Playbooks** — reusable processes for how work gets done (portable across projects)
- **Context** — project-specific business state and knowledge (not portable)

```
project-root/
├── playbooks/                    Reusable agent playbooks (portable)
│   ├── tasks/                    Atomic task specs, grouped by domain
│   │   ├── engineering/
│   │   ├── marketing/
│   │   ├── product/
│   │   ├── design/
│   │   ├── research/
│   │   ├── meta/
│   │   └── ops/
│   └── workflows/                Multi-task pipelines
│
├── context/                      Business context (this product, not portable)
│   ├── MEMORY.md                 Cross-cutting decision log
│   ├── product/                  Specs, personas, plans, backlogs
│   ├── engineering/              Audits, guides, checklists, architecture docs
│   ├── marketing/                Strategy docs, content plans
│   ├── research/                 Domain knowledge, references, validation
│   ├── ops/                      Deployment, infrastructure, runbooks, logs
│   └── scratchpad/               Temporary working space
│
├── scripts/                      Automation, grouped by business function
│   ├── engineering/              Linting, audits, code quality tools
│   ├── marketing/                Content generation, social media automation
│   └── ops/                      Deploy, database, backup, infrastructure
│
├── docs/                         Developer onboarding and setup guides
│
├── CLAUDE.md                     Source of truth for AI agent rules
├── AGENTS.md                     → references CLAUDE.md
├── GEMINI.md                     → references CLAUDE.md
```

### Classification Rules

Use these rules to classify files you find:

**playbooks/** — Reusable process definitions:
- Task specs that define how to do a type of work (implement a feature, write a blog post, debug an error)
- Workflow definitions that chain tasks together
- Cognitive strategies, templates, process documentation
- Test: "Would this file be useful in a completely different project?" → yes = playbook

**context/product/** — Product definition:
- Functional specs, PRDs, feature specs
- User personas, user research
- Project plans, roadmaps, backlogs
- Anything answering "what are we building and for whom?"

**context/engineering/** — Codebase health:
- Architecture docs, style guides, component guides
- Audit results, code quality reports
- PR checklists, contribution guides (that are project-specific)
- Boilerplate manifests

**context/marketing/** — Marketing artifacts:
- Channel strategies (SEO, social, content)
- Landing page copy, blog content plans
- Brand guidelines, messaging frameworks

**context/research/** — Accumulated knowledge:
- Domain research, competitor analysis
- Reference materials, external guides
- Validation experiments

**context/ops/** — Operations:
- Deployment guides, infrastructure docs
- Runbooks, incident logs
- Server configuration, tunnel/network docs

**scripts/engineering/** — Code quality automation:
- Linters, architecture checks, dependency audits
- Code measurement tools (complexity, entropy)
- Build verification

**scripts/marketing/** — Content automation:
- Social media content pipelines
- Image/asset generators
- Content scheduling tools

**scripts/ops/** — Infrastructure automation:
- Deploy scripts
- Database setup/reset/backup
- Server provisioning

**docs/** — Onboarding:
- Setup walkthroughs
- Third-party integration guides (OAuth, Stripe, etc.)
- "How to get this running" documentation

### What NOT to move

- Application source code (apps/, packages/, src/, lib/, modules/, shared/)
- Runtime data directories (content/, data/, assets/ that the app reads at runtime)
- Config files at root (package.json, tsconfig.json, docker-compose.yml, .env, etc.)
- Standard repo files at root (README.md, LICENSE.md)
- AI instruction files at root (CLAUDE.md, AGENTS.md, GEMINI.md, RULES.md, .cursorrules, etc.)
- Build output (dist/, build/, .astro/, .next/)
- Node modules, lock files

## Procedure

### Phase 1: Scan

1. List all top-level directories and root files
2. Identify which directories contain meta/business files vs. application code
3. Recursively scan meta directories for all files
4. Also check root for stray docs (DEPLOYMENT.md, CONTRIBUTING.md, CHANGELOG.md, etc.)
5. Check `scripts/` for mixed-purpose scripts

### Phase 2: Classify

For each file found in Phase 1, classify it into the target structure using the rules above. Build a mapping table:

```
| Current Path | Target Path | Reason |
|---|---|---|
| docs/architecture.md | context/engineering/architecture.md | Project-specific architecture doc |
| workflows/deploy.md | playbooks/workflows/deploy.md | Reusable process definition |
| DEPLOYMENT.md | context/ops/DEPLOYMENT.md | Project-specific ops doc |
```

Also identify:
- Files that are already in the right place (no move needed)
- Files that should be deleted (empty placeholders, redundant duplicates)
- AI instruction files that should be consolidated (multiple files saying the same rules)
- Cross-references that will need updating after moves

### Phase 3: Present

Show the user:
1. The proposed mapping table, grouped by action type (moves, deletions, consolidations)
2. A count of cross-references that will need updating
3. Any ambiguous files where classification isn't clear — ask the user to decide
4. The final target structure as a tree

Ask: "Does this mapping look right? Any files you want to reclassify or skip?"

### Phase 4: Execute (only after user confirms)

1. Create target directories
2. Use `git mv` for all moves (preserve history)
3. Delete confirmed files
4. Scan all remaining files for references to old paths and update them
5. Update package.json scripts if any script paths changed
6. Update AI instruction files (CLAUDE.md, etc.) if they reference moved files
7. Verify no broken references remain with a final grep

### Phase 5: Generate Reference Doc

Create `context/README.md` documenting the final structure, following this template:

```markdown
# Folder Structure

This repository is organized around two concepts: **the product** (code that ships)
and **the business** (everything needed to build, operate, and grow the product).

## Root
[tree of top-level directories with one-line descriptions]

## [Section for each major directory]
[contents and purpose]

## Design Principles
1. Playbooks are portable, context is not.
2. Grouped by business function, not file type.
3. [any project-specific principles]
```

## Important Notes

- Always use `git mv` to preserve history. Never `mv` + `git add`.
- Present the full plan before executing anything. Never move files without confirmation.
- When updating cross-references, search broadly: .md, .ts, .js, .sh, .json, .yml, .mjs, .cjs files.
- Do not touch files inside apps/, packages/, src/, lib/, or any directory that contains application source code.
- If the codebase has no meta/business files to restructure, say so and stop.
- If the codebase already follows this structure, say so and suggest only minor improvements if any.
