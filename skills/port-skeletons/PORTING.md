# Porting Steps

## 0. Survey the target (decisions happen here, before any code)

Read the target's `CLAUDE.md`, `context/MEMORY.md` and its `design.md` visual
contract first. On any conflict, **the target's docs win**.

Establish, each answer feeding a decision:

- **Which screens fetch on mount, and from where.** List every route and the
  requests its screen makes before it can draw. This list becomes the sweep's
  `SCREENS`. A screen that asks for nothing until the person acts (a search
  box) is not a loading screen; leave it out and say why in a comment.
- **How the shell is gated today.** Find the root component's branches on
  session state (Pawalist had a centred launch button, then a different
  layout). Decides how much of step 2 applies.
- **Shared server state.** A store holding lists that several screens read?
  Decides where "loaded" flags live (store vs per-screen `null`).
- **Remembered/cached data.** Screens that keep their last answer between
  visits must keep doing so; their initial value becomes `null` (step 4).
- **Empty-state, panel, row and text classes.** Decides the skeleton markup
  and the sweep's `.empty` selector.
- **Design tokens and any skeleton recipe in `design.md`.**
- **E2E seeding and sign-in helpers.** Decides how the sweep gets an account
  with real ids.

## 1. Primitives

Reference: `reference/components/*`, `reference/design/*`

- Add the `.skeleton` class in the design package (or global CSS) with the
  target's tokens: `display: inline-block; vertical-align: middle; height:
  12px; border-radius: <control radius>; background: <hairline token>`.
- Add `scrollbar-gutter: stable` on `html` in the app's stylesheet.
- Add `Skeleton`, `SkeletonRows`, `ScreenSkeleton`, adapted to the target's
  row and panel markup. `SkeletonRows` must be exactly a real row's height.

Run the target's typecheck/build now.

## 2. The shell

Reference: `reference/app/App.vue` (search for `shellExpected`, `showShell`,
`pending`, and the `RouterView v-slot`)

- One template branch for "session pending on a device that signed in
  before" and "signed in". Account-bound bits (email, balance, badges) are
  skeletons while pending; actions that need the account are `:disabled`.
- The primary action (add/capture) works while pending.
- `<RouterView v-slot="{ Component }">`: render the component only when it
  exists and the session is known; otherwise `ScreenSkeleton`. Move any `:key`
  from `RouterView` onto the component.
- A device with no sign-in hint, or a launch at the sign-in page or carrying a
  login token, keeps a blank canvas until the session answers.

Verify in the browser with the session request held (Playwright `page.route`
that awaits a promise): the shell and the primary action are visible and
clickable, and the action's bounding box is identical after release.

## 3. Loaded state

Reference: `reference/app/stores-loaded.ts`, `reference/app/views/Upcoming.vue`

- Shared store: a `loaded` record set in each loader, reset with the account.
- Per-screen data: `null` until the first answer.
- Fix banners that derive from not-yet-loaded data (e.g. "needs the plan"
  computed as `false` while the account summary is `null`): guard them on the
  data being present.

## 4. Each screen

Reference: `reference/app/views/*.vue`

For every screen in the survey list:

- Counts, figures, dates: a `Skeleton` inside the same text element.
- Lists: `SkeletonRows`, or rows shaped like the real ones (same flex/wrap,
  bars where the action buttons sit) when real rows are taller than a plain
  row.
- Panels hidden with `v-if="data"`: render the panel with its title and
  skeleton contents instead.
- Forms filled from loaded settings: skeletons in the field positions, labels
  kept.
- Empty states: only after loaded, and never with a skeleton container
  carrying the empty-state class.
- Errors: skeletons guarded with `&& !error`.
- Data-derived banners and secondary panels: inside the panel they concern,
  next to the control they disable, or below the primary list (invariant 7).

## 5. The sweep

Reference: `reference/e2e/loading.ts`, `reference/e2e/loading-sweep.spec.ts`

- Copy `loading.ts` as is; adapt `ALWAYS_THROUGH` and the `.empty` selector.
- Write the spec with the target's sign-in and seed helpers and the survey's
  screen list, at a phone and a desk viewport.
- When several Playwright runs may happen at once, give each its own
  `--output` directory; shared `test-results/` produces bogus ENOENT failures.
- Filter with `-g "width (today|inbox)$"`: Playwright joins titles with
  spaces, not the `›` its reporter prints.

## Verification (the target's commands)

1. Typecheck and build pass.
2. The sweep passes on every screen at both widths.
3. Negative check: temporarily put an empty state back on one screen (render
   it while not loaded) and confirm the sweep fails with "an empty state is
   drawn before the data arrived"; revert.
4. The shell-first spec passes.
5. The full e2e suite has no failures that are not also failing on the base
   branch (run the base branch to know which those are).
6. Look at screenshots of two or three screens loading and loaded, at both
   widths.

Report: screens covered, anything excluded and why, the banners and panels
that were moved, and the sweep result.
