import { expect, test } from "@playwright/test"
import { signIn } from "./support/auth.ts"

/**
 * The paywall as a person meets it. Paying is left to a manual run with a test
 * card, since Stripe's hosted pages are not ours to drive; everything up to
 * the redirect, and what the server refuses, is covered here.
 */

test("an account without a subscription sees only the Subscribe screen, and the server refuses its data", async ({ page }) => {
  await signIn(page, `e2e-unpaid-${Date.now()}@example.com`, { subscribed: false })

  const status = (await (await page.request.get("/api/billing")).json()) as { active: boolean }
  test.skip(status.active, "Stripe is not configured locally, so every account counts as subscribed")

  await expect(page.getByRole("heading", { name: "Cook what you have" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Subscribe" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Profile" })).toHaveCount(0)

  for (const path of ["/api/profile", "/api/recipes"]) {
    expect((await page.request.get(path)).status(), path).toBe(402)
  }
})

test("Subscribe hands over to Stripe's hosted checkout", async ({ page }) => {
  await signIn(page, `e2e-checkout-${Date.now()}@example.com`, { subscribed: false })

  const status = (await (await page.request.get("/api/billing")).json()) as { active: boolean }
  test.skip(status.active, "Stripe is not configured locally, so every account counts as subscribed")

  await page.getByRole("button", { name: "Subscribe" }).click()
  // Creates a test-mode Checkout Session that simply expires; nothing is paid.
  await page.waitForURL(/^https:\/\/checkout\.stripe\.com\//)
})

test("a subscribed account opens the workspace and can manage its subscription", async ({ page }) => {
  await signIn(page, `e2e-paid-${Date.now()}@example.com`)

  await page.getByRole("link", { name: "Profile" }).click()
  await expect(page.getByRole("button", { name: "Manage subscription" })).toBeVisible()
  // Starting a second subscription is refused on the server, whatever the page offers.
  const checkout = await page.request.post("/api/billing/checkout", { headers: { Origin: new URL(page.url()).origin } })
  expect(checkout.status()).toBe(409)
})
