import { readdirSync, readFileSync } from "node:fs"
import { expect, type Page } from "@playwright/test"
import { sql } from "./db.ts"

const OUTBOX_DIR = new URL("../../../.dev/outbox/", import.meta.url)

/** The newest sign-in link the dev API wrote to the outbox for this address. */
export const latestSignInLink = async (email: string): Promise<string> => {
  const address = email.toLowerCase()
  let link: string | undefined
  await expect
    .poll(() => {
      const files = readdirSync(OUTBOX_DIR).sort().reverse()
      for (const file of files) {
        const message = JSON.parse(readFileSync(new URL(file, OUTBOX_DIR), "utf8")) as { to: string; text: string }
        if (message.to !== address) continue
        link = message.text.match(/https?:\/\/\S+login_token=[A-Za-z0-9_-]+/)?.[0]
        return link
      }
      return undefined
    })
    .toBeTruthy()
  return link!
}

/**
 * Stands in for a completed Stripe checkout: an active subscription to this
 * app's plan, written straight to the database. The ids are fake, so nothing
 * that calls Stripe for this account (portal, checkout) may be exercised.
 */
export const grantSubscription = (email: string): void => {
  if (!/^[a-z0-9.+-]+@example\.com$/.test(email)) throw new Error(`refusing to grant a subscription to ${email}`)
  sql(`
    insert into subscriptions (account_id, stripe_customer_id, stripe_subscription_id, status, product_key)
    select id, 'cus_e2e_' || id, 'sub_e2e_' || id, 'active', 'pro' from accounts where email = '${email}'
    on conflict (account_id) do update set status = 'active', product_key = 'pro'
  `)
}

/**
 * Signs in the way a person does: request a link, open it, confirm. By default
 * the account is then subscribed, so specs about the workspace hold whether or
 * not Stripe is configured locally; billing specs pass `subscribed: false`.
 */
export const signIn = async (page: Page, email: string, { subscribed = true } = {}): Promise<void> => {
  await page.goto("/app/")
  await page.getByRole("textbox", { name: "Email" }).fill(email)
  await page.getByRole("button", { name: "Email me a sign-in link" }).click()
  await expect(page.getByText("Check your email")).toBeVisible()

  await page.goto(await latestSignInLink(email))
  await page.getByRole("button", { name: "Continue to Pawacook" }).click()
  // Signed in: both the paywall and the workspace offer signing out.
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible()
  if (!subscribed) return

  grantSubscription(email.toLowerCase())
  await page.goto("/app/")
  await expect(page.getByRole("heading", { name: "What do you want to cook?" })).toBeVisible()
}
