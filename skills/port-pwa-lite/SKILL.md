---
name: port-pwa-lite
description: Port a minimal PWA setup (web manifest, network-first service worker with build-hash cache busting, registration) into an Astro static site. Use when asked to make a site installable, add a service worker, or add offline asset caching. Contains reference files, the cache-versioning build plugin, porting steps, and verification checklist.
---

# port-pwa-lite: Minimal Installable PWA

You are porting a deliberately minimal PWA layer from a reference
codebase into the current codebase. The reference in `reference/` is one
instantiation (Astro static site, Vite build). Adapt naming and
placement to the target.

## What the feature is

- `site.webmanifest` — name, short_name, two maskable icons (192/512),
  theme/background color, `display: standalone`. Makes the site
  installable; nothing more.
- `sw.js` — a ~40-line service worker, network-first:
  - never intercepts API calls, auth routes, or navigations
  - caches successful GET responses for static assets as an offline
    fallback only
  - cache name embeds a per-build hash; activate handler deletes all
    other caches
- A Vite build plugin that stamps the build hash into `sw.js` after the
  build (`__BUILD_HASH__` placeholder), plus a 3-line registration
  script in the layout. See `integration-snippets.md`.

## Why it is shaped this way (teach the target maintainer via comments
where useful)

- **Network-first, no precache**: for a content/storefront site,
  aggressive SW caching is how you serve stale deploys forever. This SW
  can never show an outdated page because navigations bypass it
  entirely; it only rescues static assets when offline.
- **Build-hash cache name**: service workers outlive deploys. Without a
  per-build cache name + cleanup on activate, old assets accumulate and
  can be served after they're gone from the server.
- **API/auth exclusion**: intercepting auth redirects or API calls from
  a SW is a classic source of impossible-to-reproduce bugs. Excluded
  wholesale.

## Invariants

1. Navigations and API/auth paths are never intercepted.
2. Cache name is unique per build and stale caches are deleted on
   activate. The placeholder replacement must actually run; a SW
   deployed with the literal `__BUILD_HASH__` string never busts.
3. Registration is feature-detected (`'serviceWorker' in navigator`).
4. Manifest icons are maskable and both sizes exist as real files.

## Known adaptation points

- **Excluded path prefixes** (`/api`, `/login` in the reference): adjust
  to the target's API prefix and auth routes. Enumerate them by reading
  the target's routes/proxy config, don't guess.
- **Manifest identity**: name, short_name, theme/background colors from
  the target's brand. Icons: if the target lacks 192/512 maskable PNGs,
  generate them from its favicon/logo asset and note it for review.
- **Cache name prefix**: use the target product's slug.
- **Build plugin**: path `dist/sw.js` follows Astro's default outDir;
  adjust if overridden. If the target is not Vite-based (rare here),
  any post-build script that does the same string replacement is fine.
- **Scope**: `sw.js` and manifest must be served from the site root
  (`public/` in Astro) so the SW scope covers the whole origin.

## Porting steps

1. Survey: target `public/` dir, Astro/Vite config, API prefix, auth
   routes, brand colors, available icon assets, existing head partial.
2. Copy + adapt `site.webmanifest`; produce icons if missing.
3. Copy + adapt `sw.js` (cache prefix, excluded paths).
4. Add the build plugin to the target's config and the manifest link +
   registration script to the layout (see `integration-snippets.md`).

## Verification

1. `astro build`, then grep the built `sw.js` for `__BUILD_HASH__`:
   zero hits (the plugin ran); the cache name contains a hash.
2. Build twice; confirm the stamped hash differs between builds.
3. Preview server, browser DevTools → Application: SW activated,
   manifest parsed with no icon errors, install prompt available.
4. Network tab: API requests (if any) show no SW interception;
   reloading a page always hits the network for the document.
5. Report: files added, paths excluded, icon provenance, and where the
   plugin was registered.
