---
name: port-blog
description: Port a complete static blog (listing, article pages, category pages, SEO, related articles) into an Astro + Vue codebase. Use when asked to add a blog to an Astro-based product. Contains reference implementation, architecture invariants, porting steps, and verification checklist.
---

# port-blog: Static Blog for Astro + Vue Codebases

You are porting a proven blog feature from a reference codebase (SafelyFed)
into the current codebase. The reference code in `reference/` is ONE
instantiation, not literal truth. Adapt names, paths, imports, and styling
to the target codebase's conventions. The invariants below are what must
survive the port; everything else is negotiable.

## What the feature is

A fully static, build-time-rendered blog:

- `/blog/` — listing page: hero, category pill filter bar, card grid
- `/blog/<slug>/` — article page: breadcrumb, category pills, cover image,
  prose body, sticky sidebar (author card + related articles), CTA, JSON-LD
- `/blog/category/<slug>/` — per-category filtered listing
- Articles are markdown files with Zod-validated frontmatter (Astro content
  collection, glob loader)
- Authors and categories are code-side dictionaries, not frontmatter
  free-text. Every article's `author` and `categories` values are resolved
  against those dictionaries at build time and the build THROWS on unknown
  values. Typos cannot ship.
- Draft posts (`draft: true`) and future-dated posts (`publishedAt` in the
  future) are excluded everywhere by the same filter
- Related articles = share at least one category, newest first, max 3
- SEO per article: title/description, OpenGraph `article` type with
  published/modified times + tags, JSON-LD `BlogPosting`
- **Zero client JS is the invariant.** The reference's one exception (a tiny
  inline `<script>` expanding hidden "+N" category pills in the article card)
  is a design behavior, not a feature — port it only alongside the card
  design. In an unstyled port the correct amount of client JS is zero.

## File inventory (reference/)

| File | Role |
|---|---|
| `content-collection.ts` | Content collection definition (Zod schema for frontmatter) |
| `content.ts` | AUTHORS and CATEGORIES dictionaries + their types |
| `blog.logic.ts` | Pure functions: filter, sort, related, category filter, resolve (throwing) |
| `blog.logic.test.ts` | Vitest/bun:test suite for the logic. Port alongside the logic |
| `components/*.astro` | 8 presentational components (see PORTING.md step 5). The decomposition is ONE instantiation — see "File granularity" below |
| `pages/blog-index.astro` | `/blog/` listing page |
| `pages/blog-slug.astro` | `/blog/[slug]` article page |
| `pages/category-slug.astro` | `/blog/category/[slug]` category page |
| `example-article.md` | Annotated frontmatter template |

## Invariants (do not lose these when adapting)

1. **Static only.** Everything renders at build time. No SSR, no adapters,
   no `prerender = false`, no client-side data fetching.
2. **Build-time validation.** `resolveAuthor` / `resolveCategories` throw on
   unknown ids. Keep them throwing. They run inside `getStaticPaths` /
   page frontmatter, so a bad article fails `astro build`, not production.
3. **Single source of publish truth.** `filterPublished` (drafts + future
   dates) is applied in every place articles are listed: index page,
   category pages, related articles, and any landing-page widget. Never
   inline a second filter.
4. **Logic is pure and framework-free.** `blog.logic.ts` imports nothing
   from Astro. It takes plain `{ id, data }` objects. This keeps it unit
   testable without an Astro harness. Keep it that way.
5. **Content model split.** Frontmatter holds per-article data. Authors and
   categories live in TypeScript dictionaries so they are typed, reusable,
   and renamable in one place.
6. **URL shape.** `/blog/`, `/blog/<slug>/`, `/blog/category/<slug>/`. The
   markdown filename is the slug.

## Known adaptation points (things that WILL differ per target)

- **File placement.** Do NOT impose the reference's `modules/blog/` layout.
  Put logic, components, pages, and articles wherever the target codebase
  puts equivalent things. Only `pages/` paths are fixed by Astro routing.
  Fix all imports accordingly.
- **File granularity.** The 8-component decomposition is one instantiation,
  not literal truth. Match the target's file-granularity conventions (some
  codebases mandate fewest-files / one-file-per-slice). Components that
  exist only to carry styling should be inlined or merged when the design
  layer changes or disappears. A single listing component reused by the
  index page, category pages, and related-articles is a legitimate end
  state; so is merging the dictionaries into the logic file.
- **Design fidelity.** Decide this in step 0, before writing any component
  (see PORTING.md). Targets fall into three classes: (a) has a design
  system → translate tokens; (b) raw Tailwind palette → adapt to its
  conventions; (c) deliberately unstyled / bare HTML → port semantics only:
  zero class attributes, semantic HTML elements, no typography plugin, no
  pill expander, CTA as a bare stub link. If the class is ambiguous, ask
  the user before step 5, not after.
- **Layout component.** Reference pages wrap content in a `Layout` with
  `title`, `description`, an optional `seo` override object (astro-seo),
  and a `head` slot for JSON-LD. The target's layout API will differ. Map:
  title/description → however the target sets meta; OpenGraph article
  fields → target's SEO mechanism (or add `astro-seo`); JSON-LD `<script>`
  → the target's head injection point.
- **CTA component** (`article-cta.astro`) is 100% product-specific:
  headline, copy, icon, link, analytics event. Rewrite it for the target
  product. Every blog needs one; the reference only shows the shape
  (icon + h2 + paragraph + primary button on a tinted band).
- **Styling.** Reference uses Tailwind semantic tokens (`primary-*`,
  `neutral-*`). Apply the design-fidelity decision from step 0: translate
  tokens, adapt to raw palette conventions, or strip all styling entirely.
  "The target has no design" is a valid survey answer and means the port
  ships zero classes — do NOT invent a neutral design as a translation.
- **Trailing slashes.** Reference links end in `/` because that codebase
  sets `trailingSlash: 'always'`. Check the target's Astro config and
  match its convention in every href.
- **Icons.** Reference uses `@lucide/astro` (ArrowLeft, ChevronRight,
  ArrowRight + one CTA icon). Use whatever icon system the target has;
  these are trivial to swap.
- **Content dictionaries.** AUTHORS/CATEGORIES entries in `content.ts` are
  the reference product's. Replace with the target product's real authors
  and a category taxonomy that fits its content strategy. Keep the shape.
- **Nav + landing integration.** The reference adds a "Blog" nav link and a
  "From the Blog" 3-card section on the landing page (reusing
  `card-article.astro` + the same filter/sort/resolve functions). Offer
  both to the user; they're optional but high-value for SEO discovery.

## Dependencies

Required in the target (likely already present in an Astro + Tailwind app):

- `astro` >= 5 (Content Layer API: `glob` loader, `render` from `astro:content`)
- `tailwindcss` + `@tailwindcss/typography` — ONLY when porting the styled
  prose body (the article body relies on `prose prose-lg`). In an unstyled
  port (design-fidelity class (c)), "unstyled" is the goal: do not add the
  typography plugin.
- An icon package (reference: `@lucide/astro`) — or HTML entities/inline
  SVG in dependency-averse targets; the reference uses only trivial arrows

Optional but recommended: `@astrojs/sitemap` (article pages get sitemapped
automatically once routes exist), `astro-seo` (or equivalent for OpenGraph).
Do not add dependencies the target already has an equivalent for.

## Process

Follow `PORTING.md` step by step, then run every check in the
Verification section at the bottom of that file. Do not report the port
as done until `astro build` succeeds and the checks pass.
