import { Hono, type Handler } from "hono"
import type Stripe from "stripe"
import type { BillingStatus, Redirect } from "@pawacook/contracts"
import { currentAccount, requireAccount, type AuthedEnv } from "../auth/public.ts"
import { env, stripeConfig } from "../../platform/env.ts"
import { log } from "../../platform/logger.ts"
import {
  APP_METADATA,
  currentSubscription,
  findSubscription,
  handleStripeEvent,
  hasAccess,
  isOwner,
  stripe,
  subscriptionBeforeCheckout,
  type StripeReader,
} from "./service.ts"

const APP_URL = `${env.APP_ORIGIN}/app/`

const notConfigured = { error: "not_found", message: "Billing is not configured" } as const

export const billingApi = new Hono<AuthedEnv>()

billingApi.use("*", requireAccount)

// A denied subscription is confirmed with Stripe before the paywall is shown.
billingApi.get("/", async (c) => {
  const account = currentAccount(c)
  const row = await currentSubscription(stripe, account.id)
  // The owner is active without a subscription, so there is nothing to manage.
  return c.json({ active: isOwner(account.email) || hasAccess(row), manageable: row !== null } satisfies BillingStatus)
})

/** Starts Stripe's hosted checkout for the one monthly plan. */
billingApi.post("/checkout", async (c) => {
  const account = currentAccount(c)
  // The owner already has access, and a checkout would bill them for it.
  if (isOwner(account.email)) return c.json({ error: "conflict", message: "Already subscribed" }, 409)
  const row = stripe ? await subscriptionBeforeCheckout(stripe, account.id) : await findSubscription(account.id)
  // A second checkout would start a second subscription and charge the customer twice.
  if (hasAccess(row)) return c.json({ error: "conflict", message: "Already subscribed" }, 409)
  if (!stripe || !stripeConfig) return c.json(notConfigured, 404)
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: stripeConfig.priceId, quantity: 1 }],
    client_reference_id: account.id,
    // Checkout Session events carry the top-level metadata; the Subscription keeps its own copy.
    metadata: APP_METADATA,
    subscription_data: { metadata: APP_METADATA },
    // A returning subscriber keeps one Stripe customer, so the portal shows their whole history.
    ...(row ? { customer: row.stripeCustomerId } : { customer_email: account.email }),
    success_url: `${APP_URL}?checkout=success`,
    cancel_url: APP_URL,
  })
  log.info("billing.checkout_started", { userId: account.id })
  return c.json({ url: session.url! } satisfies Redirect)
})

/** Stripe's hosted portal: payment method, invoices, cancellation. */
billingApi.post("/portal", async (c) => {
  if (!stripe || !stripeConfig) return c.json(notConfigured, 404)
  const row = await findSubscription(currentAccount(c).id)
  if (!row) return c.json({ error: "not_found", message: "No subscription to manage" }, 404)
  const session = await stripe.billingPortal.sessions.create({
    customer: row.stripeCustomerId,
    return_url: `${APP_URL}profile`,
    ...(stripeConfig.portalConfigurationId ? { configuration: stripeConfig.portalConfigurationId } : {}),
  })
  return c.json({ url: session.url } satisfies Redirect)
})

type WebhookDeps = {
  verifier: Pick<Stripe["webhooks"], "constructEventAsync">
  reader: StripeReader
  webhookSecret: string
}

/**
 * Stripe's server-to-server notifications. Authenticated by signature over the
 * raw body instead of a session or an Origin header, so it is mounted ahead of
 * the same-origin guard. Built from its dependencies so tests can sign real
 * requests without reaching Stripe.
 */
export const createStripeWebhook =
  ({ verifier, reader, webhookSecret }: WebhookDeps): Handler =>
  async (c) => {
    const signature = c.req.header("stripe-signature")
    if (!signature) return c.json({ error: "bad_request", message: "Missing signature" }, 400)

    let event
    try {
      event = await verifier.constructEventAsync(await c.req.text(), signature, webhookSecret)
    } catch {
      log.warn("billing.webhook_signature_rejected")
      return c.json({ error: "bad_request", message: "Invalid signature" }, 400)
    }

    await handleStripeEvent(reader, event)
    return c.json({ received: true })
  }

export const stripeWebhook: Handler =
  stripe && stripeConfig
    ? createStripeWebhook({ verifier: stripe.webhooks, reader: stripe, webhookSecret: stripeConfig.webhookSecret })
    : (c) => c.json(notConfigured, 404)
