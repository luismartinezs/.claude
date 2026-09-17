import { Hono, type Context } from "hono"
import { bodyLimit } from "hono/body-limit"
import { deleteCookie, getCookie, setCookie } from "hono/cookie"
import {
  AUTH_ERROR_PARAM,
  EmailLinkRequestSchema,
  EmailLinkVerifySchema,
  LOGIN_TOKEN_FRAGMENT,
} from "@pawacook/contracts"
import { sendEmail } from "../../platform/email.ts"
import { env, google, isProduction } from "../../platform/env.ts"
import { clientIp } from "../../platform/http.ts"
import { hashToken, newToken } from "../../platform/ids.ts"
import { log } from "../../platform/logger.ts"
import { isRateLimited, pruneRateLimits, type RateLimit } from "../../platform/rate-limit.ts"
import { authorizationUrl, exchangeCode, identityFromIdToken, statesMatch, type GoogleClient } from "./google.ts"
import { accountForRequest } from "./public.ts"
import {
  consumeLoginToken,
  createLoginToken,
  createSession,
  destroySession,
  resolveAccount,
  type VerifiedIdentity,
} from "./service.ts"
import { clearSessionCookie, readSessionCookie, writeSessionCookie } from "./session-cookie.ts"

const FIFTEEN_MINUTES = 15 * 60

export const AUTH_LIMITS = {
  emailRequestPerIp: { limit: 10, windowSeconds: FIFTEEN_MINUTES },
  /** Caps how many emails one address can be sent, so the endpoint cannot flood an inbox. */
  emailRequestPerAddress: { limit: 5, windowSeconds: FIFTEEN_MINUTES },
  emailVerifyPerIp: { limit: 30, windowSeconds: FIFTEEN_MINUTES },
  googlePerIp: { limit: 30, windowSeconds: FIFTEEN_MINUTES },
} satisfies Record<string, RateLimit>

const APP_URL = `${env.APP_ORIGIN}/app/`

const googleClient: GoogleClient | null = google && {
  ...google,
  redirectUri: `${env.APP_ORIGIN}/api/auth/google/callback`,
}

const OAUTH_COOKIE_PATH = "/api/auth/google"
const STATE_COOKIE = "google_oauth_state"
const VERIFIER_COOKIE = "google_code_verifier"

const tooManyRequests = (c: Context) =>
  c.json({ error: "rate_limited", message: "Too many attempts. Try again in a few minutes." }, 429)

/** Signs the account in, replacing any session this browser already held. */
const startSession = async (c: Context, identity: VerifiedIdentity) => {
  const { account, outcome } = await resolveAccount(identity)
  const previous = readSessionCookie(c)
  if (previous) await destroySession(previous)
  const session = await createSession(account.id)
  writeSessionCookie(c, session.token, session.expiresAt)
  log.info("auth.signed_in", { userId: account.id, method: identity.provider, outcome })
  return account
}

export const authApi = new Hono()

// Auth requests are tiny; refusing large bodies early keeps parsing cheap under abuse.
authApi.use("*", bodyLimit({ maxSize: 16 * 1024 }))

authApi.get("/session", async (c) => {
  c.header("Cache-Control", "no-store")
  return c.json({ account: await accountForRequest(c), methods: { google: googleClient !== null, email: true } })
})

authApi.post("/signout", async (c) => {
  const token = readSessionCookie(c)
  if (token) await destroySession(token)
  clearSessionCookie(c)
  return c.json({ ok: true })
})

// === Magic link ===

