---
name: port-analytics
description: Port a privacy-friendly landing-page analytics kit (Umami loader, custom event helper, scroll-depth tracking, cookies banner) into an Astro site. Use when asked to add analytics, event tracking, scroll tracking, or a cookie banner to a static Astro frontend. Contains reference implementation, porting steps, and verification checklist.
---

# port-analytics: Landing-Page Analytics Kit

You are porting a small analytics kit from a reference codebase into the
current codebase. The reference in `reference/` is one instantiation
(Umami on an Astro static site). Adapt file placement, styling, and
naming to the target; do not impose the reference's folder structure or
banner design.

## What the feature is

Four independent pieces; port only what the user needs (default: all):

1. **Umami loader** (`umami-loader.astro-snippet.html`) — script tag in
   the layout head, gated on production AND both env vars present, plus
   a `?admin=true` query-param kill switch so the founder can exclude
   their own device via Umami's localStorage flag.
2. **`trackEvent` helper** (`track-event.ts`) — fire-and-forget custom
   events; silently no-ops when Umami is absent (dev, ad-blockers,
   unconfigured). Call sites never need guards.
3. **Scroll-depth tracker** (`scroll-tracker.astro` +
   `scroll-tracking.logic.ts` + test) — fires `scroll-depth` events at
   25/50/75/100%, each threshold once, and unbinds its listener after
   100%. Logic is pure and unit-tested; the component is a drop-in.
4. **Cookies banner** (`cookies-banner.astro`) — bottom banner, links to
   the privacy policy, dismissal persisted in localStorage. Zero
   framework JS; plain inline script.

## Invariants

1. **Analytics must be unobtrusive to code.** Every tracking call site
   works when analytics is absent. No conditionals at call sites, no
   crashes with ad-blockers. The no-op lives inside `trackEvent`.
2. **No dev pollution.** The loader must not run in dev builds or when
   env vars are missing. Keep the self-exclusion query-param trick.
3. **Scroll thresholds fire exactly once each**, and the listener is
   removed once all fired (`passive: true` meanwhile). Keep the pure
   logic + thin component split and port the test with it.
4. **Banner consent persists** across pages/visits via localStorage and
   the banner never blocks content interaction.

## Known adaptation points

- **Env plumbing.** Reference reads `PUBLIC_UMAMI_URL` /
  `PUBLIC_UMAMI_ID` via Astro env config. Use the target's env
  mechanism and naming; add the vars to its `.env.example`.
- **Different analytics provider.** If the target already uses
  Plausible/Fathom/GA, keep the kit's shape and swap the provider calls:
  `trackEvent` wraps the provider's API behind the same signature, and
  the scroll tracker calls `trackEvent` instead of `umami.track`
  directly (small improvement over the reference; make it).
- **Banner design and copy.** Restyle to the target's design system and
  tone. The reference is informational ("by using this app you agree"),
  not a consent-mode gate. If the target needs real GDPR consent
  gating (EU audience + non-anonymous analytics), say so to the user:
  that is a bigger feature, and Umami's cookieless mode is usually the
  simpler answer.
- **Privacy policy link** in the banner must point at the target's
  actual privacy page (see the port-legal-pages skill if none exists).
  Match the target's trailing-slash convention.
- **Placement.** Loader + banner go in the site layout(s); scroll
  tracker only on pages worth measuring (landing, pricing). If the
  target has multiple layouts, ask which ones get analytics.
- **Event taxonomy.** Reference events: `email-submit`, `scroll-depth`,
  `*-cta-click` via `data-umami-event` attributes. Offer to add
  `data-umami-event` attributes to the target's primary CTAs as part of
  the port; naming convention: kebab-case, `<subject>-<action>`.

## Porting steps

1. Survey: target layout file(s), env mechanism, existing analytics (if
   any: integrate, don't duplicate), design tokens, privacy page URL.
2. Add env vars + loader snippet to the layout head.
3. Place `track-event.ts` and the scroll files per target conventions;
   fix imports; port the logic test; run it.
4. Rebuild the cookies banner in target styling; include in layout body.
5. Wire CTAs: `data-umami-event` attributes and/or `trackEvent` calls
   where the user wants conversion tracking.

## Verification

1. Typecheck + unit tests (scroll logic) pass with target commands.
2. Dev server: NO umami script tag in the page source; `trackEvent`
   calls do not throw; banner appears, dismisses, and stays dismissed
   after reload (check localStorage key).
3. Production build + preview with env vars set: script tag present
   with correct website id; scroll to bottom of a tracked page and
   confirm via network tab (or Umami dashboard) that scroll-depth
   events fire once per threshold.
4. Confirm `?admin=true` sets `umami.disabled` in localStorage and
   `?admin=false` clears it.
5. Report: what was ported where, event names wired, env vars added,
   and whether the banner is informational vs consent-gating.
