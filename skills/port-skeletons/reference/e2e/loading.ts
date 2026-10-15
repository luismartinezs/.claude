import type { BrowserContext, Page } from "@playwright/test"

/**
 * The checks the loading sweep runs on every screen, and the rule behind them.
 *
 * A screen whose data comes from the API draws in two moments: before the
 * answer and after it. Before, it must say "loading", never "nothing here":
 * an empty state, a zero or a missing panel drawn while the request is in
 * flight is a lie the person reads, then watches disappear. After, what
 * arrived must land where the skeleton stood, so nothing on screen jumps.
 *
 * The sweep holds every API response but the session check, so the shell and
 * the screen's own code are ready and only the data is missing. That is the
 * moment a real phone on a slow network sits in for a second or two.
 */

/** Requests let through while the data is held: without them there is no signed-in shell to look at. */
const ALWAYS_THROUGH = [/\/api\/auth\/session/]

/**
 * Layout shift allowed from navigation to settled, counting only the shifts
 * the rule forbids. 0.1 is the threshold Web Vitals calls "good".
 *
 * Not every shift counts. Data begins at the first skeleton on screen, and a
 * list whose length the skeleton could not know may push down what is below
 * it. So a shift is forgiven when everything it moved started at or below the
 * first skeleton and either moved down (a list above it grew, possibly out of
 * view) or settled by a few pixels (a count replacing a skeleton of another
 * width). Anything above that line moving counts, and so does a large move
 * sideways or up: a date line appearing over the panels, a banner flashing in
 * above a list, a column changing width.
 */
export const MAX_LAYOUT_SHIFT = 0.1

/**
 * The largest forbidden move allowed regardless of the score. The score weighs
 * moved area against the viewport, so a banner pushing a mostly-off-screen
 * page down 140px can stay under 0.1; a move that size is still a jump.
 */
export const MAX_FORBIDDEN_MOVE = 24

/**
 * Holds API responses until `release` is called, one gate per visit. Routes
 * once per page; each `hold()` closes a new gate for the next navigation.
 */
export const gateApi = async (page: Page): Promise<{ hold: () => void; release: () => void }> => {
  let gate: Promise<void> = Promise.resolve()
  let open: () => void = () => undefined
  await page.route(/\/api\//, async (route) => {
    if (!ALWAYS_THROUGH.some((pattern) => pattern.test(route.request().url()))) await gate
    await route.continue().catch(() => undefined)
  })
  return {
    hold: () => {
      gate = new Promise<void>((resolve) => {
        open = resolve
      })
    },
    release: () => open(),
  }
}

/** Records every layout shift the page makes, with what moved and from where to where, from the first paint on. */
export const recordLayoutShift = async (context: BrowserContext): Promise<void> => {
  await context.addInitScript(() => {
    type Rect = { top: number; left: number; width: number; height: number }
    type Shift = {
      value: number
      hadRecentInput: boolean
      sources?: Array<{ node?: Node | null; previousRect: Rect; currentRect: Rect }>
    }
    type Place = { top: number; left: number; gone: boolean }
    type Moved = { what: string; from: Place; to: Place }
    const record = { entries: [] as Array<{ value: number; moved: Moved[] }> }
    ;(window as unknown as { __layoutShift: typeof record }).__layoutShift = record
    const describe = (node: Node | null | undefined): string => {
      if (!(node instanceof Element)) return node?.nodeName ?? "?"
      const id = node.getAttribute("data-testid")
      const classes = Array.from(node.classList).slice(0, 3).join(".")
      const text = (node.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40)
      return `${node.tagName.toLowerCase()}${id ? `[${id}]` : ""}${classes ? `.${classes}` : ""} "${text}"`
    }
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as unknown as Shift[]) {
        if (entry.hadRecentInput) continue
        record.entries.push({
          value: entry.value,
          moved: (entry.sources ?? []).map((source) => ({
            what: describe(source.node),
            from: { top: source.previousRect.top, left: source.previousRect.left, gone: false },
            // An element pushed out of the viewport reports an empty rect.
            to: {
              top: source.currentRect.top,
              left: source.currentRect.left,
              gone: source.currentRect.width === 0 && source.currentRect.height === 0,
            },
          })),
        })
      }
    }).observe({ type: "layout-shift", buffered: true })
  })
}

