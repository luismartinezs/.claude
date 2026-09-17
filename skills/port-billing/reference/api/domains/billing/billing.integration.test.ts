import Stripe from "stripe"
import { Hono } from "hono"
import { afterAll, describe, expect, test } from "vitest"
import { eq, like } from "drizzle-orm"
import { USAGE_LIMIT_MESSAGE } from "@pawacook/contracts"
import { app } from "../../app.ts"
import { accounts, rateLimits, sessions, subscriptions } from "../../db/schema/index.ts"
import { db } from "../../platform/db.ts"
import { env } from "../../platform/env.ts"
import { hashToken, newId, newToken } from "../../platform/ids.ts"
import { SESSION_COOKIE } from "../auth/public.ts"
import { createStripeWebhook } from "./api.ts"
import { ASSISTANT_ALLOWANCE } from "./public.ts"
import { APP_METADATA, currentSubscription, grantsAccess, handleStripeEvent, subscriptionBeforeCheckout, type StripeReader } from "./service.ts"

/** Drives the real HTTP app against the real database, like the auth suite. */

const RUN = `billingtest-${Date.now()}`

const newAccount = async (label: string): Promise<string> => {
  const id = newId()
  await db.insert(accounts).values({ id, email: `${RUN}-${label}@example.com`, name: label })
  return id
}

/**
 * A signed-in, subscribed account, made directly in the database: sign-in is the
 * auth suite's concern, and the subscription row keeps these tests valid whether
 * or not Stripe is configured in the local .env.
 */
const signedInAccount = async (label: string) => {
  const id = await newAccount(label)
  const token = newToken()
  await db.insert(sessions).values({ tokenHash: hashToken(token), accountId: id, expiresAt: new Date(Date.now() + 3_600_000) })
  await db.insert(subscriptions).values({
    accountId: id,
    stripeCustomerId: `cus_${id}`,
    stripeSubscriptionId: `sub_${id}`,
    status: "active",
    productKey: "pro",
  })
  return { id, cookie: `${SESSION_COOKIE}=${token}` }
}

/** A subscription as Stripe returns it, paying for the given price metadata (this app's plan by default). */
const subscription = (customer: string, status: string, priceMetadata: Record<string, string> = APP_METADATA) => ({
  customer,
  status,
  metadata: APP_METADATA,
  items: { data: [{ price: { metadata: priceMetadata } }] },
})

/** Stands in for Stripe: serves the given subscriptions and records every lookup. */
const fakeStripe = (known: Record<string, ReturnType<typeof subscription>>) => {
  const retrieved: string[] = []
  const client = {
    subscriptions: {
      retrieve: async (id: string) => {
        retrieved.push(id)
        const subscription = known[id]
        if (!subscription) throw new Error(`unexpected Stripe lookup: ${id}`)
        return { id, ...subscription }
      },
      list: async ({ customer }: { customer: string }) => {
        retrieved.push(`list:${customer}`)
        return { data: Object.entries(known).filter(([, s]) => s.customer === customer).map(([id, s]) => ({ id, ...s })) }
      },
    },
  } as unknown as StripeReader
  return { client, retrieved }
}

const checkoutCompleted = (metadata: Record<string, string>, accountId: string, subscriptionId: string) =>
  ({
    type: "checkout.session.completed",
    data: { object: { metadata, client_reference_id: accountId, subscription: subscriptionId } },
  }) as unknown as Stripe.Event

const subscriptionOf = async (accountId: string) =>
  (await db.select().from(subscriptions).where(eq(subscriptions.accountId, accountId)))[0]

const cook = (cookie: string, body: unknown) =>
  app.request("/api/assistant/cook", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: env.APP_ORIGIN, Cookie: cookie },
    body: JSON.stringify(body),
  })

const useAllowance = (accountId: string, count: number) =>
  db.insert(rateLimits).values({ key: `assistant-allowance:${accountId}`, windowStart: new Date(), count })

