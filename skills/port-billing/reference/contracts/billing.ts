import { z } from "zod"

/** The single plan. The price itself lives on the Stripe price; this is its label. */
export const PLAN = {
  priceLabel: "$29",
  period: "month",
  /** Recipe assistant requests (new recipes and chat messages) per rolling 30 days: about 100 recipes. */
  assistantRequestsPer30Days: 400,
} as const

export const BillingStatusSchema = z.object({
  active: z.boolean(),
  /** True once Stripe knows the account, so the billing portal has a customer to open. */
  manageable: z.boolean(),
})

export type BillingStatus = z.infer<typeof BillingStatusSchema>

export const RedirectSchema = z.object({ url: z.url() })

export type Redirect = z.infer<typeof RedirectSchema>

export const USAGE_LIMIT_MESSAGE = "Monthly recipe limit reached. It resets within 30 days."
