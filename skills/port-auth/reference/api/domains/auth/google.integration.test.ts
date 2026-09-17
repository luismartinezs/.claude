import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest"
import { like, sql } from "drizzle-orm"

/**
 * The Google callback against the real database, with only Google's token
 * endpoint stubbed. Credentials are set before the app loads because the
 * routes read configuration at import time.
 */
process.env.GOOGLE_CLIENT_ID = "test-client.apps.googleusercontent.com"
process.env.GOOGLE_CLIENT_SECRET = "test-secret"

const { app } = await import("../../app.ts")
const { db } = await import("../../platform/db.ts")
const { env } = await import("../../platform/env.ts")
const { accounts } = await import("../../db/schema/index.ts")
const { SESSION_COOKIE } = await import("./session-cookie.ts")

const RUN = `googletest-${Date.now()}`
const CLIENT_ID = "test-client.apps.googleusercontent.com"
const realFetch = globalThis.fetch

const idToken = (claims: Record<string, unknown>) => {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url")
  return `${encode({ alg: "RS256" })}.${encode(claims)}.sig`
}

const claimsFor = (label: string, overrides: Record<string, unknown> = {}) => ({
  iss: "https://accounts.google.com",
  aud: CLIENT_ID,
  exp: Math.floor(Date.now() / 1000) + 600,
  sub: `${RUN}-${label}`,
  email: `${RUN}-${label}@example.com`,
  email_verified: true,
  name: "Google Cook",
  ...overrides,
})

/** Stubs Google's token endpoint and records what the API sent to it. */
const stubTokenEndpoint = (claims: Record<string, unknown>) => {
  const sent: URLSearchParams[] = []
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    if (String(input) !== "https://oauth2.googleapis.com/token") return realFetch(input, init)
    sent.push(new URLSearchParams(String(init?.body)))
    return new Response(JSON.stringify({ id_token: idToken(claims), access_token: "unused" }))
  })
  return sent
}

const cookieHeader = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .filter((pair) => !pair!.endsWith("="))
    .join("; ")

const start = async () => {
  const response = await app.request("/api/auth/google/start")
  expect(response.status).toBe(302)
  const location = new URL(response.headers.get("location")!)
  return { location, cookies: cookieHeader(response) }
}

const callback = (query: string, cookies: string) =>
  app.request(`/api/auth/google/callback?${query}`, { headers: { Cookie: cookies } })

beforeAll(() => expect(env.GOOGLE_CLIENT_ID).toBe(CLIENT_ID))
beforeEach(async () => db.execute(sql`delete from rate_limits where key = 'auth-google-ip:local'`))
afterEach(() => vi.restoreAllMocks())
afterAll(async () => db.delete(accounts).where(like(accounts.email, `${RUN}-%`)))

describe("Google sign-in", () => {
  test("start sends the browser to Google with state, PKCE and our callback", async () => {
    const { location, cookies } = await start()
    expect(location.origin + location.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth")
    expect(location.searchParams.get("redirect_uri")).toBe(`${env.APP_ORIGIN}/api/auth/google/callback`)
    expect(location.searchParams.get("code_challenge_method")).toBe("S256")
    expect(cookies).toContain(`google_oauth_state=${location.searchParams.get("state")}`)
    expect(cookies).toContain("google_code_verifier=")
  })

  test("a successful callback exchanges the code with the verifier and signs in", async () => {
    const { location, cookies } = await start()
    const sent = stubTokenEndpoint(claimsFor("ok"))
    const response = await callback(`code=abc&state=${location.searchParams.get("state")}`, cookies)

    expect(response.status).toBe(302)
    expect(response.headers.get("location")).toBe(`${env.APP_ORIGIN}/app/`)
    expect(sent[0]?.get("code_verifier")).toBe(cookies.match(/google_code_verifier=([^;]+)/)?.[1])
    expect(sent[0]?.get("client_secret")).toBe("test-secret")

    const session = await app.request("/api/auth/session", { headers: { Cookie: cookieHeader(response) } })
    const body = (await session.json()) as { account: { email: string } | null; methods: { google: boolean } }
    expect(body.account?.email).toBe(`${RUN}-ok@example.com`)
    expect(body.methods.google).toBe(true)
  })

  test("a callback whose state does not match this browser is refused before any exchange", async () => {
    const { cookies } = await start()
    const sent = stubTokenEndpoint(claimsFor("csrf"))
    const response = await callback("code=abc&state=forged", cookies)
    expect(response.headers.get("location")).toBe(`${env.APP_ORIGIN}/app/?auth_error=google`)
    expect(sent).toHaveLength(0)
    expect(response.headers.getSetCookie().some((c) => c.startsWith(`${SESSION_COOKIE}=`))).toBe(false)
  })

  test("a callback without the start cookies is refused", async () => {
    stubTokenEndpoint(claimsFor("nocookie"))
    const response = await callback("code=abc&state=anything", "")
    expect(response.headers.get("location")).toBe(`${env.APP_ORIGIN}/app/?auth_error=google`)
  })

  test("an unverified Google email is refused", async () => {
    const { location, cookies } = await start()
    stubTokenEndpoint(claimsFor("unverified", { email_verified: false }))
    const response = await callback(`code=abc&state=${location.searchParams.get("state")}`, cookies)
    expect(response.headers.get("location")).toBe(`${env.APP_ORIGIN}/app/?auth_error=google`)
  })

  test("declining on Google's screen returns to sign-in without an error", async () => {
    const { location, cookies } = await start()
    const response = await callback(`error=access_denied&state=${location.searchParams.get("state")}`, cookies)
    expect(response.headers.get("location")).toBe(`${env.APP_ORIGIN}/app/`)
  })
})
