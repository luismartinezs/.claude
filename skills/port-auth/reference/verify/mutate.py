import subprocess, sys
M = [
 ("apps/api/src/platform/http.ts", "if (!isAllowedOrigin(origin, isProduction, env.APP_ORIGIN)) {", "if (false) {", "origin guard disabled"),
 ("apps/api/src/domains/auth/api.ts", 'if (!statesMatch(expectedState, c.req.query("state")))', "if (false)", "state check disabled"),
 ("apps/api/src/domains/auth/google.ts", 'if (!claims.data.email_verified) return { rejected: "unverified_email" }', "", "email_verified ignored"),
 ("apps/api/src/domains/auth/google.ts", 'if (claims.data.aud !== clientId) return { rejected: "audience" }', "", "audience ignored"),
 ("apps/api/src/domains/auth/service.ts", ".delete(loginTokens)\n    .where(", ".update(loginTokens).set({ createdAt: new Date() })\n    .where(", "link reusable"),
 ("apps/api/src/domains/auth/service.ts", "values({ tokenHash: hashToken(token), accountId, expiresAt })", "values({ tokenHash: token, accountId, expiresAt })", "session stored raw"),
 ("apps/api/src/domains/auth/api.ts", "  if (previous) await destroySession(previous)\n", "", "no session replacement"),
 ("apps/api/src/domains/auth/api.ts", "  if (token) await destroySession(token)\n  clearSessionCookie(c)", "  clearSessionCookie(c)", "signout only clears cookie"),
 ("apps/api/src/domains/auth/api.ts", "AUTH_LIMITS.emailRequestPerAddress)) {", "{ limit: 1000, windowSeconds: 1 })) {", "per-address limit disabled"),
 ("apps/api/src/app.ts", 'app.use("/api/*", requireSameOrigin)', 'app.use("/api/*", (await import("hono/cors")).cors({ origin: (o) => o, credentials: true }))', "reflective CORS reintroduced"),
 ("apps/api/src/domains/auth/api.ts", 'const email = body.success ? await consumeLoginToken(body.data.token) : null', 'const email = body.success ? await consumeLoginToken(body.data.token) : "attacker@example.com"', "bad token accepted"),
]
for path, old, new, label in M:
    orig = open(path).read()
    if orig.count(old) != 1:
        print("SKIP (pattern)", label); continue
    try:
        open(path, "w").write(orig.replace(old, new))
        r = subprocess.run(["pnpm", "exec", "vitest", "run", "apps/api"], capture_output=True, timeout=180)
        print(("caught:   " if r.returncode else "SURVIVED: ") + label)
    finally:
        open(path, "w").write(orig)
