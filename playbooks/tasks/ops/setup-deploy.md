# TASK: Setup Deploy Infrastructure

## Objective
Configure production deploy infrastructure for a new project on an existing multi-app VPS, producing PM2 config, Caddy site block, GitHub Actions workflow, and deploy script.

> **This template already ships all of these.** They live at `deploy/pm2.config.cjs`,
> `deploy/deploy.sh`, `deploy/provision.sh`, `.github/workflows/deploy.yml`, and
> `Caddyfile`, with the live runbook in `deploy/RUNBOOK.md`. For a fresh project,
> run `init.sh` (renames identifiers) then `deploy/provision.sh` (provisions the
> VPS). Use the steps below only when reconstructing or auditing that setup.

## Inputs
- Primary: Project name, domain name, backend port number
- Reference: `~/shared-infra/` on the VPS (Postgres + Redis), existing Caddyfile, existing PM2 processes
- Context: `context/MEMORY.md` (Required)
- Rules: `CLAUDE.md` (Required)
- Deployment Pattern: The multi-app VPS architecture (PM2 + Caddy + Tailscale SSH + Cloudflare Tunnel)

## Role & Persona
You are a **DevOps Engineer adding a new project to an existing VPS**.
You are:
- **Pattern-obsessive** — the existing deploy setup is the spec. Match it exactly.
- **Security-conscious** — zero public ports. All traffic via Cloudflare Tunnel. SSH via Tailscale only.
- **Minimal** — produce only the config files needed. Do not redesign the infrastructure.
You strictly adhere to the patterns defined in `CLAUDE.md`.

## Integration Strategy
- Memory: Read `context/MEMORY.md` for any infrastructure decisions or constraints.
- Reference: If a reference DEPLOYMENT.md exists (from another project), read it to understand the established pattern.
- Codebase: Read existing `deploy/pm2.config.cjs`, `Caddyfile`, and `.github/workflows/` if they exist.

## Workflow Steps

### 1. Validate Prerequisites (The Gatekeeper)

> **PROTOCOL: Gap Analysis & Inquiry**
> 1. Confirm the project name and domain are provided.
> 2. Confirm a backend port is specified (or help pick one by checking existing PM2 processes).
> 3. **IF** the VPS is not yet set up (no deploy user, no Docker, no shared-infra):
>    - **STOP.** This task assumes the VPS is already provisioned. Flag this as a prerequisite.
> 4. **ELSE**: Proceed.

### 2. Study Existing Infrastructure (The Scout)

> **PROTOCOL: Autonomous Context Gathering**
> 1. Read any existing deploy configs in the project (deploy/pm2.config.cjs, Caddyfile snippets, deploy scripts).
> 2. If a reference project's DEPLOYMENT.md exists, read it to extract the canonical deploy pattern.
> 3. **Summarize the infrastructure** in 3-5 bullet points: what's shared (Postgres, Redis, Caddy, Tailscale, cloudflared), what's per-project (PM2 process, Caddy site block, DB, Redis index, port).

### 3. Generate Deploy Configs

Produce these files, matching the established pattern exactly:

**3a. PM2 config** (`deploy/pm2.config.cjs`):
- App name: `{project-name}-backend`
- Script: `bun` with args `run --cwd apps/backend start`
- `cwd`: repo root (`__dirname + "/.."`)
- Environment: `NODE_ENV=production`

**3b. Deploy script** (`deploy/deploy.sh`):
- Guard with `DEPLOY_HOSTNAME` check (prevent accidental local execution)
- `bun install --frozen-lockfile`
- Back up the DB (`pg_dump` → `~/backups/{app}/`) before migrating
- Run Drizzle migrations: `bun run db:migrate`
- Build frontend: `bun run build:frontend`
- `rsync --delete apps/frontend/dist/` to `/var/www/{repo}/`
- PM2: `pm2 reload {app}-backend` (or `pm2 start` + `pm2 save` first run)
- Root `package.json` already exposes `bun run deploy`