/** What is wrong with a screen whose data has not arrived. */
export const whileLoading = async (page: Page): Promise<string[]> =>
  page.evaluate(() => {
    const shown = (element: Element): boolean => {
      const style = getComputedStyle(element)
      return element.getClientRects().length > 0 && style.visibility !== "hidden" && style.display !== "none"
    }
    const main = document.querySelector("main")
    if (!main) return ["no <main> on the page"]
    const problems: string[] = []
    const marked = Array.from(main.querySelectorAll(".skeleton, [aria-busy='true']")).some(shown)
    if (!marked) problems.push("nothing in the content area says it is loading: no skeleton and no aria-busy region")
    for (const empty of Array.from(main.querySelectorAll(".empty"))) {
      if (shown(empty)) problems.push(`an empty state is drawn before the data arrived: "${(empty.textContent ?? "").trim().slice(0, 80)}"`)
    }
    // Where the data begins, for judging the shifts once it arrives: the top
    // of the text element the first skeleton stands in, not of the bar itself,
    // which sits a few pixels down inside that element's line.
    const tops = Array.from(main.querySelectorAll(".skeleton"))
      .filter(shown)
      .map((element) => (element.parentElement ?? element).getBoundingClientRect().top)
    ;(window as unknown as { __dataBegins: number }).__dataBegins = tops.length > 0 ? Math.min(...tops) : Infinity
    return problems
  })

/** What is wrong once every request has answered. */
export const onceSettled = async (page: Page): Promise<string[]> => {
  const problems = await page.evaluate(() => {
    const left = Array.from(document.querySelectorAll(".skeleton")).filter((element) => element.getClientRects().length > 0)
    return left.length > 0 ? [`${left.length} skeleton(s) still drawn after every request answered`] : []
  })
  const shift = await page.evaluate(() => {
    type Place = { top: number; left: number; gone: boolean }
    type Moved = { what: string; from: Place; to: Place }
    const { entries } = (window as unknown as { __layoutShift: { entries: Array<{ value: number; moved: Moved[] }> } }).__layoutShift
    const begins = (window as unknown as { __dataBegins?: number }).__dataBegins ?? Infinity
    /** Within the data, a move down or a settle of a few pixels; above it, nothing. */
    const SETTLE = 32
    const forgiven = (moved: Moved): boolean => {
      if (moved.from.top < begins - 1) return false
      if (moved.to.gone) return true
      const down = moved.to.top - moved.from.top
      const across = Math.abs(moved.to.left - moved.from.left)
      return (down > 0 && across < 1) || (Math.abs(down) < SETTLE && across < SETTLE)
    }
    const counted = entries.filter((entry) => entry.moved.length === 0 || !entry.moved.every(forgiven))
    const largest = Math.max(
      0,
      ...counted.flatMap((entry) =>
        entry.moved
          .filter((moved) => !forgiven(moved) && !moved.to.gone)
          .map((moved) => Math.max(Math.abs(moved.to.top - moved.from.top), Math.abs(moved.to.left - moved.from.left))),
      ),
    )
    return {
      largest,
      total: counted.reduce((sum, entry) => sum + entry.value, 0),
      moved: counted.flatMap((entry) =>
        entry.moved.filter((moved) => !forgiven(moved)).map((moved) =>
          `${entry.value.toFixed(3)} ${moved.what} ${Math.round(moved.from.left)},${Math.round(moved.from.top)}→${moved.to.gone ? "out of view" : `${Math.round(moved.to.left)},${Math.round(moved.to.top)}`}`),
      ),
    }
  })
  if (shift.total > MAX_LAYOUT_SHIFT || shift.largest >= MAX_FORBIDDEN_MOVE) {
    problems.push(
      `layout shift ${shift.total.toFixed(3)} (max ${MAX_LAYOUT_SHIFT}), largest forbidden move ${Math.round(shift.largest)}px (max ${MAX_FORBIDDEN_MOVE - 1}); moved: ${shift.moved.slice(0, 6).join(" | ")}`,
    )
  }
  return problems
}
