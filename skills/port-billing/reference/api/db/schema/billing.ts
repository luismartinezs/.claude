import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"
import { accounts } from "./auth.ts"

/**
 * One row per account that has ever reached Stripe Checkout. Stripe owns the
 * subscription; this is the last status its webhooks reported.
 */
export const subscriptions = pgTable(
  "subscriptions",
  {
    accountId: text("account_id")
      .primaryKey()
      .references(() => accounts.id, { onDelete: "cascade" }),
    stripeCustomerId: text("stripe_customer_id").notNull(),
    stripeSubscriptionId: text("stripe_subscription_id").notNull(),
    /** Stripe's subscription status, verbatim (active, past_due, canceled, ...). */
    status: text("status").notNull(),
    /** The `product_key` metadata of this app's price on the subscription; null when no item carries this app's price. */
    productKey: text("product_key"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("subscriptions_customer_idx").on(t.stripeCustomerId)],
)