afterAll(async () => {
  const run = await db.select({ id: accounts.id }).from(accounts).where(like(accounts.email, `${RUN}-%`))
  for (const { id } of run) await db.delete(rateLimits).where(eq(rateLimits.key, `assistant-allowance:${id}`))
  await db.delete(accounts).where(like(accounts.email, `${RUN}-%`))
})

describe("assistant allowance", () => {
  test("a request past the monthly allowance is refused before the model is called", async () => {
    const { id, cookie } = await signedInAccount("spent")
    await useAllowance(id, ASSISTANT_ALLOWANCE.limit)

    const response = await cook(cookie, { request: "Chicken in the air fryer" })
    expect(response.status).toBe(429)
    expect(await response.json()).toEqual({ error: "rate_limited", message: USAGE_LIMIT_MESSAGE })
  })

  test("the last request inside the allowance reaches the assistant", async () => {
    const { id, cookie } = await signedInAccount("last")
    await useAllowance(id, ASSISTANT_ALLOWANCE.limit - 1)

    // An invalid body stops inside the handler, after the allowance, without calling the model.
    expect((await cook(cookie, {})).status).toBe(400)
    expect((await cook(cookie, {})).status).toBe(429)
  })
})

describe("stripe events", () => {
  test("another app's checkout on the shared Stripe account is ignored without touching Stripe or the database", async () => {
    const { client, retrieved } = fakeStripe({})
    // An account id that does not exist here: recording it would violate the foreign key.
    await handleStripeEvent(client, checkoutCompleted({ app: "mindstring" }, newId(), "sub_other_app"))
    await handleStripeEvent(client, checkoutCompleted({}, newId(), "sub_no_metadata"))
    await handleStripeEvent(client, {
      type: "customer.subscription.updated",
      data: { object: { id: "sub_other_app", metadata: { app: "mindstring" } } },
    } as unknown as Stripe.Event)
    expect(retrieved).toEqual([])
  })

  test("this app's completed checkout records the subscription as Stripe reports it", async () => {
    const accountId = await newAccount("checkout")
    const subscriptionId = `sub_${accountId}`
    const { client } = fakeStripe({ [subscriptionId]: subscription(`cus_${accountId}`, "active") })

    await handleStripeEvent(client, checkoutCompleted(APP_METADATA, accountId, subscriptionId))

    expect(await subscriptionOf(accountId)).toMatchObject({
      stripeCustomerId: `cus_${accountId}`,
      stripeSubscriptionId: subscriptionId,
      status: "active",
      productKey: "pro",
    })
  })

  test("a subscription whose price belongs to another app is recorded without granting access", async () => {
    const { id } = await signedInAccount("foreign-price")
    await db.delete(subscriptions).where(eq(subscriptions.accountId, id))
    const { client } = fakeStripe({ [`sub_${id}`]: subscription(`cus_${id}`, "active", { app: "mindstring", product_key: "pro" }) })

    await handleStripeEvent(client, checkoutCompleted(APP_METADATA, id, `sub_${id}`))

    const row = await subscriptionOf(id)
    expect(row).toMatchObject({ status: "active", productKey: null })
    expect(grantsAccess(row!, true)).toBe(false)
  })

  test("a late checkout for an older subscription does not replace the one that grants access", async () => {
    const { id } = await signedInAccount("late-checkout")
    const { client } = fakeStripe({
      [`sub_${id}`]: subscription(`cus_${id}`, "active"),
      sub_old: subscription(`cus_${id}`, "canceled"),
    })

    await handleStripeEvent(client, checkoutCompleted(APP_METADATA, id, "sub_old"))

    expect(await subscriptionOf(id)).toMatchObject({ stripeSubscriptionId: `sub_${id}`, status: "active" })
  })

  test("a second paid checkout keeps the subscription already held", async () => {
    const { id } = await signedInAccount("duplicate")
    const { client } = fakeStripe({
      [`sub_${id}`]: subscription(`cus_${id}`, "active"),
      sub_duplicate: subscription(`cus_${id}`, "active"),
    })

    await handleStripeEvent(client, checkoutCompleted(APP_METADATA, id, "sub_duplicate"))

    expect(await subscriptionOf(id)).toMatchObject({ stripeSubscriptionId: `sub_${id}` })
  })

  test("a subscription event records Stripe's current state, not the possibly older copy in the event", async () => {
    const { id } = await signedInAccount("reread")
    // The event says active (sent before the cancellation), but Stripe now says canceled.
    const { client, retrieved } = fakeStripe({ [`sub_${id}`]: subscription(`cus_${id}`, "canceled") })

    await handleStripeEvent(client, {
      type: "customer.subscription.updated",
      data: { object: { id: `sub_${id}`, status: "active", metadata: APP_METADATA } },
    } as unknown as Stripe.Event)

    expect(retrieved).toEqual([`sub_${id}`])
    expect(await subscriptionOf(id)).toMatchObject({ status: "canceled" })
  })

  test("an event about a subscription no account holds changes nothing", async () => {
    const { id } = await signedInAccount("unheld")
    const { client, retrieved } = fakeStripe({})

    await handleStripeEvent(client, {
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_replaced_long_ago", status: "canceled", metadata: APP_METADATA } },
    } as unknown as Stripe.Event)

    expect(retrieved).toEqual([])
    expect(await subscriptionOf(id)).toMatchObject({ status: "active" })
  })

  test("a checkout after the held subscription ended replaces it", async () => {
    const { id } = await signedInAccount("resubscribe")
    const { client } = fakeStripe({
      [`sub_${id}`]: subscription(`cus_${id}`, "canceled"),
      sub_new: subscription(`cus_${id}`, "active"),
    })

    await handleStripeEvent(client, checkoutCompleted(APP_METADATA, id, "sub_new"))

    expect(await subscriptionOf(id)).toMatchObject({ stripeSubscriptionId: "sub_new", status: "active" })
  })
})

