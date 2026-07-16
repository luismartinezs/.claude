# GEO Rules (Reference Doctrine)

**What this is:** The project-agnostic rules for structuring content so AI search engines cite it.
**What this is not:** A strategy. This file never mentions a product, a niche, or an audience.

> **The split.** This file holds the *rules* (global, stable, true for any business).
> A project's `geo-strategy.md` holds the *application* (which niche, which authorities,
> which product, which clusters). Tasks read both. Never copy this file into a project.
> Never put niche specifics in this file.

GEO (Generative Engine Optimization) is the practice of structuring web content so AI
search engines cite it when generating answers. The term was formalized by a Princeton
University research paper (KDD 2024).

---

## 1. Why GEO

| Signal | Finding | Source |
|---|---|---|
| AI Overviews reduce organic CTR | -61% | Ahrefs |
| Being cited *in* an AI Overview | +35% CTR | Seer Interactive |
| AI referral traffic growth (Jan-May 2025, 400+ sites) | +527% | Superprompt |
| AI-referred conversion vs Google organic | 15.9% (ChatGPT), 10.5% (Perplexity) vs 1.76% | Superprompt |
| AI-referred engagement | 23% less bounce, 12% more pages, 41% longer | SE Ranking |

The asymmetry is the point. Traditional results get crushed, and the few cited sources
win bigger. Nearly half of brands have no GEO strategy, so the first-mover window is open.

**Applicability test.** GEO pays off when the audience asks detailed, long-tail questions
that an AI assistant is well suited to answer. If the audience searches with short
transactional terms and buys on brand recognition, GEO is a weaker channel. State this
honestly in `geo-strategy.md` rather than assuming every business benefits.

---

## 2. How AI Engines Choose What to Cite

AI engines cite 2-7 domains per response, versus 10 traditional search results.

### Platform preferences

| Platform | Favors | Top cited sources |
|---|---|---|
| ChatGPT | Encyclopedic authority, 2000+ word guides, clear sections | Wikipedia (47.9% of top-10), Reddit (11.3%), Forbes |
| Google AI Overviews | Established domains, distributed sourcing | Reddit (21%), YouTube (18.8%), Quora (14.3%) |
| Perplexity | Community-driven content, recency | Reddit (46.7% of top-10), YouTube (13.9%), Yelp |
| Claude | Technical accuracy, ethical considerations, Tier 1 data | McKinsey, Statista, Britannica, Pew |

### Universal ranking signals

1. **Domain authority.** 50+ referring domains correlates with 5x more AI traffic.
2. **Recency.** Updated within 30 days gets 3.2x more citations. Older than 12 months gets cited 40-60% less.
3. **Structured data.** Schema markup yields a 28% citation increase.
4. **Direct answer formatting.** Leading with the answer yields 67% more citations.
5. **Statistics and data tables.** 4.1x more citations than content without data.
6. **Original research and first-person experience.** 30-40% higher visibility (Princeton).
7. **Third-party mentions.** 85% of brand mentions in AI answers come from third-party pages, not owned domains.

Signal 7 is the one most often missed: **owned-site optimization is roughly 8-12% of the
battle.** Where the rest comes from is a per-project question, answered in `geo-strategy.md`,
not here. It is never assumed to be any specific channel.

---

## 3. Content Structure Rules

Every post follows these eight rules.

### Rule 1: Answer first, always
The top GEO mistake is burying the answer. AI engines extract the first comprehensive
answer they find. An answer in paragraph 4 is a loss. A **1-2 sentence hook may precede the
answer** (a concrete, relatable scenario earns the human read), but the direct answer itself
must land within roughly the first 90 words, then supporting detail, then extractable
bullets. Target a 40-60 word answer. If the hook runs long, the TL;DR (Rule 6) is the
guaranteed extractable block. Hook plus answer both live up top; a hook that pushes the
answer past ~90 words has become a preamble, which is the mistake this rule names.

### Rule 2: Question-based headings
Phrase every H2 and H3 as a question matching how people query assistants.
"Thailand Overview" is dead weight. "What Are the Most Common Hidden Allergens in Thai
Food?" is extractable. (The example is illustrative only. Use the project's own niche.)

