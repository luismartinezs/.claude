# Porting Steps

## 0. Survey the target (all gating decisions happen HERE, before any code)

FIRST, read the target's own architecture docs (`CLAUDE.md`, `context/`,
`guides/`). On any conflict, **target docs override this skill** — including
route path and framework idiom, not just placement.

Then establish, each answer feeding a named decision:

- **Backend framework + route registration** → decides the route idiom
  (`app.get` vs a router module vs a `fetch` handler).
- **Middleware pipeline order**: is there a rate limiter or auth middleware
  applied globally, and what backs the limiter (Redis/in-memory)? → decides
  where the probe registers (invariant #7). Find the exact line the limiter is
  installed at.
- **DB client + how you run a raw query** → decides the `SELECT 1` translation
  (invariant #4). Check whether the client has a native query timeout.
- **Proxy/route prefix**: do the target's API routes live under `/api` (or
  similar) at the reverse proxy? → decides the path: `/healthz` vs
  `/api/healthz`.
- **Is a CDN in front of the origin?** (Cloudflare, Fastly, etc.) → decides
  whether step 4 (CDN bypass) runs at all. No CDN → that step is skipped.
- **Existing health/status route?** If one already exists, decide: extend it to
  meet the invariants, or add `/healthz` alongside it. Ask the user if it is
  ambiguous. Do not silently create a second overlapping endpoint.

If any decision is ambiguous (especially path and pipeline placement), ask the
user now — not after building.

## 1. Add the readiness route

Reference: `reference/healthz-route.ts`

- Write the route in the target's framework idiom.
- Body: `Cache-Control: no-store` header → timeout-bounded `SELECT 1` on the
  real pool → `200` on success, `503` on failure/timeout.
- Use a native DB query timeout if the client has one; otherwise the
  `Promise.race` timeout pattern from the reference. Default 2000–3000ms.
- Keep the response body tiny; only the status code is load-bearing.

## 2. Place it correctly in the pipeline

Reference: `reference/wiring-notes.md` §1

- Register the route **before** the rate limiter and auth middleware, **after**
  cheap non-rejecting middleware (request-id, logger).
- Concretely: find the line where the global limiter/auth is installed and put
  the route registration above it.

**Toolchain check now (not at the end):** run the target's **typecheck** command
against the new code immediately. A health route is small but touches the DB
client's types and the framework's context types — catch a bad import or a
wrong `sql`/query signature here, before anything stacks on top.

## 3. Path + prefix

Reference: `reference/wiring-notes.md` §2

- Register at `/healthz`, or under the target's API prefix if its other routes
  live there (e.g. `/api/healthz`). Match the target, do not copy `/api`
  blindly.

## 4. CDN bypass — ONLY if a CDN fronts the target

Reference: `reference/wiring-notes.md` §3

- Add a no-cache / bypass rule for the readiness path at the CDN.
- Keep the `Cache-Control: no-store` header regardless (defense in depth).
- **No CDN in the target → skip this step entirely.** Do not invent a rule.

## 5. Deep-health sibling — ONLY if separately requested

Reference: commented block in `reference/healthz-route.ts`

- Port `/health` (DB + other deps reported individually) only if the user wants
  a diagnostic endpoint in addition to the readiness probe. It does not replace
  `/healthz` and the monitor still polls `/healthz`.

## Verification (use the TARGET's commands)

1. **Typecheck** the backend — expect clean (should already be, from step 2).
2. **Build** the backend with the target's build command — expect success.
3. **Happy path**: start the dev stack, `curl -i` the endpoint against a
   reachable DB → expect `HTTP/1.1 200` and `Cache-Control: no-store` in the
   headers.
4. **NEGATIVE test (mandatory — proves the guard survived the port):** point the
   backend at an unreachable DB, `curl -i` the endpoint → expect `HTTP/1.1 503`
   returned **within the timeout window** (not a hung request). Restore the DB
   and confirm 200 again.

   **Prefer HANGING the DB over stopping it** (`docker pause`, or a firewall
   drop), and run the stopped case as well. WHY: a stopped DB refuses the
   connection instantly, so the request returns 503 in milliseconds and the test
   passes even when the timeout is broken or absent. Only a hung DB exercises
   invariant #5, and only the hung case tells you whether the timeout bound
   actually holds. Expect the 503 to arrive just after your configured timeout
   (e.g. ~2.5s for a 2500ms bound), not immediately.

   **If the process dies instead of returning 503, that is invariant #9**, not a
   flaky test: register the pool's idle-connection error handler (see SKILL.md
   invariant #9) and re-run. Watch for this specifically, because the symptom
   looks like a dead port rather than a failed assertion.
5. **Placement check**: if the target has a global IP rate limiter, hit the
   endpoint rapidly (more requests than the limit) → expect **all 200s**, never
   a 429. A 429 proves the route is registered after the limiter — fix the
   order.
6. **Cache check** (if a CDN fronts it): `curl -I` through the public domain
   twice → expect no `cf-cache-status: HIT` (or equivalent) on the readiness
   path.
7. **Report**: the route path chosen and why, its pipeline position (which
   middleware it precedes), the DB query + timeout used, whether the CDN step
   ran, whether the deep-health sibling was ported, and the reminder that the
   user still needs to wire an **external uptime monitor + Discord alert**
   (out of code scope).

## Friction report

If the target's reality forced deviations from this skill, or you hit a trap it
did not warn about (a framework whose middleware order works differently, a DB
client with no raw-query escape hatch, a CDN that ignores `no-store`), report it
to the user and propose the generalized skill edit — a rule, not a
target-specific patch.
