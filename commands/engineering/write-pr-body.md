---
argument-hint: Optional extra context (ticket, reviewer concerns). Leave empty to infer everything.
description: Turn staged changes + this conversation into ./PR-BODY.md
---

$ARGUMENTS

Write a PR body to `./PR-BODY.md` at the root of the repo the changes belong to.
Overwrite it if it exists.

Sources:
1. `git diff --cached` (fall back to `git diff`, then the most recent commit if both are empty)
2. This conversation, for what the diff cannot show: what you verified, what you skipped

Before writing, run the project's lint/test commands. They gate what you may claim,
but keep the results out of the body unless something fails.

## Shape

Short. Around a dozen lines. A reviewer skims this, then reads the diff.

```
Two or three short sentences: what was wrong, then what you did about it.

# changes
- <effect> in `a.vue`
- Fix Y in `a.vue`, `b.vue`
- Deleted `c.js` as nothing uses it

# screenshots
<label>
(author pastes images here)

# other
- Verified against a production build served locally
```

- **One bullet per change, one sentence.** No second sentence unless it flags the only
  intentional behaviour change in the PR. Group files that got the same fix.
- **Lead with the effect, put the file at the end.** `An FAQ page with no items can no
  longer append null in pages/[slug].vue` beats `pages/[slug].vue now guards on X so that...`
- **Drop the mechanism.** `now uses <NuxtImg> instead of <img>` beats a paragraph on why the
  old one broke. A short `since <reason>` clause is fine when the reviewer cannot judge the
  change without it.
- **Plain, short words.** "put sanity copy in template strings", not "interpolated CMS content
  into string literals". Lowercase acronyms are fine.
- `# screenshots` only if visual: a label per shot, no images. The author pastes those.
- `# other` for what the reviewer must run or know afterwards, one line each. Omit if empty.
- Lowercase headings.

## Cut

Assume anything below gets deleted by the author, so do not write it:

- Counts and measurements. No "4 of 8 inputs", no "across all 10 routes", no lint warning totals.
- Evidence for a claim. `Verified against a production build served locally` is the whole
  sentence. How you verified belongs in chat, not the body.
- Caveats that do not change the decision. Keep one only if the reviewer would otherwise
  approve the wrong thing.
- Suggested follow-up fixes, one-line-fix hints, and pre-existing bugs you left alone.
- Bugs you introduced and fixed mid-session. They are not in the diff.
- Preamble, "this PR aims to", restating the diff, tables.

If something is unverified, say so in one clause with a short reason and stop there:
`converted but not verified because it is unused`.

Never invent a ticket, result or screenshot.

## Reference

The register to hit, from a real merged body:

```
json-ld was created putting sanity copy in template strings. Text with quotes, backslash,
tab, etc would break the schema. So they are now wrapped in JSON.stringify

# changes

- `VideoSlider.vue`, `HeroVideo.vue`, `PricingSteps.vue`, `pages/index.vue` and
  `pages/[slug].vue` now build a plain object and `JSON.stringify` it. Output identical to
  `develop` apart from the one change below.
- `numberOfItems` in `VideoSlider.vue` is now a number instead of `"10"`, matching
  schema.org's Integer type. This is the only intentional output change in the PR.
- An FAQ page with no accordion items can no longer append `null` into `@graph` in
  `pages/[slug].vue`
- Deleted the redundant `.replace(/</g, '\\u003c')` from `PricingChart.vue`, since unhead
  already escapes `<` on `ld+json` script tags.
- `PricingSteps.vue` is converted but not verified because it is unused.

# other

- Verified against a production build served locally
```

Do not commit, push, branch, or open the PR. Write the file and stop.
