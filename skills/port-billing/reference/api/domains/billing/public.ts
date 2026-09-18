import type { MiddlewareHandler } from "hono"
import { PLAN, USAGE_LIMIT_MESSAGE } from "@pawacook/contracts"
import type { AuthedEnv } from "../auth/public.ts"
import { isRateLimited, type RateLimit } from "../../platform/rate-limit.ts"
import { findSubscription, hasAccess, isOwner } from "./service.ts"

/** The plan's cost ceiling: about 100 recipes, each with a few chat changes. */
export const ASSISTANT_ALLOWANCE: RateLimit = {
  limit: PLAN.assistantRequestsPer30Days,
  windowSeconds: 30 * 24 * 60 * 60,
}

/** Runs after requireAccount: refuses every request from an account without an active subscription. */
export const requireSubscription: MiddlewareHandler<AuthedEnv> = async (c, next) => {
  const account = c.get("account")
  if (!isOwner(account.email)) {
    const row = await findSubscription(account.id)
    if (!hasAccess(row)) return c.json({ error: "payment_required", message: "Subscribe to continue" }, 402)
  }
  await next()
}

/** Runs after requireSubscription on every request that calls the model. */
export const requireAssistantAllowance: MiddlewareHandler<AuthedEnv> = async (c, next) => {
  if (await isRateLimited(`assistant-allowance:${c.get("account").id}`, ASSISTANT_ALLOWANCE)) {
    return c.json({ error: "rate_limited", message: USAGE_LIMIT_MESSAGE }, 429)
  }
  await next()
}
