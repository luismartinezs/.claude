// REFERENCE INSTANTIATION — Hono + Bun + Drizzle/Postgres.
// This is ONE way to express the invariants in PORTING.md, not literal truth.
// Copied verbatim from the reference backend's `index.ts`. Adapt the framework
// plumbing (route registration, DB call, header helper) to your target.

import { db, sql } from "@repo/db"; // Drizzle client + `sql` tag. Target: whatever the DB client is.

// === READINESS ===
// Public, DB-only readiness probe for uptime monitors. Registered before the
// rate limiter so a Redis outage or frequent polling never affects the signal.

const READINESS_TIMEOUT_MS = 2500;

app.get("/api/healthz", async (c) => {
  c.header("Cache-Control", "no-store"); // INVARIANT: a cached 200 masks a live outage.
  try {
    await Promise.race([
      // INVARIANT: cheap round-trip on the REAL pool. `SELECT 1`, nothing heavier.
      db.execute(sql`SELECT 1`),
      // INVARIANT: bound the check. A hung DB must yield a fast 503, not a hung request.
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("DB readiness check timed out")), READINESS_TIMEOUT_MS);
      }),
    ]);
    return c.json({ ok: true }); // 200
  } catch {
    return c.json({ ok: false }, 503); // INVARIANT: 503 = not ready. The monitor keys on the STATUS CODE.
  }
});

// ---------------------------------------------------------------------------
// SIBLING VARIANT — DEEP HEALTH (distinct from readiness; do NOT conflate).
// The reference also exposes `/api/health`, a richer check that also pings
// Redis and reports each dependency. This is a human/debug endpoint, NOT the
// thing the uptime monitor polls. Readiness (`/healthz`) stays DB-only and
// cheap on purpose (see doctrine: don't cry wolf on a flaky non-critical dep).
// Port this ONLY if the target wants a diagnostic endpoint in addition to the
// readiness probe.
//
// app.get("/api/health", async (c) => {
//   try {
//     const [dbResult, redisResult] = await Promise.all([
//       db.execute(sql`SELECT 1`).then(() => "ok" as const),
//       redis.ping().then(() => "ok" as const),
//     ]);
//     return c.json({ status: "ok", db: dbResult, redis: redisResult });
//   } catch (e) {
//     const message = e instanceof Error ? e.message : "unknown";
//     return c.json({ status: "degraded", error: message }, 503);
//   }
// });
