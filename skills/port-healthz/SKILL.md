---
name: port-healthz
description: Port a public DB-readiness probe (/healthz) for external uptime monitors into a backend. A cheap SELECT 1 on the real pool, bounded by a timeout, returning 200 when ready and 503 when not, registered before rate-limiting/auth and never edge-cached. Use when asked to add a health check, readiness probe, /healthz, uptime endpoint, or "is the DB reachable" check. Contains the reference route, wiring notes, and porting/verification steps.
---

# port-healthz: DB Readiness Probe

You are porting a proven readiness endpoint from a reference codebase into
the current one. The code in `reference/healthz-route.ts` is ONE
instantiation (Hono + Bun + Drizzle/Postgres, behind Caddy + Cloudflare).
Adapt the framework plumbing, DB call, and route path to the target's
conventions. Do NOT impose the reference's stack or its `/api` prefix. Only
the invariants below must survive the port.

This is a small feature: one route plus correct placement. Most of the value
is the placement rules and the "why", captured in `reference/wiring-notes.md`.

## What the feature is

- A public, unauthenticated `GET /healthz` (`/api/healthz` in the reference,
  because Caddy routes `/api/*` to the backend).
- It runs a **cheap query against the real DB pool** (`SELECT 1`), bounded by
  a **timeout**. Success → `200 {"ok":true}`. Failure or timeout →
  `503 {"ok":false}`.
- It sends `Cache-Control: no-store` and, behind a CDN, must be excluded from
  edge caching.
- It is registered **before** rate-limiting and auth middleware.
- An **external** uptime monitor polls it from off the box and keys on the
  HTTP status code; alerts go to a Discord webhook. (Monitor/alerting setup is
  operational, out of code scope — but the route's contract exists to serve it.)

This probes **readiness** (can the app actually serve?), not **liveness** (is
the process up). Liveness is the process manager's job (`Restart=always`). The
gap readiness fills is "process up, DB unreachable" — invisible to the
supervisor, a full outage to the user.

## File inventory (reference/)

| File | Role |
|---|---|
| `healthz-route.ts` | The readiness route, verbatim + annotations. Includes a commented **deep-health sibling** (`/api/health`, also pings Redis) — a distinct diagnostic endpoint, port only if separately wanted. |
| `wiring-notes.md` | The non-code half: registration order, reverse-proxy path, CDN cache trap, and what watches the endpoint. Read this — it is where ports go wrong. |

## Invariants

1. **Readiness semantics: 200 ready / 503 not-ready.** The monitor keys on the
   status code, not the body. WHY: this is the machine contract; a 200 with a
   `{"ok":false}` body would read as healthy to every uptime monitor.
2. **Probes a real dependency, not just process liveness.** It executes an
   actual query on the live connection pool. WHY: it must catch "process up, DB
   down", the outage class the process supervisor cannot see.
3. **DB-only. No downstream/third-party checks.** WHY: a flaky non-critical
   vendor (Stripe, mail, even Redis) would make the probe cry wolf and page you
   for an outage that is not yours. Keep the dependency set to what a request
   genuinely cannot be served without. (The reference treats Redis as
   non-critical for readiness and checks it only in the separate deep-health
   endpoint.)
4. **Cheap query.** `SELECT 1` (or the dialect equivalent), nothing that scans
   or writes. WHY: the endpoint is polled every 30–60s forever; it must add
   negligible load.
5. **Bounded by a timeout, failing closed to 503.** WHY: a hung DB must produce
   a fast negative signal. Without the timeout the request hangs and the monitor
   records an ambiguous timeout instead of a clean "down".
6. **Public / unauthenticated.** WHY: the external monitor has no credentials.
7. **Registered before rate-limit and auth middleware.** WHY: frequent polling
   from one IP would trip a global rate limiter (false 429s), and a probe placed
   after a store-backed limiter (e.g. Redis) would fail for reasons unrelated to
   readiness. Only cheap, non-rejecting middleware (request-id, logging) may
   precede it.
8. **Never cached.** `Cache-Control: no-store`, plus a CDN bypass rule if a CDN
   fronts the origin. WHY: a cached 200 keeps reporting healthy straight through
   a live outage.
9. **If the target's DB client pools connections, an idle-connection error
   handler must be registered before the probe can fail closed.** Pooling
   clients emit an `error` event on *idle* connections when the database drops,
   and in Node an unhandled `'error'` event is rethrown by EventEmitter, which
   kills the process. WHY: without the handler the probe inverts its own
   purpose, because a database outage crash-loops the API instead of producing
   the 503 that invariant #1 promises. The probe makes this near-certain rather
   than rare, since polling every 30-60s guarantees a recently-idle connection
   exists at the moment the database goes down. Concretely, node-postgres needs
   `pool.on("error", handler)`; check the equivalent for any other pooling
   client. This is a property of the TARGET's client, not of the reference, so
   it cannot be carried over in the copied code and must be checked per port.

## Known adaptation points

- **Route path / prefix.** `/api/healthz` here only because Caddy routes
  `/api/*` to the backend. Decision rule: if the target's backend sits under a
  path prefix at the proxy, match it; if the backend owns the root, use
  `/healthz`. Match whatever prefix the target's other API routes already use.
- **Framework plumbing.** Reference is Hono (`app.get`, `c.header`, `c.json`).
  Adapt to the target: Express (`app.get`, `res.set`, `res.status().json()`),
  Fastify, raw Bun/Deno `fetch` handler, Go `http.HandleFunc`, etc. The route
  registration is instantiation, not invariant.
- **DB client + query dialect.** Reference is Drizzle: `db.execute(sql`SELECT
  1`)`. Translate to the target's client while keeping invariant #4:
  Prisma → `prisma.$queryRaw`SELECT 1``; node-postgres → `pool.query('SELECT
  1')`; an ORM with a `ping()`/`authenticate()` → use that if it does a real
  round-trip. Do NOT check a cached connection object; hit the pool.
- **Timeout value.** 2500ms in the reference. Decision rule: shorter than the
  monitor's own request timeout, longer than p99 DB latency under load. If
  unknown, 2000–3000ms is a safe default. Skip the manual `Promise.race` only if
  the DB client exposes a native query timeout — then set that instead.
- **Response body shape.** `{"ok":true}` / `{"ok":false}` is a convention;
  `{"status":"ok"}` etc. is equally fine. Only the status code is load-bearing.
  Keep the body tiny.
- **CDN cache bypass.** Only if a CDN (Cloudflare, etc.) fronts the target. Null
  class: **no CDN → skip entirely**, the `no-store` header is enough. Do not
  invent a CDN rule for a target that has none.
- **Deep-health sibling (`/api/health`).** Optional and distinct. Port it only
  if the target wants a human/debug endpoint that reports each dependency
  separately. It is NOT a substitute for the readiness probe and must not be the
  thing the uptime monitor polls.
- **Monitor + alerting wiring.** UptimeRobot polling + Discord webhook is
  operational config, outside this code port. Mention it in the final report so
  the user wires the external monitor; do not attempt it from code.

## Dependencies

**None.** The probe reuses the target's existing DB client. Adds zero packages.
If a port wants to add a rate-limit, HTTP, or monitoring library "for the health
check", that is a red flag — the endpoint is deliberately dependency-free.

## Process

Follow `PORTING.md`. Do not report done until the verification section passes,
including the negative test (break the DB, confirm 503).