### Rule 3: 120-180 word sections
Pages with 120-180 words between headings get 70% more ChatGPT citations than pages with
sections under 50 words (Princeton). Under 50 words, AI skips it. Over 300, the answer is
buried in noise. Each section is a self-contained answer to its heading.

### Rule 4: Statistics every 150-200 words
Sourced statistics increase citation probability by 37%; citations and stats lift AI
visibility 30-40%. Format: "According to [authority], [specific stat]."

### Rule 5: FAQ section on every post
FAQ has the highest citation rate of all structured data types. Pages with FAQPage markup
are 3.2x more likely to appear in Google AI Overviews (Frase.io). End every post with 4-6
questions, each answered in 120-180 words.

### Rule 6: TL;DR at the top
A 40-60 word summary immediately after the intro. This is a clean, extractable block.

### Rule 7: Data tables
Tables yield 4.1x more citations than narrative. Anything expressible as rows and columns
becomes a table.

### Rule 8: Inline expert quotes
Quotations from credible sources boosted AI visibility by 40% (Princeton). Quote real
authorities named in `geo-strategy.md`. Never invent a quote, a study, or an organization.

---

## 4. E-E-A-T Signals

AI engines weight Experience, Expertise, Authoritativeness, Trustworthiness. Anonymous
content is a penalty.

- **Experience:** first-person proof. "When I did X" beats "One should do X." Real artifacts (screenshots, photos) beat stock.
- **Expertise:** named author byline with a bio establishing why this author knows this. Correct use of domain terminology.
- **Authoritativeness:** cite the authorities named in `geo-strategy.md`. Link out to primary sources, not aggregators. Show "Last updated."
- **Trustworthiness:** honest hedging over absolutes. Consistent facts across the whole domain (AI cross-checks). Disclaimers where the topic warrants.

Which authorities count, and what "experience" looks like, is per-niche. It belongs in
`geo-strategy.md`.

---

## 5. Technical Surface

- **BlogPosting JSON-LD** on every article.
- **FAQPage JSON-LD** on every article with an FAQ. Highest-citation schema type. FAQ prose without FAQPage markup is structurally invisible to AI retrieval.
- **HowTo JSON-LD** for guide-format posts.
- **`/llms.txt`** at the domain root: a Markdown summary of what the site is and what it covers. Over 844,000 sites implement it. No major platform has confirmed reading it. Low cost, forward-looking, not a priority over the eight structure rules.
- **AI crawler access** in `robots.txt`: GPTBot (OpenAI), ClaudeBot (Anthropic), PerplexityBot, Googlebot, Bingbot. A blocked crawler makes every other rule moot.
- **Sitemap `<lastmod>`** accurate per post. Crawlers use it to prioritize fresh content.
- **OpenGraph** article metadata, `datePublished`, `dateModified`, breadcrumbs.

---

## 6. Blog Post Template

```markdown
[Hook: 1-2 sentences. A concrete scenario the reader has lived. Not a statistic.]

[Direct answer: 40-60 words, landing within the first ~90 words of the post.]

**TL;DR:** [40-60 word summary of key takeaways]

## [Question-based H2: the core problem]
[120-180 words. Sourced statistics. Specific data.]

## [Question-based H2: detailed answer]
[120-180 words. Data table where applicable. Domain terminology.]

### [Question-based H3: sub-topic]
[120-180 words]

## [Question-based H2: practical steps]
[Numbered or bulleted. Specific and actionable.]

## Frequently Asked Questions

### [Follow-up question 1]?
[120-180 word answer]

[...4-6 questions total...]
```

Frontmatter is project-specific. Read the project's `context/marketing/blog-infra.md`
for the real schema. Never guess frontmatter fields.

---

## 7. Writing Checklist

### Structure
- [ ] Title is a question or targets a specific long-tail query
- [ ] Direct answer lands within the first ~90 words (a ≤2-sentence hook may precede it)
- [ ] TL;DR within the first 150 words
- [ ] All H2/H3 headings are question-based
- [ ] Sections are 120-180 words (none under 80, none over 200)
- [ ] At least one data table
- [ ] FAQ with 4-6 questions
- [ ] Word count 1,500-2,500

### Authority
- [ ] A sourced statistic every 150-200 words
- [ ] At least one expert quote from an authority named in `geo-strategy.md`
- [ ] At least one first-person experience passage
- [ ] Links to primary authoritative sources

