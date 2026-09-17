import type { Context, MiddlewareHandler } from "hono"
import { getConnInfo } from "@hono/node-server/conninfo"
import { secureHeaders } from "hono/secure-headers"
import { env, isProduction } from "./env.ts"
import { log } from "./logger.ts"

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

const LOCALHOST = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/

/** The origins allowed to change state. Development also accepts any localhost port (site, SPA dev server). */
export const isAllowedOrigin = (origin: string | undefined, production: boolean, appOrigin: string): boolean => {
  if (origin === undefined) return false
  if (origin === appOrigin) return true
  return !production && LOCALHOST.test(origin)
}

/**
 * Cross-site request forgery guard. The API is same-origin with the site and
 * the SPA and emits no CORS headers, so a browser only lets our own pages read
 * responses. This closes the other half: a state-changing request must name an
 * allowed Origin, which browsers always send on POST/PATCH/DELETE and scripts
 * on other sites cannot forge.
 */
export const requireSameOrigin: MiddlewareHandler = async (c, next) => {
  if (SAFE_METHODS.has(c.req.method)) return next()
  const origin = c.req.header("origin")
  if (!isAllowedOrigin(origin, isProduction, env.APP_ORIGIN)) {
    log.warn("http.origin_rejected", { path: c.req.path, origin: origin ?? null })
    return c.json({ error: "forbidden", message: "Cross-origin request refused" }, 403)
  }
  return next()
}

export const apiSecurityHeaders = secureHeaders({
  strictTransportSecurity: isProduction ? "max-age=63072000; includeSubDomains" : false,
  xFrameOptions: "DENY",
  referrerPolicy: "strict-origin-when-cross-origin",
  crossOriginResourcePolicy: "same-origin",
})

/**
 * The client's IP for rate limiting. In production the API listens behind one
 * reverse proxy that appends the peer address to X-Forwarded-For, so the
 * rightmost entry is the only one a client cannot forge. Without a proxy the
 * socket address is used.
 */
export const clientIp = (c: Context): string => {
  const forwarded = c.req.header("x-forwarded-for")
  if (isProduction && forwarded) return forwarded.split(",").at(-1)?.trim() || "unknown"
  try {
    return getConnInfo(c).remote.address ?? "unknown"
  } catch {
    // Requests built in-process (tests) have no socket.
    return "local"
  }
}
