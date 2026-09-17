import type { Context, MiddlewareHandler } from "hono"
import type { Account } from "@pawacook/contracts"
import { validateSession } from "./service.ts"
import { readSessionCookie, writeSessionCookie } from "./session-cookie.ts"

export type AuthedEnv = { Variables: { account: Account } }

/** Resolves the signed-in account for this request, refreshing the cookie when the session was renewed. */
export const accountForRequest = async (c: Context): Promise<Account | null> => {
  const token = readSessionCookie(c)
  if (!token) return null
  const session = await validateSession(token)
  if (!session) return null
  if (session.renewed) writeSessionCookie(c, token, session.expiresAt)
  return session.account
}

/** Rejects unauthenticated requests before any domain handler runs. */
export const requireAccount: MiddlewareHandler<AuthedEnv> = async (c, next) => {
  const account = await accountForRequest(c)
  if (!account) return c.json({ error: "unauthorized", message: "Sign in to continue" }, 401)
  c.set("account", account)
  await next()
}

export const currentAccount = (c: Context<AuthedEnv>): Account => c.get("account")
