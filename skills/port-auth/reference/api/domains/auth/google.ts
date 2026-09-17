import { createHash, timingSafeEqual } from "node:crypto"
import { z } from "zod"
import type { VerifiedIdentity } from "./service.ts"

/**
 * Google sign-in as the OAuth 2.0 authorization code flow with PKCE (OpenID
 * Connect). The browser only ever carries a one-time code; the ID token is
 * fetched server-to-server with the client secret.
 */

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
const TOKEN_URL = "https://oauth2.googleapis.com/token"

export type GoogleClient = { clientId: string; clientSecret: string; redirectUri: string }

/** RFC 7636 S256: the challenge is the base64url SHA-256 of the verifier. */
export const pkceChallenge = (verifier: string): string =>
  createHash("sha256").update(verifier).digest("base64url")

export const authorizationUrl = (client: GoogleClient, state: string, codeVerifier: string): string => {
  const params = new URLSearchParams({
    client_id: client.clientId,
    redirect_uri: client.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: pkceChallenge(codeVerifier),
    code_challenge_method: "S256",
  })
  return `${AUTHORIZE_URL}?${params.toString()}`
}

/** Constant-time comparison, so the callback leaks nothing about a guessed state value. */
export const statesMatch = (expected: string | undefined, received: string | undefined): boolean => {
  if (!expected || !received) return false
  const a = Buffer.from(expected)
  const b = Buffer.from(received)
  return a.length === b.length && timingSafeEqual(a, b)
}

const GOOGLE_ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"])

const TokenResponseSchema = z.object({ id_token: z.string().min(1) })

const IdTokenClaimsSchema = z.object({
  iss: z.string(),
  aud: z.string(),
  exp: z.number(),
  sub: z.string().min(1),
  email: z.string().min(1),
  email_verified: z.boolean(),
  name: z.string().optional(),
  picture: z.string().optional(),
})

export type GoogleRejection = "malformed" | "issuer" | "audience" | "expired" | "unverified_email"

/**
 * Validates ID token claims. The signature is deliberately not checked: the
 * token came straight from Google's token endpoint over TLS in exchange for our
 * client secret, which OpenID Connect Core 3.1.3.7 accepts in place of it.
 * Everything else a relying party must check is checked here.
 */
export const identityFromIdToken = (
  idToken: string,
  clientId: string,
  now: Date,
): { identity: VerifiedIdentity } | { rejected: GoogleRejection } => {
  const payload = idToken.split(".")[1]
  if (!payload) return { rejected: "malformed" }

  let json: unknown
  try {
    json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
  } catch {
    return { rejected: "malformed" }
  }

  const claims = IdTokenClaimsSchema.safeParse(json)
  if (!claims.success) return { rejected: "malformed" }
  if (!GOOGLE_ISSUERS.has(claims.data.iss)) return { rejected: "issuer" }
  if (claims.data.aud !== clientId) return { rejected: "audience" }
  if (claims.data.exp * 1000 <= now.getTime()) return { rejected: "expired" }
  // An unverified address must never link to an account someone else owns.
  if (!claims.data.email_verified) return { rejected: "unverified_email" }

  return {
    identity: {
      provider: "google",
      subject: claims.data.sub,
      email: claims.data.email.trim().toLowerCase(),
      name: claims.data.name ?? null,
      picture: claims.data.picture ?? null,
    },
  }
}

/** Trades the one-time code for an ID token. Returns null on any provider failure. */
export const exchangeCode = async (
  client: GoogleClient,
  code: string,
  codeVerifier: string,
): Promise<string | null> => {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: client.clientId,
      client_secret: client.clientSecret,
      redirect_uri: client.redirectUri,
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
    }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) return null
  const body = TokenResponseSchema.safeParse(await response.json().catch(() => null))
  return body.success ? body.data.id_token : null
}
