---
# Required: title, summary, publishedAt, image, categories, author
# Optional: updatedAt, draft (defaults to false)
# summary max 160 chars (enforced by Zod, doubles as meta description)
# categories: slugs that MUST exist in the CATEGORIES dictionary (build fails otherwise)
# author: id that MUST exist in the AUTHORS dictionary (build fails otherwise)
title: "Example Article Title"
summary: "One or two sentences, max 160 characters. Used as the card teaser, the meta description, and the OpenGraph description."
publishedAt: 2026-03-24
image: "/images/blog/example-cover.webp"
categories:
  - some-category-slug
  - another-category-slug
author: some-author-id
draft: false
---

Intro paragraph. Plain GitHub-flavored markdown. Rendered at build time
through the content collection; styled with Tailwind `prose` classes.

## Sections use h2

Tables, lists, and images all work. Tables get horizontal scroll on
mobile via the `article :global(table)` rule in article-page.astro.

The filename becomes the URL slug: `example-article.md` → `/blog/example-article/`.
