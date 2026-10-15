---
name: port-skeletons
description: Port shell-first rendering and in-place loading skeletons into a Vue SPA whose screens load their data from an API client-side - the app shell and primary actions draw on the first frame, every value not yet loaded is a pulsing skeleton standing where it will land, "not loaded" is never drawn as "empty", the scrollbar gutter is reserved, and nothing jumps when the data arrives. Also ports the Playwright loading sweep that holds every API response, visits every screen, and fails on empty states while loading, leftover skeletons, or forbidden layout shift. Use when asked to add skeletons, loading states, shell-first or instant app shell, fix layout shift or content jumping on load, fix "empty state flashes before data", or when building or reviewing any SPA screen that fetches data on mount. Contains the reference components, the shell and per-screen patterns, the sweep, and porting and verification steps.
---

# port-skeletons: shell first, skeletons in place, enforced by a sweep

You are porting a proven loading-state pattern from Pawalist (Vue 3 + Vite +
Vue Router + Tailwind v4, design tokens in a shared `theme.css`) into the
current codebase. The files in `reference/` are ONE instantiation. Adapt the
shell structure, class names, tokens and test helpers to the target. Only the
invariants below must survive the port.

The doctrine this enforces lives in
`/home/luis/claymore/coding/software-architecture.md`, section "Loading states".

## What the feature is

A screen whose data arrives from the API draws twice: before the answer and
after it. Both are part of the screen.

1. **Shell first.** Navigation, top bar and the primary actions draw on the
   first frame, before any request returns, each where it will stay. In
   Pawalist the Quick Add button is the same element from the first frame to
   the signed-in app; it never appears somewhere else first.
2. **Skeletons in place.** Everything not yet known (the account's email and
   balance, the screen before its code or session arrives, each list, count
   and figure) is a pulsing bar in the same container and text element the
   value will occupy.
3. **Not loaded is not empty.** "Has this loaded" is its own state. Empty
   states, zeros and data-derived banners appear only after the answer.
4. **Nothing jumps.** The scrollbar gutter is reserved; skeletons take the
   line height of the text they stand in for; content that only exists when
   the data says so never pops in above the content that does.
5. **Enforced.** A Playwright loading sweep visits every screen with the API
   held and fails the suite when a screen breaks rules 2-4.

## File inventory (reference/)

| File | Role |
|---|---|
| `components/Skeleton.vue` | One bar. Sized by caller classes. `aria-hidden`. |
| `components/SkeletonRows.vue` | List rows that have not loaded: row height, a circle and a line of varying width. |
| `components/ScreenSkeleton.vue` | The content area before its screen can draw (session check, route chunk). |
| `design/skeleton.css` | The `.skeleton` component class (inline-block, middle-aligned, token colour). |
| `design/scrollbar.css` | `scrollbar-gutter: stable` on `html`. |
| `app/App.vue` | The shell: one template branch for loading and signed-in, account-bound parts as skeletons, `RouterView` slot that holds a `ScreenSkeleton` until the session and the route component are both ready. |
| `app/stores-loaded.ts` | The "which lists have answered" pattern in a shared store (excerpt). |
| `app/views/*.vue` | Per-screen examples: Today (figures, meter, rows), Upcoming (remembered `null`-until-loaded, day panels), Inbox (data-derived banners moved inside the panel, a secondary panel moved below the primary list), Projects (rows shaped like real rows incl. action buttons), Settings (form fields), and others. |
| `app/components/AgentChat.vue` | A banner moved next to the control it disables instead of above the content. |
| `e2e/loading.ts` | The sweep's checks: API gate, layout-shift recorder, "while loading" and "once settled" judgements. Copy as is; it is framework-agnostic. |
| `e2e/loading-sweep.spec.ts` | The sweep: every screen at phone and desk width. |
| `e2e/quick-capture.spec.ts` | The shell-first assertion: the primary action is clickable while the session is held and has not moved once it answers. |

## Invariants

1. **The shell renders before the session answers, on a device that has
   signed in before.** Use a device hint (Pawalist: the last signed-in account
   id in `localStorage`). WHY: a returning user's first action must not wait
   for a round trip, and must not hit a control that moves. A device that never
   signed in, or a launch headed for sign-in, waits instead, or the shell
   flashes and vanishes.
2. **One element per primary action across loading and loaded.** The loading
   shell and the signed-in shell are the same template branch with
   conditional skeletons, not two layouts. WHY: two layouts remount the
   button, which moves it and can drop focus or a half-typed draft.