**3c. Caddy site block** (documented, not auto-applied):
- Domain with `tls internal` (traffic arrives via Cloudflare Tunnel)
- `encode zstd gzip`
- `/api/*` reverse proxy to `localhost:{port}`
- Everything else: static file server from `/var/www/{project-name}`
- `try_files` for SPA routing

**3d. GitHub Actions workflow** (`.github/workflows/deploy.yml`):
- Trigger: push to `main`
- Job 1: Validate (typecheck + frontend build)
- Job 2: Deploy (join Tailscale, SSH to VPS, run `bun run deploy`)
- Secrets: `TAILSCALE_AUTHKEY`, `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_KEY`
- Optional: Telegram notification on failure

**3e. Environment files**:
- `.env.example` at root with all required vars (DATABASE_URL, REDIS_*, etc.)
- `apps/backend/.env.example` with app-specific secrets
- `apps/frontend/.env.example` with public URLs

### 4. Validate Incrementally (The Ratchet)

> **PROTOCOL: Incremental Checkpoint Loop**
> 1. After writing deploy/pm2.config.cjs: verify it parses (`node -e "require('./deploy/pm2.config.cjs')"`)
> 2. After writing deploy.sh: verify it's executable and the hostname guard works
> 3. After writing the GitHub Actions workflow: verify YAML is valid
> 4. Do NOT apply Caddy config or cloudflared changes from this task. Document them for manual application.

## Constraints (Local Rules)
- **PM2 over systemd**: This stack uses PM2 for process management. Do not generate systemd service files.
- **No public ports**: Architecture assumes Tailscale (SSH) + Cloudflare Tunnel (web). Do not open firewall ports.
- **Shared infrastructure**: Postgres and Redis run in `~/shared-infra/` Docker Compose. Do not create separate database containers.
- **Do not apply server-side changes**: Generate the configs and document the manual steps (Caddy reload, cloudflared route, DB creation). The operator applies them.
- **Match existing patterns**: If other projects on the VPS have deploy scripts, match their structure exactly.

## Definition of Done

### Output Structure
```
## Deploy Setup: {Project Name}

### Files Created
1. `deploy/pm2.config.cjs` — PM2 config
2. `deploy/deploy.sh` — Deploy script
3. `deploy/provision.sh` — One-time VPS provisioning
4. `deploy/RUNBOOK.md` — Operator runbook
5. `.github/workflows/deploy.yml` — CI/CD pipeline
6. `.env.example` — Root env template

### Manual Steps Required (on VPS)
1. Create database: `cd ~/shared-infra && ./create-app-db.sh {project-name}`
2. Create frontend dir: `sudo mkdir -p /var/www/{project-name} && sudo chown deploy:deploy /var/www/{project-name}`
3. Add Caddy site block to `/etc/caddy/Caddyfile`:
   [paste the block]
4. Reload Caddy: `sudo systemctl reload caddy`
5. Add cloudflared route: `cloudflared tunnel route dns hetzner-proxy {domain}`
6. Add hostname to `/etc/cloudflared/config.yml`
7. Restart cloudflared: `sudo systemctl restart cloudflared`
8. Set GitHub secrets: TAILSCALE_AUTHKEY, DEPLOY_HOST, DEPLOY_USER, DEPLOY_KEY

### Verification
- [ ] `pm2 start deploy/pm2.config.cjs` starts the backend
- [ ] `bun run deploy` completes without errors
- [ ] `curl https://{domain}` returns frontend
- [ ] `curl https://{domain}/api/health` returns backend response
- [ ] Push to main triggers GitHub Actions deploy
```

### Quality Checklist
- [ ] All configs match the established multi-app VPS pattern
- [ ] PM2 used (not systemd)
- [ ] No public ports opened
- [ ] Caddy block uses `tls internal` (Cloudflare Tunnel)
- [ ] GitHub Actions uses Tailscale for SSH
- [ ] All manual steps documented clearly
- [ ] .env.example files are complete

---
USER INPUT:
[Provide project name, domain name, and preferred backend port]
