# Workflow: Bootstrap Project

## Starting State
A product idea exists (rough or refined). No code has been written yet.

## End State
A complete monorepo skeleton is scaffolded (Bun workspaces, Astro + Vue, Hono, Drizzle, Tailwind) as vertical slices, design system generated, deploy infrastructure configured. Ready for feature development.

## Reference
Slice shape, `shared.ts` role, cross-slice communication channels, and split criteria: `/home/luis/claymore/coding/vertical-slice-architecture.md`. Read before Step 2.

## Tools Discovered
- Tasks: `product/refine-spec`, `engineering/scaffold-project`, `product/create-design-system`, `ops/setup-deploy`
- Scripts: `bun run typecheck` (validation), `bun install` (dependency resolution)
- Gaps: None. Full coverage with existing tasks.

## Steps

1. **Refine Spec**
   - Input: Rough product idea, user description, or draft spec
   - Task: `playbooks/tasks/product/refine-spec.md`
   - Output: Unambiguous spec with user roles, features, data model, routes, and env vars
   - Gate: User confirms spec is complete before proceeding.
   - Skip condition: If user provides a detailed spec with data model and routes defined, skip to Step 2.

2. **Scaffold Project**
   - Input: Refined spec from Step 1
   - Task: `playbooks/tasks/engineering/scaffold-project.md`
   - Output: Working monorepo skeleton with shared packages, backend slices, frontend, docker-compose
   - Constraint: Vertical slices per the architecture doctrine. One file per slice, no cross-slice imports, `shared.ts` for mechanical infra only. Must pass `bun run typecheck`.
   - Gate: User confirms the skeleton compiles and the file structure matches expectations.

3. **Create Design System**
   - Input: Seed color (hex), font family, density preference (from spec or user)
   - Task: `playbooks/tasks/product/create-design-system.md`
   - Output: `design-system.css` with OKLCH palette, type scale, spacing scale, dark mode
   - Skip condition: If the product has no frontend (API-only), skip.
   - Gate: User confirms the palette looks right.

4. **Setup Deploy Infrastructure**
   - Input: Project name, domain name, backend port
   - Task: `playbooks/tasks/ops/setup-deploy.md`
   - Output: PM2 config, deploy script, GitHub Actions workflow, Caddy site block (documented), env templates
   - Constraint: Does not apply server-side changes. Outputs documentation for manual VPS setup.
   - Gate: User confirms deploy config is correct before applying to VPS.

## Gaps & Recommendations
- VPS provisioning (initial server setup, Tailscale install, cloudflared install) is NOT covered by this workflow. It assumes the VPS is already running with shared-infra. If starting from scratch, follow the DEPLOYMENT.md guide for initial VPS setup first.
- Database creation and cloudflared route addition are documented as manual steps in Step 4. They require SSH access to the VPS.
- For products that need auth from day one, consider running `ship-feature` immediately after bootstrap to implement the auth feature slice.