3. **Screens do not mount until the session is known.** The content area
   holds a `ScreenSkeleton` until then. WHY: screens fetch on mount, and
   fetching as nobody produces 401s and a flash of errors.
4. **"Loaded" is explicit.** `null` until the first answer, or a flag set by
   the loader and cleared on account change. Never inferred from `[]`. WHY:
   an empty array is also the true answer for a new account, so the screen
   cannot tell "nothing yet" from "nothing".
5. **A skeleton stands inside the element its value will occupy**, is
   inline-block and vertically centred, and carries no text. WHY: it then
   takes that element's line height and the value replaces it without moving
   anything.
6. **Pulse respects reduced motion** (`motion-safe:animate-pulse`). WHY: the
   design contracts stop motion under `prefers-reduced-motion`.
7. **Data-derived content never appears above content that was already
   drawn.** Banners that depend on the answer go inside the panel they concern
   (under its header) or next to the control they disable; secondary panels
   that exist only when non-empty go below the primary list. WHY: otherwise
   the screen jumps the moment the answer lands.
8. **A failed load replaces the skeleton with the error.** Guard skeletons with
   `&& !error`. WHY: a skeleton that pulses forever reads as "still loading".
9. **The sweep covers every screen and runs with the e2e suite.** A new screen
   is added to its list. WHY: the doctrine is enforced, not remembered; this is
   the whole reason the pattern stopped regressing.

## The sweep's rules (what `e2e/loading.ts` checks)

- While every API response but the session check is held, `<main>` contains a
  visible `.skeleton` or `[aria-busy="true"]`, and no visible `.empty`.
- After release and network idle: no visible `.skeleton` anywhere.
- Layout shift from navigation to settled is at most 0.1 (Web Vitals "good"),
  counting only forbidden shifts. Data begins at the top of the text element
  the first skeleton stands in. A shift is forgiven when everything it moved
  started at or below that line and either moved down (a list above it grew,
  possibly out of view) or settled by less than 32px (a count replacing a bar
  of another width). Anything above the line moving counts.
- Separately, any forbidden move of 24px or more fails whatever the score: the
  score weighs area against the viewport, so a banner pushing a mostly
  off-screen page down 140px can score under 0.1 and still be a jump.

Typical findings and their fixes, all met in Pawalist:

- A data-derived banner above the content ("needs the plan", "waiting for
  credits", "rules contradict") → inside the panel it concerns, under its
  header, or beside the control it disables.
- A panel that exists only when non-empty, above the primary list → below it.
- A header row whose title arrives long and wraps the actions onto the next
  line → at desk width the title takes `min-w-0 flex-1` and wraps in its own
  column, the actions `shrink-0`.
- A table header drawn over skeleton rows slides sideways when auto-sized
  columns meet real data → skeleton tables have no `<thead>`.

## Known adaptation points

- **Empty-state marker.** The sweep looks for `.empty`. If the target's empty
  states use another class or component, mark them (a class or `data-empty`)
  and change the one selector in `loading.ts`.
- **Session endpoint.** `ALWAYS_THROUGH` lets `/api/auth/session` through so
  the signed-in shell exists. Use the target's session or `me` endpoint.
- **Shell placeholder test id.** The spec waits for `screen-skeleton` to leave
  before judging the screen. Keep the id or change both places.
- **Seeding.** The spec seeds an account with records so detail routes
  (`/tasks/:id`) resolve. Reuse the target's e2e seed or create records through
  its API; the sweep needs one real id per detail route.
- **Design tokens.** `.skeleton` uses the token for hairlines
  (`--color-line`) and the control radius. Use the target's equivalents; if the
  target's `design.md` defines a skeleton recipe, it wins.
- **No router/session split** (a public, sessionless SPA): drop invariant 1's
  device hint and invariant 3; render the shell unconditionally.
- **Not Vue.** The invariants and the sweep port to React/Svelte unchanged; the
  shell mechanics (`RouterView` slot) become the target router's pending-route
  idiom.

## Dependencies

None. Tailwind's `animate-pulse` (or a 2-line keyframe) and Playwright, which
the target already has. If the port wants a skeleton library, that is a red
flag: the whole point is that skeletons are the real containers with bars in
them, which no library can know.

## Process

Follow `PORTING.md`. Do not report done until the sweep passes on every screen
at both widths and the existing e2e suite has no new failures.