describe("current subscription", () => {
  test("a stored row that denies access is re-read from Stripe, so a paying subscriber is not asked to pay again", async () => {
    const { id } = await signedInAccount("stale")
    // Written before product_key existed, or while a webhook was lost.
    await db.update(subscriptions).set({ productKey: null }).where(eq(subscriptions.accountId, id))
    const { client, retrieved } = fakeStripe({ [`sub_${id}`]: subscription(`cus_${id}`, "active") })

    const row = await currentSubscription(client, id)

    expect(retrieved).toEqual([`sub_${id}`])
    expect(row).toMatchObject({ status: "active", productKey: "pro" })
    expect(grantsAccess(row!, true)).toBe(true)
  })

  test("a row that grants access is served without calling Stripe", async () => {
    const { id } = await signedInAccount("fresh")
    const { client, retrieved } = fakeStripe({})

    expect(await currentSubscription(client, id)).toMatchObject({ status: "active" })
    expect(retrieved).toEqual([])
  })

  test("a subscription that ended for good stays denied without calling Stripe", async () => {
    const { id } = await signedInAccount("ended")
    await db.update(subscriptions).set({ status: "canceled" }).where(eq(subscriptions.accountId, id))
    const { client, retrieved } = fakeStripe({})

    expect(grantsAccess((await currentSubscription(client, id))!, true)).toBe(false)
    expect(retrieved).toEqual([])
  })
})

