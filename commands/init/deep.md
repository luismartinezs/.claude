---
description: Deep init — analyze the codebase, create/update CLAUDE.md in root and relevant subfolders, and index file-level entry points.
allowed-tools: Bash(git ls-files:*), Bash(find:*), Bash(git rev-parse:*)
---

## Context (auto-collected)

- Git present? -> !`git rev-parse --is-inside-work-tree 2>/dev/null`
- Candidate files:

!`list-sources.sh`

## Your task

You are setting up *deep project memory* for Claude Code.

**A. Write/update root `./CLAUDE.md`**
Create or refresh a concise project guide:
1) Project overview and goals (infer from codebase).
2) How to build, test, run, and lint.
3) Architecture map: list top-level dirs with 1–2 line purpose each.
4) Conventions: code style, error handling, logging, env/secrets, testing strategy.
5) Key entry points: binaries, web entry, server start, deploy commands.
6) Pointers/imports to subfolder memories using `@path` imports.

**B. Decide “relevant subfolders” and create `CLAUDE.md` in each**
A subfolder is *relevant* if **any** is true:
- Contains a language/module root (`package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `pom.xml`, `build.gradle`, `Gemfile`, `composer.json`).
- Contains framework entry files (e.g., Next.js `app/` or `pages/`, API routes, `server.ts`, `main.go`, `cmd/*/main.go`, `src/**` roots).
- Contains ≥ 5 source files or ≥ 1 test suite for a module.
- Hosts CI/CD or infra (`.github/workflows`, `Dockerfile*`, `infra/**`, `terraform/**`).

For each chosen folder `X`, create/refresh `X/CLAUDE.md` (≤ 1,000 words) with:
- **Purpose**: what lives here and why.
- **How it’s used**: who calls it (module, route, CLI, job).
- **Public surface**: exported types/functions/components/CLIs.
- **Contracts & invariants**: inputs/outputs, side-effects, env vars, error modes.
- **Local run/test**: commands, fixtures, test data.
- **Gotchas**: coupling, performance, security, flaky points.
- **File index**: bullet summaries for each file (see C).

**C. For each source file, add a short bullet under that folder’s “File index”**
Limit 6–8 bullets per file (≤ ~120 words total). Detect *entry points* by language/framework:
- **Node/TS/JS**: `bin` in `package.json`; CLI shebang; Express/Fastify `app.listen`; Next.js pages/routes; server bootstrap (`index.ts`, `server.ts`); scripts in `package.json`.
- **Python**: `if __name__ == "__main__"`; console_scripts in `pyproject.toml/setup.cfg`; Flask `.run()`, FastAPI app; Celery workers.
- **Go/Rust**: `package main` + `func main()`; `cmd/*/main.go`; Rust binaries in `Cargo.toml`; `fn main()`.
- **Java/Kotlin/C#**: `main` methods; Spring Boot application class; ASP.NET `Program.cs`.
- **Web UI**: default-exported page components; route handlers; loaders/actions.
- **Infra**: `Dockerfile` `CMD`/`ENTRYPOINT`; Terraform root modules & providers; CI workflow triggers.
For each file, capture:
- What it exposes (CLI/HTTP route/component/module).
- How it’s invoked (by router, CLI, scheduler, import).
- Important flags/env/config it reads.
- Notable side-effects (I/O, network, DB).
- Any clear TODOs or tech debt found inline.

**D. Keep it lean and link-y**
- Prefer links within MD (`[path](relative/path)`).
- Use `@relative/path` imports in MD when a file should be auto-pulled into context by Claude Code later.
- Do not duplicate large code blocks. Summarize and reference.

**E. Execution plan**
1) Identify relevant subfolders via the heuristics above.
2) Draft the root `CLAUDE.md`, then write or update it.
3) For each relevant subfolder:
   - Generate the “File index” with entry points + notes.
   - Write or update `X/CLAUDE.md`.