authApi.post("/email/request", async (c) => {
  const body = EmailLinkRequestSchema.safeParse(await c.req.json().catch(() => null))
  if (!body.success) return c.json({ error: "bad_request", message: "Enter a valid email address" }, 400)
  const { email } = body.data

  if (await isRateLimited(`auth-email-request-ip:${clientIp(c)}`, AUTH_LIMITS.emailRequestPerIp)) {
    return tooManyRequests(c)
  }
  if (await isRateLimited(`auth-email-request-address:${hashToken(email)}`, AUTH_LIMITS.emailRequestPerAddress)) {
    return tooManyRequests(c)
  }

  // The token rides in the fragment: it never reaches server or proxy logs or
  // a Referer header, and a mail scanner that fetches the URL consumes nothing.
  const token = await createLoginToken(email)
  const link = `${APP_URL}#${LOGIN_TOKEN_FRAGMENT}=${token}`
  try {
    await sendEmail({
      to: email,
      subject: "Your Pawacook sign-in link",
      text: `Sign in to Pawacook:\n\n${link}\n\nThe link works once and expires in 15 minutes. If you did not ask for it, ignore this email.`,
      html: `<p>Sign in to Pawacook:</p><p><a href="${link}">Sign in</a></p><p>The link works once and expires in 15 minutes. If you did not ask for it, ignore this email.</p>`,
    })
  } catch {
    return c.json({ error: "unavailable", message: "Could not send the sign-in email. Try again." }, 503)
  }
  await pruneRateLimits()

  // Identical whether or not an account exists: the response reveals nothing about who has signed up.
  log.info("auth.email_link_sent")
  return c.json({ ok: true })
})

authApi.post("/email/verify", async (c) => {
  if (await isRateLimited(`auth-email-verify-ip:${clientIp(c)}`, AUTH_LIMITS.emailVerifyPerIp)) {
    return tooManyRequests(c)
  }
  const body = EmailLinkVerifySchema.safeParse(await c.req.json().catch(() => null))
  const email = body.success ? await consumeLoginToken(body.data.token) : null
  if (!email) {
    log.warn("auth.email_link_rejected")
    return c.json({ error: "unauthorized", message: "This sign-in link has expired or was already used" }, 401)
  }

  const account = await startSession(c, { provider: "email", subject: email, email, name: null, picture: null })
  return c.json({ account })
})

// === Google (authorization code + PKCE) ===

const oauthCookie = { httpOnly: true, secure: isProduction, sameSite: "Lax", path: OAUTH_COOKIE_PATH, maxAge: 600 } as const

const failGoogle = (c: Context, reason: string) => {
  log.warn("auth.google_failed", { reason })
  return c.redirect(`${APP_URL}?${AUTH_ERROR_PARAM}=google`)
}

authApi.get("/google/start", async (c) => {
  if (!googleClient) return c.json({ error: "not_found", message: "Google sign-in is not configured" }, 404)
  if (await isRateLimited(`auth-google-ip:${clientIp(c)}`, AUTH_LIMITS.googlePerIp)) return tooManyRequests(c)

  const state = newToken()
  const codeVerifier = newToken()
  setCookie(c, STATE_COOKIE, state, oauthCookie)
  setCookie(c, VERIFIER_COOKIE, codeVerifier, oauthCookie)
  return c.redirect(authorizationUrl(googleClient, state, codeVerifier))
})

authApi.get("/google/callback", async (c) => {
  if (!googleClient) return c.json({ error: "not_found", message: "Google sign-in is not configured" }, 404)

  const expectedState = getCookie(c, STATE_COOKIE)
  const codeVerifier = getCookie(c, VERIFIER_COOKIE)
  // One attempt per start: the cookies are spent whatever happens next.
  deleteCookie(c, STATE_COOKIE, { path: OAUTH_COOKIE_PATH, secure: isProduction })
  deleteCookie(c, VERIFIER_COOKIE, { path: OAUTH_COOKIE_PATH, secure: isProduction })

  // The person closed or declined Google's screen: back to sign-in, not an error.
  if (c.req.query("error") === "access_denied") return c.redirect(APP_URL)

  if (await isRateLimited(`auth-google-ip:${clientIp(c)}`, AUTH_LIMITS.googlePerIp)) return failGoogle(c, "rate_limited")
  // A mismatched state means this callback was not started by this browser (login CSRF).
  if (!statesMatch(expectedState, c.req.query("state"))) return failGoogle(c, "state_mismatch")
  const code = c.req.query("code")
  if (!code || !codeVerifier) return failGoogle(c, "missing_code")

  const idToken = await exchangeCode(googleClient, code, codeVerifier).catch(() => null)
  if (!idToken) return failGoogle(c, "token_exchange")

  const result = identityFromIdToken(idToken, googleClient.clientId, new Date())
  if ("rejected" in result) return failGoogle(c, result.rejected)

  await startSession(c, result.identity)
  return c.redirect(APP_URL)
})
