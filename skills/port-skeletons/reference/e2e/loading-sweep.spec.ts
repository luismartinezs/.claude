import { devices, expect, test, type BrowserContext, type Page } from "@playwright/test"
import { LOCAL, freshEmail, signIn } from "./support/auth.ts"
import { seedAccount, seedWorkingHours, type Seeded } from "./support/mobile-seed.ts"
import { gateApi, onceSettled, recordLayoutShift, whileLoading } from "./support/loading.ts"

/**
 * Every screen, with its data held back and then let through.
 *
 * While held, the screen must be drawn and say it is loading (a skeleton or
 * an aria-busy region) and must not show an empty state: "nothing here"
 * before the answer is a claim the screen cannot know. Once released, no
 * skeleton may be left behind and the page may not have shifted by more than
 * `MAX_LAYOUT_SHIFT`. The rules are written down in `support/loading.ts`.
 *
 * Search is not here: it asks for nothing until something is typed, so its
 * prompt is true from the first frame. A new screen is added to SCREENS. A screen that fails here fails the suite,
 * so the pattern does not depend on anyone remembering it.
 */
test.describe.configure({ mode: "default" })

const SCREENS = (seeded: Seeded): ReadonlyArray<readonly [string, string]> => [
  ["today", "/"],
  ["upcoming", "/upcoming"],
  ["inbox", "/inbox"],
  ["projects", "/projects"],
  ["agent", "/agent"],
  ["clarifications", "/clarifications"],
  ["project", `/projects/${seeded.projectId}`],
  ["task", `/tasks/${seeded.taskId}`],
  ["series", `/series/${seeded.seriesId}`],
  ["trash", "/trash"],
  ["context", "/context"],
  ["memory", "/memory"],
  ["billing", "/billing"],
  ["developer", "/developer"],
  ["export", "/export"],
  ["activity", "/activity"],
  ["settings", "/settings"],
  ["setup", "/setup"],
  ["approve", `/approve/${seeded.challengeId}`],
]

const WIDTHS = [
  ["phone", { ...devices["Pixel 5"], deviceScaleFactor: 1 }],
  ["desk", { viewport: { width: 1440, height: 900 } }],
] as const

for (const [width, options] of WIDTHS) {
  test.describe(`loading, at ${width} width`, () => {
    test.skip(!LOCAL, "seeds the development database")
    test.describe.configure({ timeout: 60_000 })

    let context: BrowserContext
    let page: Page
    let seeded: Seeded
    let gate: Awaited<ReturnType<typeof gateApi>>

    test.beforeAll(async ({ browser }) => {
      context = await browser.newContext(options)
      page = await context.newPage()
      const email = await signIn(page, freshEmail(`loading-${width}`), { plan: false })
      // Sixty rows, not two hundred: the seed's placements reach task 57, and
      // the skeleton stands in for a typical list, not a stress test.
      seeded = seedAccount(email, { rows: 60 })
      seedWorkingHours(seeded.accountId)
      await recordLayoutShift(context)
      gate = await gateApi(page)
    })

    test.afterAll(async () => {
      await context.close()
    })

    // The list needs the seeded ids, which exist only after beforeAll; the
    // names are fixed, so one test per screen is declared up front.
    for (const [name] of SCREENS({ projectId: "", taskId: "", seriesId: "", challengeId: "" } as Seeded)) {
      test(name, async () => {
        const path = SCREENS(seeded).find(([candidate]) => candidate === name)![1]
        gate.hold()
        await page.goto(`/app${path}`)
        // The screen's own code has arrived when the shell's placeholder gives way.
        await expect(page.getByTestId("screen-skeleton")).toHaveCount(0, { timeout: 15_000 })
        await page.waitForTimeout(300)
        const loading = await whileLoading(page)
        gate.release()
        await page.waitForLoadState("networkidle")
        await page.waitForTimeout(500)
        const settled = await onceSettled(page)
        expect([...loading.map((problem) => `while loading: ${problem}`), ...settled], `${name} at ${width} width`).toEqual([])
      })
    }
  })
}
