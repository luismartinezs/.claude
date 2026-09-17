import { readdirSync, readFileSync } from "node:fs"
import { expect, type Page } from "@playwright/test"

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

/** Signs in the way a person does: request a link, open it, confirm. */
export const signIn = async (page: Page, email: string): Promise<void> => {
  await page.goto("/app/")
  await page.getByRole("textbox", { name: "Email" }).fill(email)
  await page.getByRole("button", { name: "Email me a sign-in link" }).click()
  await expect(page.getByText("Check your email")).toBeVisible()

  await page.goto(await latestSignInLink(email))
  await page.getByRole("button", { name: "Continue to Pawacook" }).click()
  await expect(page.getByRole("heading", { name: "What do you want to cook?" })).toBeVisible()
}