describe("before checkout", () => {
  test("a returning customer's live subscription whose webhook never arrived is found and recorded", async () => {
    const { id } = await signedInAccount("lost-webhook")
    await db.update(subscriptions).set({ status: "canceled" }).where(eq(subscriptions.accountId, id))
    const { client } = fakeStripe({
      [`sub_${id}`]: subscription(`cus_${id}`, "canceled"),
      sub_resubscribed: subscription(`cus_${id}`, "active"),
    })

    const row = await subscriptionBeforeCheckout(client, id)

    expect(row).toMatchObject({ stripeSubscriptionId: "sub_resubscribed", status: "active" })
    expect(grantsAccess(row!, true)).toBe(true)
  })

  test("a customer whose subscriptions all ended may check out", async () => {
    const { id } = await signedInAccount("lapsed")
    await db.update(subscriptions).set({ status: "canceled" }).where(eq(subscriptions.accountId, id))
    const { client } = fakeStripe({ [`sub_${id}`]: subscription(`cus_${id}`, "canceled") })

    expect(grantsAccess((await subscriptionBeforeCheckout(client, id))!, true)).toBe(false)
  })
})

describe("checkout", () => {
  test("an account that already has access cannot start a second subscription", async () => {
    const { cookie } = await signedInAccount("already")
    const response = await app.request("/api/billing/checkout", {
      method: "POST",
      headers: { Origin: env.APP_ORIGIN, Cookie: cookie },
    })
    expect(response.status).toBe(409)
  })
})

describe("stripe webhook", () => {
  const WEBHOOK_SECRET = "whsec_integration_test"

  /** The real signature check, with a fake Stripe behind it for the subscription read. */
  const signedWebhook = (reader: StripeReader) => {
    const webhook = new Hono().post(
      "/",
      createStripeWebhook({ verifier: new Stripe("sk_test_unused").webhooks, reader, webhookSecret: WEBHOOK_SECRET }),
    )
    return (body: string, signature?: string) =>
      webhook.request("/", { method: "POST", body, headers: signature ? { "stripe-signature": signature } : {} })
  }

  const sign = (payload: string, secret = WEBHOOK_SECRET) =>
    new Stripe("sk_test_unused").webhooks.generateTestHeaderStringAsync({ payload, secret })

  const checkoutPayload = (accountId: string, subscriptionId: string) =>
    JSON.stringify({
      id: `evt_${accountId}`,
      object: "event",
      type: "checkout.session.completed",
      data: { object: { metadata: APP_METADATA, client_reference_id: accountId, subscription: subscriptionId } },
    })

  test("a correctly signed delivery records the subscription", async () => {
    const accountId = await newAccount("signed")
    const { client } = fakeStripe({ [`sub_${accountId}`]: subscription(`cus_${accountId}`, "active") })
    const payload = checkoutPayload(accountId, `sub_${accountId}`)

    const response = await signedWebhook(client)(payload, await sign(payload))

    expect(response.status).toBe(200)
    expect(await subscriptionOf(accountId)).toMatchObject({ status: "active", productKey: "pro" })
  })

  test("a tampered body, a foreign secret or a missing signature is refused before anything is read", async () => {
    const accountId = await newAccount("forged")
    const { client, retrieved } = fakeStripe({ [`sub_${accountId}`]: subscription(`cus_${accountId}`, "active") })
    const deliver = signedWebhook(client)
    const payload = checkoutPayload(accountId, `sub_${accountId}`)
    const tampered = checkoutPayload(await newAccount("attacker"), `sub_${accountId}`)

    expect((await deliver(tampered, await sign(payload))).status).toBe(400)
    expect((await deliver(payload, await sign(payload, "whsec_someone_else"))).status).toBe(400)
    expect((await deliver(payload)).status).toBe(400)
    expect(retrieved).toEqual([])
    expect(await subscriptionOf(accountId)).toBeUndefined()
  })

  test("is reachable without an Origin header, so the same-origin guard never blocks Stripe", async () => {
    const response = await app.request("/api/billing/webhook", { method: "POST", body: "{}" })
    // Unsigned, so it is refused (or 404 when billing is unconfigured); anything but 403 proves the route sits ahead of the guard.
    expect(response.status).not.toBe(403)
  })
})
