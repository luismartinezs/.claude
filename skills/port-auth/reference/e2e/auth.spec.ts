import { expect, test } from "@playwright/test"
import { latestSignInLink, signIn } from "./support/auth.ts"

const requestLink = async (page: import("@playwright/test").Page, email: string): Promise<string> => {
  await page.goto("/app/")
  await page.getByRole("textbox", { name: "Email" }).fill(email)
  await page.getByRole("button", { name: "Email me a sign-in link" }).click()
  await expect(page.getByText("Check your email")).toBeVisible()
  return latestSignInLink(email)
}

test("a mail scanner fetching the link does not use it up", async ({ page }) => {
  const email = `e2e-scanner-${Date.now()}@example.com`
  const link = await requestLink(page, email)

  // What Outlook Safe Links and similar gateways do before the person clicks.
  expect((await page.request.get(link)).ok()).toBe(true)

  await page.goto(link)
  // The token leaves the address bar as soon as the app reads it.
  await expect(page).not.toHaveURL(/login_token/)
  await page.getByRole("button", { name: "Continue to Pawacook" }).click()
  await expect(page.getByRole("heading", { name: "What do you want to cook?" })).toBeVisible()
})

test("a sign-in link works only once", async ({ page, browser }) => {
  const email = `e2e-once-${Date.now()}@example.com`
  await signIn(page, email)
  const link = await latestSignInLink(email)

  const other = await browser.newContext()
  const replay = await other.newPage()
  await replay.goto(link)
  await replay.getByRole("button", { name: "Continue to Pawacook" }).click()
  await expect(replay.getByRole("alert")).toHaveText("This sign-in link has expired or was already used")
  expect((await replay.request.get("/api/profile")).status()).toBe(401)
  await other.close()
})

test("a failed Google redirect explains itself and keeps email sign-in available", async ({ page }) => {
  await page.goto("/app/?auth_error=google")
  await expect(page.getByRole("alert")).toHaveText("Google sign-in failed. Try again.")
  await expect(page).not.toHaveURL(/auth_error/)
  await expect(page.getByRole("button", { name: "Email me a sign-in link" })).toBeVisible()
})
