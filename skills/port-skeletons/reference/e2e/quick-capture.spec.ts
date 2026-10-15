import { devices, expect, test } from "@playwright/test"
import { LOCAL, freshEmail, signIn } from "./support/auth.ts"

test("Quick Add saves offline, then syncs one capture when the phone reconnects", async ({ browser }) => {
  test.skip(!LOCAL, "uses the development sign-in")
  const context = await browser.newContext(devices["Pixel 5"])
  const page = await context.newPage()
  try {
    await signIn(page, freshEmail("offline-capture"), { plan: false })
    await page.goto("/app/capture")
    await expect(page.getByTestId("quick-add-text")).toBeVisible()
    await context.setOffline(true)

    const thought = `Offline capture ${Date.now()}`
    await page.getByTestId("quick-add-text").fill(thought)
    await page.getByTestId("quick-add-save").click()
    await expect(page.getByText("Saved on this device", { exact: true }).first()).toBeVisible()
    await expect(page.getByTestId("quick-add-text")).toHaveValue("")

    await context.setOffline(false)
    await expect(page.getByText("Saved to Inbox", { exact: true }).first()).toBeVisible()
    const result = await page.request.get("/api/captures")
    const body = (await result.json()) as { items: Array<{ text: string }> }
    expect(body.items.filter((item) => item.text === thought)).toHaveLength(1)

    await context.setOffline(true)
    await page.locator('input[type="file"][accept="image/*"]').setInputFiles({
      name: "note.png",
      mimeType: "image/png",
      buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"),
    })
    await page.getByTestId("quick-add-save").click()
    await expect(page.getByText("Saved on this device", { exact: true }).first()).toBeVisible()
    await context.setOffline(false)
    await expect(page.getByText("Saved to Inbox", { exact: true }).first()).toBeVisible()
    const withImage = (await (await page.request.get("/api/captures")).json()) as {
      items: Array<{ id: string; attachments: Array<{ filename: string }> }>
    }
    expect(withImage.items.some((item) => item.attachments.some((attachment) => attachment.filename === "note.png"))).toBe(true)
  } finally {
    await context.close()
  }
})

test("Quick Add accepts typing while the app checks the session", async ({ browser }) => {
  test.skip(!LOCAL, "uses the development sign-in")
  const context = await browser.newContext(devices["Pixel 5"])
  const page = await context.newPage()
  try {
    await signIn(page, freshEmail("launch-capture"), { plan: false })
    let releaseSession!: () => void
    const paused = new Promise<void>((resolve) => { releaseSession = resolve })
    await page.route("**/api/auth/session", async (route) => {
      await paused
      await route.continue()
    })

    await page.goto("/app/", { waitUntil: "domcontentloaded" })
    // The shell is drawn before the session answers: the add action is already
    // where it stays, and the screen is a skeleton until there is someone to show.
    await expect(page.getByTestId("screen-skeleton")).toBeVisible()
    const add = page.getByTestId("global-add")
    const before = await add.boundingBox()
    await add.click()
    const field = page.getByTestId("quick-add-text")
    await field.fill("A thought before the session loads")
    await expect(field).toBeFocused()

    releaseSession()
    await expect(page.getByTestId("screen-skeleton")).toHaveCount(0)
    expect(await add.boundingBox()).toEqual(before)
    await expect(field).toHaveValue("A thought before the session loads")
    await expect(field).toBeFocused()
  } finally {
    await context.close()
  }
})
