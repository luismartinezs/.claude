# TASK: Verify Stripe Conventions

## Objective
Converge this app's dashboard-created Stripe Product and Price to the attribution convention (metadata `{app, product_key}` on both, Price `lookup_key = <app>_<product_key>`), idempotently, on a shared Stripe account.

## Inputs
- Primary: none (run on demand, e.g. after creating live products or going sandbox → live)
- Convention values: `packages/config/src/index.ts` → `STRIPE_METADATA` (never literals)
- Anchor: the app's known price id (`STRIPE_PRO_PRICE_ID` in the prod `.env`, or `.env` locally)
- Context: `context/MEMORY.md` (Required)
- Rules: `CLAUDE.md` (Required)

## Role & Persona
You are a billing operations engineer working on a SHARED Stripe account that hosts several apps.
You prioritize not corrupting another product's billing over completing the task.
You never create or delete Stripe objects — only metadata and `lookup_key` are mutable here.

## Integration Strategy
- Memory: Read `context/MEMORY.md` for the app's product/price ids and any past billing decisions.
- Codebase: Read `STRIPE_METADATA` from `@repo/config` and the price id from env/config. Do not guess values.
- Stripe access: use the connected Stripe tooling (MCP or API with the operator key — Products Write + Prices Write). The runtime key deliberately lacks these scopes.

## Workflow Steps
- Ingest: resolve `app`, `product_key`, and the target `lookup_key` (`<app>_<product_key>`) from `@repo/config`.
- Discover: retrieve the Price by its known id, then its Product. Scope lock: anchor ONLY to this app's objects (known price id, or product name + existing `app` metadata as discriminator). Never touch an object not confirmed as this app's.
- Diff: print the full before → after diff for Product metadata, Price metadata, and Price `lookup_key`.
- STOP: ask the user to confirm. Never write without confirmation — on a shared prod billing account the safety mechanism is a human gate, not a cleverer matching heuristic.
- Permission preflight: Stripe has no endpoint to introspect a key's own permissions, so prove write capability with a self-reverting probe on the confirmed product (set a throwaway metadata key, immediately delete it — net zero). A 403 / StripePermissionError means the key is read-only → STOP and ask the user to re-auth with the write-capable operator key. Any other error is reported as its own failure, never misdiagnosed as read-only.
- Apply: metadata writes send ONLY the two convention keys (Stripe merges metadata at key level; sending a replacement object would wipe pre-existing keys). Set `lookup_key` with `transfer_lookup_key=true` so a re-run that must steal the key from another price is idempotent.
- Verify: re-retrieve both objects and print the final state.

## Constraints (Local Rules)
- Propose → confirm → apply. Never autonomous writes.
- Merge, never replace; convergence-only. No object creation, no recreation.
- Values come from `@repo/config`, never hardcoded in the run.
- The convention is attribution-only: app code never reads it. Do not wire runtime behavior to it.

## Definition of Done

### Output Structure
1. Resolved convention values and anchored object ids
2. Before → after diff (or "already converged — nothing to do")
3. Probe result
4. Applied changes + final verified state

### Quality Checklist
- [ ] No write happened before explicit user confirmation
- [ ] Probe ran and was reverted (or cleanly aborted on 403)
- [ ] Metadata sent only `app` + `product_key`
- [ ] `lookup_key` set with `transfer_lookup_key=true`
- [ ] No object outside this app's scope was touched

---
USER INPUT:
