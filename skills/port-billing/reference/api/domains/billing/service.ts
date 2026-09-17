import Stripe from "stripe"
import { eq } from "drizzle-orm"
import { subscriptions } from "../../db/schema/index.ts"
import { db } from "../../platform/db.ts"
import { stripeConfig } from "../../platform/env.ts"
import { log } from "../../platform/logger.ts"

/** Stripe keeps retrying a failed renewal while past due, so access survives until it gives up. */
const ACCESS_STATUSES = new Set(["active", "past_due"])

/** Stripe never moves a subscription out of these, so a stored copy of them cannot be stale. */
const FINAL_STATUSES = new Set(["canceled", "incomplete_expired"])

export const stripe = stripeConfig && new Stripe(stripeConfig.secretKey)

/**
 * The Stripe account is shared with other App Forge Labs apps, and every
 * webhook endpoint receives the whole account's events. Objects this app
 * creates carry this metadata; events about anything else are acknowledged and
 * ignored. The Dashboard-created price carries it too, which is how a
 * subscription proves it pays for this app's plan.
 */
export const APP_METADATA = { app: "pawacook", product_key: "pro" } as const

const belongsToThisApp = (object: { metadata?: Stripe.Metadata | null }): boolean =>
  object.metadata?.app === APP_METADATA.app

export type SubscriptionRow = typeof subscriptions.$inferSelect

export const findSubscription = async (accountId: string): Promise<SubscriptionRow | null> => {
  const [row] = await db.select().from(subscriptions).where(eq(subscriptions.accountId, accountId))
  return row ?? null
}

type Entitlement = { status: string; productKey: string | null }

/**
 * Access needs a live status and a price tagged with this app's plan: status
 * alone would also accept a subscription switched to another app's price on
 * the shared account. Without billing configured (development and tests only;
 * production refuses to start) everyone is subscribed.
 */
export const grantsAccess = (entitlement: Entitlement | null, billingEnabled: boolean): boolean =>
  !billingEnabled ||
  (entitlement !== null &&
    ACCESS_STATUSES.has(entitlement.status) &&
    entitlement.productKey === APP_METADATA.product_key)

export const hasAccess = (row: SubscriptionRow | null): boolean => grantsAccess(row, stripeConfig !== null)

const idOf = (value: string | { id: string } | null): string | null =>
  value === null ? null : typeof value === "string" ? value : value.id

/** The plan key of the first item whose price belongs to this app, or null when none does. */
export const productKeyOf = (subscription: Stripe.Subscription): string | null => {
  const item = subscription.items.data.find((entry) => belongsToThisApp(entry.price))
  return item?.price.metadata.product_key ?? null
}

const entitlementOf = (subscription: Stripe.Subscription): Entitlement => ({
  status: subscription.status,
  productKey: productKeyOf(subscription),
})

const writeSubscription = async (accountId: string, subscription: Stripe.Subscription): Promise<void> => {
  const row = {
    accountId,
    stripeCustomerId: idOf(subscription.customer)!,
    stripeSubscriptionId: subscription.id,
    ...entitlementOf(subscription),
    updatedAt: new Date(),
  }
  await db
    .insert(subscriptions)
    .values(row)
    .onConflictDoUpdate({ target: subscriptions.accountId, set: row })
  log.info("billing.subscription_recorded", { userId: accountId, status: row.status, productKey: row.productKey })
}

/** Only the Stripe calls the webhook makes, so tests can stand in for Stripe. */
export type StripeReader = { subscriptions: Pick<Stripe["subscriptions"], "retrieve" | "list"> }

/** A subscription Stripe no longer knows (its customer was deleted in the Dashboard) grants nothing. */
const retrieveIfExists = async (client: StripeReader, id: string): Promise<Stripe.Subscription | null> => {
  try {
    return await client.subscriptions.retrieve(id)
  } catch (error) {
    if ((error as { code?: string }).code === "resource_missing") return null
    throw error
  }
}

/**
 * The account's subscription, re-read from Stripe when the stored copy denies
 * access. That copy can be stale (a lost webhook, a column added after it was
 * written), and trusting it would show the paywall to a paying subscriber and
 * let them start a second, duplicate subscription. Rows that already grant
 * access, or that ended for good, are served from the database, so neither a
 * subscriber nor a lapsed account calls Stripe on every page load.
 */
export const currentSubscription = async (client: StripeReader | null, accountId: string): Promise<SubscriptionRow | null> => {
  const row = await findSubscription(accountId)
  if (!client || !row || hasAccess(row) || FINAL_STATUSES.has(row.status)) return row
  const subscription = await retrieveIfExists(client, row.stripeSubscriptionId)
  if (!subscription) return row
  await writeSubscription(accountId, subscription)
  return findSubscription(accountId)
}

/**
 * Before a checkout, the thorough check: any of the returning customer's
 * subscriptions that grants access (one whose webhook never arrived, even
 * after the stored one ended for good) is recorded, and the checkout refused.
 * Checkouts are rare, so this is where Stripe is asked every time.
 */
export const subscriptionBeforeCheckout = async (client: StripeReader, accountId: string): Promise<SubscriptionRow | null> => {
  const row = await currentSubscription(client, accountId)
  if (!row || hasAccess(row)) return row
  const { data } = await client.subscriptions.list({ customer: row.stripeCustomerId, status: "all", limit: 100 })
  const live = data.find((subscription) => grantsAccess(entitlementOf(subscription), true))
  if (!live) return row
  await writeSubscription(accountId, live)
  return findSubscription(accountId)
}

/**
 * Every delivery records the subscription as read from Stripe, never the copy
 * inside the event: webhooks arrive out of order and may be replayed, and a
 * fresh read makes every delivery idempotent. A thrown error answers 500, so
 * Stripe retries the delivery.
 */
export const handleStripeEvent = async (client: StripeReader, event: Stripe.Event): Promise<void> => {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object
      if (!belongsToThisApp(session)) return
      const accountId = session.client_reference_id
      const subscriptionId = idOf(session.subscription)
      if (!accountId || !subscriptionId) return
      await recordCheckout(client, accountId, subscriptionId)
      return
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      if (!belongsToThisApp(event.data.object)) return
      // Only the subscription the account currently holds may change its access;
      // a late event about an older, replaced subscription is ignored.
      const [row] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.stripeSubscriptionId, event.data.object.id))
      if (!row) return
      const subscription = await retrieveIfExists(client, row.stripeSubscriptionId)
      if (subscription) await writeSubscription(row.accountId, subscription)
      return
    }
  }
}

/**
 * A completed checkout replaces the account's subscription unless the one it
 * already holds still grants access. That covers a late or retried delivery
 * for an older checkout, and a second checkout paid in another tab before the
 * first webhook landed. The second case charges the customer twice, which only
 * a person can resolve, so it is logged as an error with both ids.
 */
const recordCheckout = async (client: StripeReader, accountId: string, subscriptionId: string): Promise<void> => {
  const incoming = await retrieveIfExists(client, subscriptionId)
  if (!incoming) return

  const heldRow = await findSubscription(accountId)
  if (heldRow && heldRow.stripeSubscriptionId !== subscriptionId) {
    const held = await retrieveIfExists(client, heldRow.stripeSubscriptionId)
    if (held && grantsAccess(entitlementOf(held), true)) {
      if (grantsAccess(entitlementOf(incoming), true)) {
        log.error("billing.duplicate_subscription", {
          userId: accountId,
          keptSubscriptionId: held.id,
          duplicateSubscriptionId: incoming.id,
        })
      }
      await writeSubscription(accountId, held)
      return
    }
  }

  await writeSubscription(accountId, incoming)
}
