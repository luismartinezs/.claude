# Porting Steps

Work in this order. Each step leaves the build green or moves toward it.
"Reference:" points into `reference/` in this skill directory.

## 0. Survey the target (before writing anything)

First, read the target's own architecture docs — root and app-level
CLAUDE.md, plus anything they point to (`context/`, engineering guides).
**On any conflict, the target's documented conventions override the
reference implementation** — including file granularity and styling, not
just placement.

Then establish, by reading the target codebase:

- Where do feature code, shared components, and pages live? (You will
  mirror its structure, not the reference's.)
- What file-granularity convention does it follow? (e.g. fewest-files /
  one-file-per-slice vs many small components — this decides whether the
  reference's 8 components collapse.)
- What does the site layout component accept? (title, description, SEO
  overrides, head slot?)
- Astro config: `trailingSlash` setting, `site` URL, integrations present
  (sitemap? vue? tailwind version?).
- Is `@tailwindcss/typography` installed and registered? Check for
  existing `prose` usage.
- What color tokens / design system does it use?
- Does `src/content.config.ts` already exist with other collections?
- Is the target a live product or a template/boilerplate? (This decides
  content volume and copy in steps 4 and 6.)

**Design-fidelity decision (make it NOW, it gates step 5).** Classify the
target: (a) design system → translate tokens; (b) raw Tailwind palette →
adapt; (c) deliberately unstyled / bare HTML (existing pages have few or
no class attributes) → port semantics only: zero classes, semantic HTML,
no typography plugin, no pill expander, CTA as a bare stub link. Do NOT
"translate" a styled reference into an invented neutral design for an
unstyled target. If ambiguous, ask the user here.

Decide and note the target locations for: articles dir, logic file,
components dir, pages. Present this mapping to the user only if the
target has no obvious convention; otherwise just follow it.

## 1. Content collection

Reference: `content-collection.ts`

- Add the `blog` collection to the target's `src/content.config.ts`
  (create the file if absent, merge into `collections` if it exists).
- Point the glob loader `base` at the chosen articles directory.
- Keep the schema field-for-field unless the target product needs more.
  Extra frontmatter keys not in the schema are allowed by Astro only if
  added to the schema, so any product-specific metadata goes here too.

## 2. Content dictionaries

Reference: `content.ts`

- Create the AUTHORS and CATEGORIES dictionaries with the target
  product's real data. Ask the user for author name/role/bio/avatar if
  not discoverable; a single founder author is the normal starting point.
- Draft an initial category taxonomy from the product's content strategy
  (3-6 categories). Confirm with the user before finalizing, since
  category slugs become permanent URLs.
- Keep `as const satisfies Record<string, T>` so ids stay literal-typed.

## 3. Logic + tests

Reference: `blog.logic.ts`, `blog.logic.test.ts`

- Copy the logic file nearly verbatim; it has no framework imports. Only
  the `./content` import path changes. (If the target mandates fewest
  files, merging the dictionaries into the logic file is fine — the
  content-model split invariant is about code vs frontmatter, not about
  file count.)
- Port the test file. Adjust the test runner import (`bun:test` vs
  `vitest`) to whatever the target uses. Run the tests now.
- **Also run the target's typecheck now, not just the tests.** This is
  often the first test file in the frontend workspace, so the test-runner
  type declarations are typically missing there even when the tests run:
  for Bun, add `@types/bun` to the frontend package and `"types": ["bun"]`
  to its tsconfig (mirror the backend's setup); for vitest, its `types`
  entry. Fixing this at final verification means rebuilding trust in
  everything stacked on top — fix it here.

## 4. Sample articles

Reference: `example-article.md`

- Content volume follows the target's purpose (from step 0):
  - **Template/boilerplate target:** exactly ONE article, loudly marked as
    a stub (title prefixed "STUB:", body text that says to delete it).
    Templates want minimal, obviously-fake content, not plausible prose.
  - **Live product target:** 2-3 articles, real or placeholder, so every
    page has content to render.
- Frontmatter must use the actual author id and category slugs from
  step 2.
- Cover images: use existing images in the target's `public/`, or create
  a minimal one-line placeholder SVG (rect + label); note missing real
  images to the user at the end.

## 5. Components

Apply the step-0 design-fidelity decision BEFORE porting anything here.

**Unstyled target (class (c)):** most of these components exist only to
carry styling and should NOT be ported one-to-one. Collapse to roughly one
shared listing component (title link, summary, author, date, category
links — used by the index page, category pages, and related-articles) and
inline the rest (author bio, related block, CTA stub link) directly into
the pages. Skip the pill expander and the `:global(table)` style entirely.
Expect ~1 component, not 8.

**Styled target (class (a)/(b)):** reference components in dependency
order:

1. `category-pill.astro` — link pill; no deps
2. `author-avatar.astro` — img or initial fallback; no deps
3. `author-card.astro` — avatar + name/role/bio
4. `card-article.astro` — cover, pills with "+N" expander (inline script),
   stretched-link title, summary, author row
5. `articles-grid.astro` — responsive 1/2/3-col grid, empty state,
   resolves authors/categories per card
6. `article-cta.astro` — REWRITE for the target product (see SKILL.md);
   keep the shape: tinted band, icon, h2, one-liner, primary CTA link
7. `article-aside.astro` — sticky author card + related list
8. `article-page.astro` — prose column + sidebar layout + CTA; keeps the
   mobile table-scroll `:global(table)` style

Adapt per component: import paths, icon package, color tokens, and any
target design-system primitives that already do the same job (e.g. if the
target has an Avatar component, use it instead of porting author-avatar).
Even in styled targets, merge components the target's file-granularity
convention says shouldn't exist separately.

## 6. Pages

Reference: `pages/blog-index.astro`, `pages/blog-slug.astro`,
`pages/category-slug.astro`

- Create `src/pages/blog/index.astro`, `src/pages/blog/[slug].astro`,
  `src/pages/blog/category/[slug].astro` in the target.
- Adapt the Layout wrapper and SEO wiring to the target's layout API
  (see SKILL.md adaptation points). Preserve, in whatever form the
  target supports:
  - per-article `<title>` and meta description (from title/summary)
  - OpenGraph `article` type with image, publishedTime, modifiedTime, tags
  - JSON-LD BlogPosting script in `<head>` (publisher name/logo come from
    the target's app config, not hardcoded)
- Match the target's trailing-slash convention in all internal hrefs
  (grep the files you just wrote for `href=` and check each).
- Hero/CTA/dictionary copy: default to one-line stubs with the target's
  placeholder convention (e.g. "STARTER:" markers) unless the user asked
  for real copy or the target is a live product. Do not write plausible
  marketing prose into a template.

## 7. Integration (offer, then do what the user wants)

- Nav: add "Blog" link to the target's navigation config (header and/or
  footer).
- Landing page: optional "From the Blog" section — 3 newest published
  articles via the same `filterPublished` + `sortByDate` + card component.
- If the target has a sitemap integration, confirm blog routes appear in
  the built sitemap.

## Verification (all must pass before reporting done)

1. Typecheck: the target's typecheck command (e.g. `astro check`).
   (Should already be green from step 3 — if it fails here on test-runner
   types, that fix was missed in step 3.)
2. Unit tests: run the ported logic tests.
2b. Unstyled port only: grep the built blog HTML for `class=` (expect
   zero) and count `<script>` tags (expect only the layout's own plus the
   JSON-LD data block — no blog client JS).
3. Build: `astro build` completes. This is the real gate; it exercises
   getStaticPaths, frontmatter Zod validation, and the throwing resolvers.
4. Negative test: temporarily set a bogus `author:` in one article and
   confirm the build FAILS with the "Unknown author" error, then revert.
   This proves build-time validation survived the port.
5. Preview (`astro preview` or dev server): visually check `/blog/`, one
   article page, and one category page. Confirm: prose styling applied
   (if body text is unstyled, the typography plugin is missing), sidebar
   sticks on desktop, "+N" pill expander works, no horizontal overflow
   on mobile widths.
6. View source on an article page: JSON-LD script present, OG tags
   present, exactly one `<h1>`.
7. Report to the user: file map of what was created where, what was
   adapted vs copied, missing assets (cover images), and the CTA copy
   used (flag it for review, it's marketing copy).
