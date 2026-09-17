import { readdirSync, readFileSync } from "node:fs"
import { afterAll, beforeEach, describe, expect, test } from "vitest"
import { eq, like, sql } from "drizzle-orm"
import { app } from "../../app.ts"
import { db } from "../../platform/db.ts"
import { OUTBOX_DIR } from "../../platform/email.ts"
import { env } from "../../platform/env.ts"
import { hashToken } from "../../platform/ids.ts"
import { accounts, loginTokens, sessions } from "../../db/schema/index.ts"
import { SESSION_COOKIE } from "./session-cookie.ts"
import { AUTH_LIMITS } from "./api.ts"
import { resolveAccount, SESSION_RENEW_WITHIN_MS, validateSession } from "./service.ts"

/**
 * Drives the real HTTP app against the real database. Runs with ./test, which
 * starts PostgreSQL and applies migrations first.
 */

const RUN = `authtest-${Date.now()}`
const address = (label: string) => `${RUN}-${label}@example.com`

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  app.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: env.APP_ORIGIN, ...headers },
    body: JSON.stringify(body),
  })

const sessionCookieFrom = (response: Response): string | null => {
  const header = response.headers.getSetCookie().find((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`))
  return header ? header.split(";")[0]!.slice(SESSION_COOKIE.length + 1) : null
}

const latestLinkToken = (to: string): string => {
  const messages = readdirSync(OUTBOX_DIR)
    .sort()
    .reverse()
    .map((file) => JSON.parse(readFileSync(`${OUTBOX_DIR}${file}`, "utf8")) as { to: string; text: string })
  const message = messages.find((m) => m.to === to.toLowerCase())
  const token = message?.text.match(/login_token=([A-Za-z0-9_-]+)/)?.[1]
  if (!token) throw new Error(`no sign-in link captured for ${to}`)
  return token
}

const signInByEmail = async (email: string): Promise<string> => {
  expect((await post("/api/auth/email/request", { email })).status).toBe(200)
  const response = await post("/api/auth/email/verify", { token: latestLinkToken(email) })
  expect(response.status).toBe(200)
  return sessionCookieFrom(response)!
}

const sessionFor = async (cookie: string) => {
  const response = await app.request("/api/auth/session", { headers: { Cookie: `${SESSION_COOKIE}=${cookie}` } })
  return (await response.json()) as { account: { id: string; email: string } | null }
}

beforeEach(async () => {
  // In-process requests share one "local" client IP; start each test with fresh windows.
  await db.execute(sql`delete from rate_limits where key like 'auth-email-%:local'`)
})

afterAll(async () => {
  await db.delete(accounts).where(like(accounts.email, `${RUN}-%`))
  await db.delete(loginTokens).where(like(loginTokens.email, `${RUN}-%`))
})

describe("magic link", () => {
  test("a link signs in once, and the server stores neither token in plaintext", async () => {
    const email = address("once")
    expect((await post("/api/auth/email/request", { email })).status).toBe(200)
    const token = latestLinkToken(email)

    expect(await db.select().from(loginTokens).where(eq(loginTokens.tokenHash, token))).toHaveLength(0)
    expect(await db.select().from(loginTokens).where(eq(loginTokens.tokenHash, hashToken(token)))).toHaveLength(1)

    const verified = await post("/api/auth/email/verify", { token })
    expect(verified.status).toBe(200)
    const setCookie = verified.headers.getSetCookie().join("\n")
    expect(setCookie).toMatch(/HttpOnly/)
    expect(setCookie).toMatch(/SameSite=Lax/)

    const cookie = sessionCookieFrom(verified)!
    expect(await db.select().from(sessions).where(eq(sessions.tokenHash, cookie))).toHaveLength(0)
    expect(await db.select().from(sessions).where(eq(sessions.tokenHash, hashToken(cookie)))).toHaveLength(1)
    expect((await sessionFor(cookie)).account?.email).toBe(email)

    const reused = await post("/api/auth/email/verify", { token })
    expect(reused.status).toBe(401)
  })

  test("addresses are normalized, so case variants reach the same account", async () => {
    const email = address("case")
    const first = await sessionFor(await signInByEmail(email))
    const second = await sessionFor(await signInByEmail(email.toUpperCase()))
    expect(second.account?.id).toBe(first.account?.id)
  })

  test("the request response is identical for known and unknown addresses", async () => {
    const known = address("known")
    await signInByEmail(known)
    const a = await post("/api/auth/email/request", { email: known })
    const b = await post("/api/auth/email/request", { email: address("unknown") })
    expect([a.status, await a.text()]).toEqual([b.status, await b.text()])
  })

  test("an expired link is refused", async () => {
    const token = "expired-token-expired-token-expired-token"
    await db.insert(loginTokens).values({
      tokenHash: hashToken(token),
      email: address("expired"),
      expiresAt: new Date(Date.now() - 1000),
    })
    expect((await post("/api/auth/email/verify", { token })).status).toBe(401)
  })

  test("a malformed or missing token never signs anyone in", async () => {
    for (const body of [{ token: "short" }, {}, { token: 42 }]) {
      const response = await post("/api/auth/email/verify", body)
      expect(response.status).toBe(401)
      expect(sessionCookieFrom(response)).toBeNull()
    }
  })

  test("an invalid address is a bad request", async () => {
    expect((await post("/api/auth/email/request", { email: "not-an-email" })).status).toBe(400)
  })

  test("one address cannot be sent unlimited links", async () => {
    const email = address("flood")
    const statuses: number[] = []
    for (let i = 0; i <= AUTH_LIMITS.emailRequestPerAddress.limit; i++) {
      statuses.push((await post("/api/auth/email/request", { email })).status)
    }
    expect(statuses.at(-1)).toBe(429)
    expect(statuses.slice(0, -1).every((status) => status === 200)).toBe(true)
  })
})

describe("sessions", () => {
  test("signing out ends the session on the server, not just in the browser", async () => {
    const cookie = await signInByEmail(address("signout"))
    const signout = await post("/api/auth/signout", {}, { Cookie: `${SESSION_COOKIE}=${cookie}` })
    expect(signout.status).toBe(200)
    expect((await sessionFor(cookie)).account).toBeNull()
    const protectedRead = await app.request("/api/profile", { headers: { Cookie: `${SESSION_COOKIE}=${cookie}` } })
    expect(protectedRead.status).toBe(401)
  })

  test("signing in again replaces the session the browser already held", async () => {
    const email = address("rotate")
    const first = await signInByEmail(email)
    await post("/api/auth/email/request", { email })
    const again = await post(
      "/api/auth/email/verify",
      { token: latestLinkToken(email) },
      { Cookie: `${SESSION_COOKIE}=${first}` },
    )
    expect(sessionCookieFrom(again)).not.toBe(first)
    expect((await sessionFor(first)).account).toBeNull()
  })

  test("an active session is extended when it nears expiry, an expired one is rejected", async () => {
    const cookie = await signInByEmail(address("sliding"))
    const tokenHash = hashToken(cookie)

    await db.update(sessions).set({ expiresAt: new Date(Date.now() + 60_000) }).where(eq(sessions.tokenHash, tokenHash))
    const renewed = await validateSession(cookie)
    expect(renewed?.renewed).toBe(true)
    expect(renewed!.expiresAt.getTime() - Date.now()).toBeGreaterThan(SESSION_RENEW_WITHIN_MS)

    await db.update(sessions).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(sessions.tokenHash, tokenHash))
    expect(await validateSession(cookie)).toBeNull()
  })
})

describe("account linking", () => {
  test("a verified Google identity with the same email joins the existing account", async () => {
    const email = address("link")
    const viaEmail = await sessionFor(await signInByEmail(email))

    const google = { provider: "google" as const, subject: `${RUN}-sub-link`, email, name: "Linked", picture: null }
    const linked = await resolveAccount(google)
    expect(linked).toMatchObject({ outcome: "linked", account: { id: viaEmail.account?.id } })

    const again = await resolveAccount(google)
    expect(again).toMatchObject({ outcome: "existing", account: { id: viaEmail.account?.id, name: "Linked" } })
  })

  test("a Google identity is found by subject even after its email changes", async () => {
    const subject = `${RUN}-sub-moved`
    const created = await resolveAccount({ provider: "google", subject, email: address("before"), name: null, picture: null })
    expect(created.outcome).toBe("created")
    const moved = await resolveAccount({ provider: "google", subject, email: address("after"), name: null, picture: null })
    expect(moved).toMatchObject({ outcome: "existing", account: { id: created.account.id } })
  })

  test("concurrent first sign-ins for one address converge on one account", async () => {
    const email = address("race")
    const results = await Promise.all(
      [1, 2, 3].map((n) =>
        resolveAccount({ provider: "google", subject: `${RUN}-sub-race-${n}`, email, name: null, picture: null }),
      ),
    )
    expect(new Set(results.map((r) => r.account.id)).size).toBe(1)
  })
})

describe("cross-site protection", () => {
  test("a state-changing request from another origin, or with no origin, is refused", async () => {
    const email = address("csrf")
    expect((await post("/api/auth/email/request", { email }, { Origin: "https://evil.example" })).status).toBe(403)
    const noOrigin = await app.request("/api/auth/email/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
    expect(noOrigin.status).toBe(403)
  })

  test("no CORS grant is ever emitted", async () => {
    const response = await app.request("/api/auth/session", { headers: { Origin: "https://evil.example" } })
    expect(response.headers.get("access-control-allow-origin")).toBeNull()
    expect(response.headers.get("access-control-allow-credentials")).toBeNull()
  })

  test("responses carry security headers", async () => {
    const response = await app.request("/api/auth/session")
    expect(response.headers.get("x-frame-options")).toBe("DENY")
    expect(response.headers.get("x-content-type-options")).toBe("nosniff")
    expect(response.headers.get("cache-control")).toBe("no-store")
  })
})
