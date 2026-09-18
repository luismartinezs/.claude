import { afterAll, describe, expect, test, vi } from "vitest"
import { eq, like } from "drizzle-orm"

/**
 * The paywall with billing switched on, whatever the local .env says. Without
 * Stripe configured every account counts as subscribed, so a route that lost
 * its requireSubscription would go unnoticed by every other suite.
 */
vi.mock("../../platform/env.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../platform/env.ts")>()
  return {
    ...actual,
    stripeConfig: {
      secretKey: "sk_test_paywall_unused",
      webhookSecret: "whsec_paywall_unused",
      priceId: "price_paywall_unused",
      portalConfigurationId: null,
    },
  }
})

/**
 * Stripe as the checkout route sees it: subscriptions per customer, and every
 * Checkout Session it was asked to create. Declared before the mock factory
 * runs, which vi.hoisted guarantees.
 */
const fake = vi.hoisted(() => ({
  run: `paywalltest-${Date.now()}`,
  subscriptionsByCustomer: new Map<string, { id: string; status: string; customer: string }[]>(),
  sessions: [] as Record<string, unknown>[],
}))

vi.mock("./service.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./service.ts")>()
  const priced = (subscription: { id: string; status: string; customer: string }) => ({
    ...subscription,
    metadata: actual.APP_METADATA,
    items: { data: [{ price: { metadata: actual.APP_METADATA } }] },
  })
  return {
    ...actual,
    /**
     * A stand-in owner, because this suite shares the development database and
     * would otherwise create, then delete, the account the owner signs in with
     * locally. Whether the real address is the owner is service.test.ts's
     * question; this suite's is whether the routes ask at all.
     */
    isOwner: (email: string) => email === `${fake.run}-owner@example.com`,
    stripe: {
      subscriptions: {
        retrieve: async (id: string) => {
          const found = [...fake.subscriptionsByCustomer.values()].flat().find((subscription) => subscription.id === id)
          if (!found) throw Object.assign(new Error("No such subscription"), { code: "resource_missing" })
          return priced(found)
        },
        list: async ({ customer }: { customer: string }) => ({ data: (fake.subscriptionsByCustomer.get(customer) ?? []).map(priced) }),
      },
      checkout: {
        sessions: {
          create: async (params: Record<string, unknown>) => {
            fake.sessions.push(params)
            return { url: "https://checkout.stripe.com/c/pay/cs_test_fake" }
          },
        },
      },
    },
  }
})

const { app } = await import("../../app.ts")
const { accounts, sessions, subscriptions } = await import("../../db/schema/index.ts")
const { db } = await import("../../platform/db.ts")
const { env } = await import("../../platform/env.ts")
const { hashToken, newId, newToken } = await import("../../platform/ids.ts")
const { SESSION_COOKIE } = await import("../auth/public.ts")

const RUN = fake.run

const signedIn = async (label: string, subscription?: { status: string; productKey: string | null }) => {
  const id = newId()
  await db.insert(accounts).values({ id, email: `${RUN}-${label}@example.com`, name: label })
  const token = newToken()
  await db.insert(sessions).values({ tokenHash: hashToken(token), accountId: id, expiresAt: new Date(Date.now() + 3_600_000) })
  if (subscription) {
    await db.insert(subscriptions).values({ accountId: id, stripeCustomerId: `cus_${id}`, stripeSubscriptionId: `sub_${id}`, ...subscription })
  }
  return { id, cookie: `${SESSION_COOKIE}=${token}` }
}

/** Every route family that holds account data or calls the model. */
const PROTECTED = [
  { method: "GET", path: "/api/profile" },
  { method: "GET", path: "/api/recipes" },
  { method: "POST", path: "/api/assistant/cook" },
] as const

const call = (route: (typeof PROTECTED)[number], cookie: string) =>
  app.request(route.path, {
    method: route.method,
    headers: { Cookie: cookie, Origin: env.APP_ORIGIN, "Content-Type": "application/json" },
    ...(route.method === "POST" ? { body: "{}" } : {}),
  })