### E-E-A-T
- [ ] Named author byline with bio
- [ ] "Last updated" visible
- [ ] No absolute claims where the topic warrants hedging
- [ ] Disclaimer present if the niche warrants one

### Technical
- [ ] BlogPosting JSON-LD
- [ ] FAQPage JSON-LD for the FAQ
- [ ] Meta title under 60 characters
- [ ] Meta description under 160 characters, answers the query
- [ ] Hero image with descriptive alt text
- [ ] Internal links to related articles in the same cluster

### Product mention
- [ ] Respects the mention budget in `geo-strategy.md` (default: max 2 in body)
- [ ] Woven into practical advice, never promotional
- [ ] Never in the opening, TL;DR, title, or FAQ
- [ ] Honest limitations included
- [ ] If the project has no product to mention, this whole block is N/A. That is a valid configuration.

### Freshness
- [ ] `updatedAt` bumped when refreshing
- [ ] Monthly review of published articles for stale stats

---

## 8. Voice Rules

These apply to every word of published copy.

- **No em-dashes.** Use periods, commas, or restructure. Em-dashes are an obvious AI tell.
- **No AI slop.** Banned: "in the fast-paced world", "it's important to note", "comprehensive guide", "dives into", "navigating the landscape", "in today's digital age", "unlock", "delve".
- **No keyword stuffing.** AI engines detect and penalize it.
- **Specificity over abstraction.** Name the thing, the number, the consequence.
- **Contractions and direct address.** "You", not "users". Write like a practitioner typing fast from experience.
- **Human reader wins.** If a GEO rule makes a passage read badly, break the rule and note the deviation. A page humans bounce off does not get cited either.

---

## 9. Common GEO Mistakes

1. **Burying the answer.** Not up top (within ~90 words, after at most a short hook) means skipped.
2. **Anonymous bylines.** "Content Team" or no author is a penalty.
3. **Missing structured data.** FAQ prose without FAQPage schema is invisible.
4. **Stale content.** 12+ months without update means 40-60% fewer citations.
5. **Keyword stuffing.** Detected and penalized.
6. **Only optimizing the site.** Owned-site work is 8-12% of the battle. Off-site signals carry the rest.
7. **Inconsistent information.** AI cross-checks across the domain. Pricing that differs between blog and pricing page destroys trust.
8. **Thin content.** Under 500 words rarely gets cited.
9. **Promotional tone.** Articles reading like landing pages get detected and penalized.
10. **Optimizing for one platform.** Follow the universal rules and you cover all of them.

---

## 10. Measurement

| Metric | Where | Target |
|---|---|---|
| AI referral sessions | Analytics referrer filter | Growth week-over-week |
| AI referral conversion rate | Analytics + payment provider | 10%+ (industry avg for AI traffic) |
| Citation appearances | Manual weekly prompt testing | 1+ platform per published article |
| Blog organic traffic | Analytics | Set per project |
| Time on page (AI referrals) | Analytics | 2+ minutes |
| FAQ rich results | Google Search Console | Track appearances |

**AI referrers to track:** `chatgpt.com`, `chat.openai.com`, `perplexity.ai`,
`gemini.google.com`, `claude.ai`, `copilot.microsoft.com`.

**Manual prompt testing.** Weekly, run each published article's target query as a prompt on
ChatGPT (browse mode), Perplexity, Google (check AI Overview), and Claude. Record: were we
cited, which URL, how were we described, who was cited instead. This is the only direct
measurement of GEO success. Analytics only sees the click-through.

---

## Sources

- Princeton GEO Research Paper (KDD 2024) — arxiv.org/abs/2311.09735
- Ahrefs — "AI Overviews Reduce Clicks"
- Seer Interactive — "AIO Impact on CTR"
- Superprompt — "AI Traffic Up 527%"
- SE Ranking — "AI Traffic Research Study"
- Frase.io — "FAQ Schema for AI Search"
- Profound — "AI Platform Citation Patterns"
- Semrush — "llms.txt"
- BrightEdge — "E-E-A-T for AI Search"
- Wellows — "AI Topic Clusters"
- First Page Sage — "GEO Best Practices"
- Search Engine Land — "Mastering GEO in 2026"
