import type { Context } from "hono"
import { deleteCookie, getCookie, setCookie } from "hono/cookie"
import { isProduction } from "../../platform/env.ts"

/**
 * `__Host-` makes the browser refuse the cookie unless it is Secure, host-only
 * and Path=/, so a sibling subdomain can never set or shadow it. Browsers
 * reject Secure cookies over plain http, so development uses the bare name.
 */
export const SESSION_COOKIE = isProduction ? "__Host-pawacook_session" : "pawacook_session"

export const readSessionCookie = (c: Context): string | undefined => getCookie(c, SESSION_COOKIE)

export const writeSessionCookie = (c: Context, token: string, expiresAt: Date): void => {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    // Lax, not Strict: the cookie must accompany the top-level redirect back from Google.
    sameSite: "Lax",
    path: "/",
    expires: expiresAt,
  })
}

export const clearSessionCookie = (c: Context): void => {
  deleteCookie(c, SESSION_COOKIE, { path: "/", secure: isProduction })
}
