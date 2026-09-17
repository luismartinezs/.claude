import type Stripe from "stripe"
import { describe, expect, test } from "vitest"
import { grantsAccess, productKeyOf } from "./service.ts"

const pro = (status: string) => ({ status, productKey: "pro" })

describe("grantsAccess", () => {
  test("an active or past-due subscription to this app's plan grants access", () => {
    expect(grantsAccess(pro("active"), true)).toBe(true)
    expect(grantsAccess(pro("past_due"), true)).toBe(true)
  })

  test("no subscription, or one that ended or never completed, is refused", () => {
    expect(grantsAccess(null, true)).toBe(false)
    for (const status of ["canceled", "unpaid", "incomplete", "incomplete_expired", "trialing", "paused"]) {
      expect(grantsAccess(pro(status), true)).toBe(false)
    }
  })

  test("an active subscription without this app's plan price is refused", () => {
    expect(grantsAccess({ status: "active", productKey: null }, true)).toBe(false)
    expect(grantsAccess({ status: "active", productKey: "team" }, true)).toBe(false)
  })

  test("without billing configured every account has access", () => {
    expect(grantsAccess(null, false)).toBe(true)
  })
})

describe("productKeyOf", () => {
  const withPrices = (...metadata: Record<string, string>[]) =>
    ({ items: { data: metadata.map((entry) => ({ price: { metadata: entry } })) } }) as unknown as Stripe.Subscription

  test("reads the plan key from the item whose price belongs to this app", () => {
    expect(productKeyOf(withPrices({ app: "mindstring", product_key: "team" }, { app: "pawacook", product_key: "pro" }))).toBe("pro")
  })

  test("is null when no price belongs to this app", () => {
    expect(productKeyOf(withPrices({ app: "mindstring", product_key: "pro" }))).toBeNull()
    expect(productKeyOf(withPrices({}))).toBeNull()
  })
})
