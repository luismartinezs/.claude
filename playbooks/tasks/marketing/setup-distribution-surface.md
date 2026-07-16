# TASK: Set Up Distribution Surface

## Objective
Make the site legible and reachable to AI crawlers: verify crawler access, emit `llms.txt`, wire FAQPage JSON-LD, ensure accurate sitemap `lastmod`, and set up AI referral tracking.

## Inputs
- Primary: The project (User Input: nothing, or specific requirements)
- Infra: `context/marketing/blog-infra.md` (Required — the real paths; output of `setup-blog-infra`)
- Doctrine: `~/.claude/playbooks/tasks/marketing/_geo-rules.md` (Required — section 5 and section 10)
- Strategy: `context/marketing/{product}/geo-strategy.md` (Required — the analytics tool and measurement targets)
- Rules: `CLAUDE.md` (Required)

## Role & Persona
You are an **SEO/GEO Engineer** who has watched a perfect content strategy produce nothing because a `robots.txt` line blocked the crawler.
You verify. You do not assume a file is correct because it exists, or that a crawler is allowed because nobody deliberately blocked it. Defaults block by accident all the time.
You **check reality over config**. A CDN, a proxy, or a host can override a `robots.txt` that looks perfect in the repo.

## Integration Strategy
- Infra: read `blog-infra.md` for real paths. Never hardcode one.
- GEO rules: section 5 lists the technical surface, section 10 lists the referrers to track. Do not restate them; implement them.
- Strategy: `geo-strategy.md` names the analytics tool and the product surface. If there is no product, `llms.txt` describes the content and the domain, and that is fine.

## Workflow Steps

### 1. Audit Crawler Access First

> **PROTOCOL: Verify Before Building**
> This step is first because it can invalidate every other step. A blocked crawler makes
> the entire content pipeline dead weight, and it is the cheapest possible thing to check.
> 1. Read the project's `robots.txt` (and any host, CDN, or proxy config that can override it).
> 2. Confirm each is allowed: **GPTBot** (OpenAI), **ClaudeBot** (Anthropic), **PerplexityBot**, **Googlebot**, **Bingbot**.
> 3. Watch for the accidental blocks: a blanket `Disallow: /`, a wildcard `User-agent: *` deny, a "block AI scrapers" setting enabled at the CDN, or a hosting default.
> 4. If the site is live, verify against the deployed domain, not just the repo file. The
>    deployed reality is what crawlers see.
> 5. **If there is no live domain yet** (a pre-launch product, which the pipeline explicitly
>    supports), you cannot audit deployed reality. Do not fail. Do the repo-level checks now
>    and **park** every live-domain check: mark each `deferred (no live domain)` in the
>    report, record "live-domain audit deferred until deploy" in `context/MEMORY.md`, and
>    treat the task as complete-with-deferrals. Re-run only the live half at deploy.
> 6. Report findings before changing anything. A deliberate block is a business decision
>    and it is not yours to reverse. Ask.

### 2. Emit `llms.txt`

A Markdown file at the domain root summarising what this site is and covers.

Honest framing: no major AI platform has confirmed reading `llms.txt`. Over 844,000 sites publish one. It is cheap and forward-looking, not a ranking lever. Build it, do not oversell it.

Contents:
- One-line description of the site
- What it does or offers (from `geo-strategy.md`; if there is no product, describe the content)
- What the blog covers, by cluster
- Key links (homepage, blog, and anything else real)

It must be served at `/llms.txt` as `text/plain` or `text/markdown`, and must not 404. Verify by fetching it after build.

### 3. Wire FAQPage JSON-LD

Per GEO rules section 5, FAQPage is the highest-citation schema type and FAQ prose without it is structurally invisible.

- If `setup-blog-infra` already wired it, verify it emits valid JSON-LD on a real article and stop.
- If not, wire it now, sourcing from whatever `blog-infra.md` declares (frontmatter `faq` field preferred over parsing prose headings, which is brittle).
- Validate the output against a schema validator. Malformed JSON-LD is worse than none: it can invalidate the whole block.

### 4. Verify Sitemap `lastmod`

- Confirm the sitemap includes every published article and excludes drafts.
- Confirm `<lastmod>` reflects `updatedAt` when present and `publishedAt` otherwise.
- A `lastmod` that lies (for example, every page stamped with the build time) is worse than
  none: it destroys the freshness signal that AI crawlers use to prioritise, and recency is
  a top-three ranking signal.

