# Wiring notes (reference: VPS + systemd + Caddy + Cloudflare)

The route in `healthz-route.ts` is only half the feature. The other half is
*where* it sits in the request pipeline and *what* watches it. These are the
parts a porting agent most often gets wrong.

## 1. Registration order — before rate-limit / auth

In the reference `index.ts` the readiness route is registered **immediately
before** the general IP rate limiter and any auth middleware:

```
app.use("*", requestId);          // cheap, safe to run first
app.get("/api/healthz", ...);     // <-- readiness probe, BEFORE the limiter
app.use("*", ipRateLimit);        // Redis-backed; polling would trip this
app.route("/", authRoutes);       // ...
```

Why it matters:

- **Frequent polling must not trip the rate limiter.** An uptime monitor hits
  the endpoint every 30–60s from one IP. Behind a global IP limiter that IP
  gets throttled and the probe starts returning 429 — a false outage.
- **The rate-limit store outage must not corrupt the signal.** The reference
  limiter is Redis-backed. If Redis is down, a probe registered *after* the
  limiter could fail on the limiter itself, reporting "not ready" for a reason
  that has nothing to do with readiness. Readiness must depend on the DB and
  nothing else.

Global concerns that are cheap and cannot reject the request (request-id,
logger) may run before it. Anything that can *reject*, *throttle*, or *depend on
another service* goes after.

## 2. Reverse-proxy path

The reference serves the backend behind Caddy, which routes `/api/*` to the Bun
process:

```
handle /api/* {
    reverse_proxy localhost:3001
}
```

That `/api` prefix is why the route is `/api/healthz` in code. The doctrine name
for the endpoint is `/healthz`; the `/api` prefix is a routing artifact of this
target. In a target where the backend owns the root, it is just `/healthz`.
Decision rule in PORTING.md step 0.

## 3. CDN edge cache — the silent masker

The reference domain is proxied by Cloudflare. **Cloudflare caches responses
(headers and body), not just static assets.** A cached `200 {"ok":true}` at the
edge would keep reporting healthy through a real DB outage — the exact failure
the probe exists to catch.

Two independent defenses, use both when a CDN is in front:

1. `Cache-Control: no-store` on the response (in the route — already there).
2. A CDN-level bypass/no-cache rule for the readiness path, because a
   misconfigured CDN can ignore origin cache headers.

If there is no CDN in front of the target, only defense #1 applies.

## 4. What watches it (the endpoint alone is useless)

Per infra doctrine (`vps-pm2-caddy-infra.md`):

- An **external** uptime monitor (UptimeRobot or equivalent — a swappable
  dependency) polls the endpoint **from off the box**. A monitor running on the
  same VPS dies with the VPS and reports nothing.
- It keys on the **HTTP status code**: 200 = up, 503 = down. The JSON body is
  for humans; the monitor does not parse it.
- Alerts fan out to a **Discord webhook** (single URL, JSON POST), the same
  channel as deploy-failure alerts.

Readiness vs liveness: process liveness ("is it running") is already handled by
the process manager (`Restart=always` in systemd). What the supervisor cannot
see is "process up, DB unreachable" — from the user's side a full outage. The
readiness probe exists to surface exactly that gap. This is why it pings the DB
and why it must not check non-critical downstream vendors (a flaky third party
would make it cry wolf).