afterAll(async () => {
  await db.delete(accounts).where(like(accounts.email, `${RUN}-%`))
})

describe("paywall with billing configured", () => {
  test("an account that never subscribed is refused everywhere with 402", async () => {
    const { cookie } = await signedIn("never")
    for (const route of PROTECTED) expect((await call(route, cookie)).status, route.path).toBe(402)
  })

  test("an ended subscription, or one paying for another app's price, is refused", async () => {
    const ended = await signedIn("ended", { status: "canceled", productKey: "pro" })
    const foreign = await signedIn("foreign", { status: "active", productKey: null })
    for (const { cookie } of [ended, foreign]) {
      for (const route of PROTECTED) expect((await call(route, cookie)).status, route.path).toBe(402)
    }
  })

  test("an active or past-due subscription to this app's plan passes the paywall", async () => {
    for (const status of ["active", "past_due"]) {
      const { cookie } = await signedIn(status, { status, productKey: "pro" })
      for (const route of PROTECTED) expect((await call(route, cookie)).status, `${status} ${route.path}`).not.toBe(402)
    }
  })

  test("checkout starts a subscription session tagged for this app and bound to the account", async () => {
    const { id, cookie } = await signedIn("first-checkout")
    fake.sessions.length = 0

    const response = await app.request("/api/billing/checkout", { method: "POST", headers: { Cookie: cookie, Origin: env.APP_ORIGIN } })

    expect(response.status).toBe(200)
    expect(fake.sessions).toHaveLength(1)
    expect(fake.sessions[0]).toMatchObject({
      mode: "subscription",
      client_reference_id: id,
      metadata: { app: "pawacook", product_key: "pro" },
      subscription_data: { metadata: { app: "pawacook", product_key: "pro" } },
      line_items: [{ price: "price_paywall_unused", quantity: 1 }],
      success_url: `${env.APP_ORIGIN}/app/?checkout=success`,
    })
  })

  test("checkout is refused when Stripe holds a live subscription the stored row missed", async () => {
    const { id, cookie } = await signedIn("missed-webhook", { status: "canceled", productKey: "pro" })
    fake.subscriptionsByCustomer.set(`cus_${id}`, [
      { id: `sub_${id}`, status: "canceled", customer: `cus_${id}` },
      { id: `sub_resubscribed_${id}`, status: "active", customer: `cus_${id}` },
    ])
    fake.sessions.length = 0

    const response = await app.request("/api/billing/checkout", { method: "POST", headers: { Cookie: cookie, Origin: env.APP_ORIGIN } })

    expect(response.status).toBe(409)
    expect(fake.sessions).toEqual([])
  })

  test("the owner passes the paywall, and is never billed, with no subscription at all", async () => {
    const { id, cookie } = await signedIn("owner")
    fake.sessions.length = 0

    for (const route of PROTECTED) expect((await call(route, cookie)).status, route.path).not.toBe(402)
    const status = await app.request("/api/billing", { headers: { Cookie: cookie } })
    const checkout = await app.request("/api/billing/checkout", { method: "POST", headers: { Cookie: cookie, Origin: env.APP_ORIGIN } })

    expect(await status.json()).toEqual({ active: true, manageable: false })
    // A checkout would charge the owner for access they already have.
    expect(checkout.status).toBe(409)
    expect(fake.sessions).toEqual([])
    expect(await db.select().from(subscriptions).where(eq(subscriptions.accountId, id))).toEqual([])
  })

  test("the status endpoint reports the paywall to the SPA", async () => {
    const { id, cookie } = await signedIn("status", { status: "canceled", productKey: "pro" })
    const response = await app.request("/api/billing", { headers: { Cookie: cookie } })
    expect(await response.json()).toEqual({ active: false, manageable: true })
    expect(await db.select().from(subscriptions).where(eq(subscriptions.accountId, id))).toHaveLength(1)
  })
})
