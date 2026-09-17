import { describe, expect, test } from "vitest"
import { authorizationUrl, identityFromIdToken, pkceChallenge, statesMatch } from "./google.ts"

const CLIENT_ID = "client-123.apps.googleusercontent.com"
const NOW = new Date("2026-01-01T00:00:00Z")

const idToken = (claims: Record<string, unknown>): string => {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url")
  return `${encode({ alg: "RS256" })}.${encode(claims)}.signature`
}

const validClaims = {
  iss: "https://accounts.google.com",
  aud: CLIENT_ID,
  exp: NOW.getTime() / 1000 + 600,
  sub: "1234567890",
  email: "Cook@Example.com",
  email_verified: true,
  name: "A Cook",
  picture: "https://example.com/p.png",
}

describe("PKCE", () => {
  test("matches the RFC 7636 appendix B test vector", () => {
    expect(pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    )
  })

  test("the authorization URL asks for S256 and carries state, never the verifier", () => {
    const url = new URL(
      authorizationUrl({ clientId: CLIENT_ID, clientSecret: "s", redirectUri: "https://x/cb" }, "st", "verifier"),
    )
    expect(url.searchParams.get("code_challenge_method")).toBe("S256")
    expect(url.searchParams.get("code_challenge")).toBe(pkceChallenge("verifier"))
    expect(url.searchParams.get("state")).toBe("st")
    expect(url.searchParams.get("response_type")).toBe("code")
    expect(url.toString()).not.toContain("verifier")
    expect(url.toString()).not.toContain("secret")
  })
})

describe("state comparison", () => {
  test("requires both values and an exact match", () => {
    expect(statesMatch("abc", "abc")).toBe(true)
    expect(statesMatch("abc", "abd")).toBe(false)
    expect(statesMatch("abc", "abcd")).toBe(false)
    expect(statesMatch(undefined, "abc")).toBe(false)
    expect(statesMatch("abc", undefined)).toBe(false)
    expect(statesMatch("", "")).toBe(false)
  })
})

describe("ID token claims", () => {
  test("a valid token yields a Google identity keyed by sub with a normalized email", () => {
    const result = identityFromIdToken(idToken(validClaims), CLIENT_ID, NOW)
    expect(result).toEqual({
      identity: {
        provider: "google",
        subject: "1234567890",
        email: "cook@example.com",
        name: "A Cook",
        picture: "https://example.com/p.png",
      },
    })
  })

  test.each([
    ["issuer", { ...validClaims, iss: "https://evil.example" }],
    ["audience", { ...validClaims, aud: "another-client" }],
    ["expired", { ...validClaims, exp: NOW.getTime() / 1000 - 1 }],
    ["unverified_email", { ...validClaims, email_verified: false }],
    ["malformed", { ...validClaims, sub: undefined }],
  ])("rejects: %s", (reason, claims) => {
    expect(identityFromIdToken(idToken(claims), CLIENT_ID, NOW)).toEqual({ rejected: reason })
  })

  test("rejects garbage", () => {
    expect(identityFromIdToken("not-a-jwt", CLIENT_ID, NOW)).toEqual({ rejected: "malformed" })
    expect(identityFromIdToken("a.!!!.c", CLIENT_ID, NOW)).toEqual({ rejected: "malformed" })
  })
})