### 5. Set Up AI Referral Tracking

Using the analytics tool named in `geo-strategy.md`, track the referrers listed in
GEO rules section 10: `chatgpt.com`, `chat.openai.com`, `perplexity.ai`,
`gemini.google.com`, `claude.ai`, `copilot.microsoft.com`.

If the tool cannot segment referrers, say so and name what would be needed. Do not add a
dependency to solve this without asking.

### 6. Verify End to End

> **STEP: Adversarial Validation**
> Build the site and check the real output, not the source.
> 1. `/robots.txt` resolves and allows all five crawlers.
> 2. `/llms.txt` resolves and does not 404.
> 3. A built article contains valid BlogPosting JSON-LD.
> 4. An article with FAQ content contains valid FAQPage JSON-LD.
> 5. The sitemap contains real articles, excludes drafts, and has plausible per-page `lastmod` values.
> 6. Typecheck and build pass clean.
> Report each as pass or fail with the evidence. "It should work" is not a result.

### 7. Record
Update `context/MEMORY.md` with what was wired and any host-level constraint discovered (a CDN AI-blocking toggle is exactly the kind of thing that silently reverts on a config change).

## Constraints (Local Rules)
- **Audit before building.** Crawler access first. Everything else is worthless if it fails.
- **Never unblock a deliberate block.** If a crawler is blocked on purpose, that is the user's call. Report and ask.
- **Read paths from `blog-infra.md`.** Hardcode nothing.
- **Verify against the built output**, and against the live domain when there is one. Not against source files.
- **No new dependencies** without explicit approval.
- **Static only.** No adapter, no `output: 'server'`, no `prerender = false`.
- **Do not oversell `llms.txt`.** Unconfirmed by every major platform. Cheap insurance, not a lever.

## Definition of Done

### Output Structure

**1.** `robots.txt` verified (and corrected only with permission).
**2.** `llms.txt` at the domain root, resolving.
**3.** FAQPage JSON-LD emitting and validating.
**4.** Sitemap with accurate per-page `lastmod`.
**5.** AI referral tracking configured, or a clear statement of what blocks it.

**6.** A verification report:

```markdown
# Distribution Surface Report — {YYYY-MM-DD}

## Crawler Access
| Crawler | Allowed | Verified against |
|---|---|---|
| GPTBot | yes/no | repo / live domain |
| ClaudeBot | | |
| PerplexityBot | | |
| Googlebot | | |
| Bingbot | | |

{Any host/CDN-level override discovered.}

## Surface
| Item | Status | Evidence |
|---|---|---|
| /llms.txt | pass/fail | {fetched, N bytes} |
| BlogPosting JSON-LD | pass/fail | {article checked} |
| FAQPage JSON-LD | pass/fail | {article checked, validator result} |
| Sitemap lastmod | pass/fail | {N articles, drafts excluded, dates vary} |
| AI referral tracking | pass/fail | {tool, referrers configured} |

## Blocked / Deferred
{Anything not done, and why.}
```

### Quality Checklist
- [ ] Crawler access audited before any other work
- [ ] All five crawlers verified, against the live domain if the site is deployed; live checks parked as `deferred` (not failed) if there is no live domain yet
- [ ] If pre-launch: deferrals recorded in `context/MEMORY.md`; task treated as complete-with-deferrals
- [ ] Host/CDN-level AI blocking checked, not just `robots.txt`
- [ ] No deliberate block reversed without asking
- [ ] `llms.txt` emitted and verified to resolve, not 404
- [ ] `llms.txt` describes content honestly, works with zero products
- [ ] FAQPage JSON-LD emits and validates against a schema validator
- [ ] Sitemap includes published articles, excludes drafts, `lastmod` varies per page and reflects real dates
- [ ] AI referral tracking configured, or blockers named
- [ ] All paths read from `blog-infra.md`, none hardcoded
- [ ] Verification run against built output with pass/fail evidence per item
- [ ] Typecheck and build pass clean
- [ ] Zero new dependencies (or explicitly approved)
- [ ] `context/MEMORY.md` updated

---
USER INPUT:
[Any specific requirements, or leave blank for the default surface]
