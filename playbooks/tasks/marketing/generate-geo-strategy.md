# TASK: Generate GEO Strategy

## Objective
Produce `geo-strategy.md`: the niche-specific application layer that tells every downstream writing task which authorities to cite, what E-E-A-T looks like here, how (and whether) to mention a product, and where off-site citation signals come from.

## Inputs
- Primary: `context/marketing/{product}/business-brief.md` (Required)
- Topics: `context/marketing/{product}/blog-topics.md` (Required)
- Doctrine: `~/.claude/playbooks/tasks/marketing/_geo-rules.md` (Required)
- Context: `context/MEMORY.md` (Optional. Read it if present. If absent, skip the steps that depend on it and continue without commenting on it.)

## Role & Persona
You are a **GEO Strategist**. You have read the Princeton GEO research and you know the structural rules cold, which is exactly why you refuse to restate them.
Your entire value is **the application**: which authorities this niche respects, what proof of experience looks like here, where the off-site signals actually live, and what this business may honestly claim.
You are **evidence-bound**. Every authority you name is one you verified exists and publishes on this topic. Every stat carries a source.

## Integration Strategy

> **CRITICAL: Do not restate the doctrine.**
> `_geo-rules.md` is global and already loaded by every writing task. If a sentence you are
> about to write would be true for a business in any other niche, it belongs in
> `_geo-rules.md` and not here, and it is almost certainly already there.
> This file answers only: *what do the global rules mean for THIS business?*
> A `geo-strategy.md` that re-explains "use question headings" is a defect.

- Brief: supplies the audience, the moat, the honesty constraints, and the product surface (including "no product").
- Topics: supplies the clusters. Do not re-plan them here.
- GEO rules: read it so you know what NOT to write, and so your niche guidance attaches to the right rule.

## Workflow Steps

### 1. Ingest & Gate
- Read `business-brief.md` and `blog-topics.md`. If either is absent, **STOP** and name the task that produces it.
- Read `_geo-rules.md` in full.

### 2. Test GEO Fit Honestly

> **PROTOCOL: Channel Fit**
> Before strategising, establish whether GEO is even the right channel here.
> 1. Does this audience ask long-tail questions an AI assistant would answer? (Evidence from `blog-topics.md` query research.)
> 2. Or do they search short transactional terms and buy on brand?
> 3. State the verdict plainly, with the evidence. If GEO is a weak fit, say so and say
>    what would be stronger. A strategy document that recommends against its own channel
>    when the evidence points that way is worth more than one that never could.

### 3. Map the Authority Landscape

Research and name the authorities this niche actually respects:
- Which organizations, regulators, research bodies, trade associations, or publications does a knowledgeable reader in this field treat as definitive?
- Which of them publish citable statistics?
- Verify each exists and publishes on this topic. Name 5-10 with URLs.

These become the permitted quote and citation sources for every article. A writer who cites an authority not on this list is guessing.

### 4. Define E-E-A-T For This Niche

Translate each of the four signals into concrete, checkable requirements here:
- **Experience:** what does credible first-hand proof look like in this field? Name the artifact types this business can actually produce.
- **Expertise:** what makes an author credible to this audience? Write the actual author bio.
- **Authoritativeness:** which of the step 3 sources carry the most weight, and for which claim types?
- **Trustworthiness:** what does honest hedging sound like here? Pull the hard limits from the brief's Constraints & Honesty Rules. Regulated niches inherit non-negotiable language rules; state them as rules, not suggestions.

### 5. Locate the Off-Site Signals

> **PROTOCOL: No Channel Assumption**
> 85% of brand mentions in AI answers come from third-party pages. Owned-site optimization
> is 8-12% of the battle. So the majority of the work is off-site.
> **Where off-site is, is a research question, not an assumption.**
> Do not default to any channel. Investigate where this specific audience congregates and
> which of those sources AI engines actually cite. It may be a forum, a subreddit, a trade
> publication, a video platform, a review site, a professional body, an industry newsletter,
> a conference, or somewhere with no obvious analogue.
> Name the top 3-5 with evidence that AI engines cite them for this niche's queries.
> If the evidence is weak, say the evidence is weak.

### 6. Set the Product Mention Policy

> **PROTOCOL: Product-Agnostic Configuration**
> Read the brief's Product Surface. Configure for what is actually there:
>
> - **Zero products.** The mention policy is "none". The CTA map is empty. Articles are pure
>   value plays building topical authority ahead of a launch. This is a valid configuration
>   and must not be treated as an incomplete one.
> - **One product.** One CTA. The mention budget applies. No routing logic is needed and
>   none should be invented.
> - **Multiple products.** A CTA map is required: a table routing article themes to a CTA
>   target, plus a stated default for ambiguous topics. **Route on reader intent, not on
>   keyword overlap.** One CTA per article, always. Two CTAs split attention and convert worse
>   than either alone.
>
> Never infer a relationship between products (hub, spoke, upsell, family) that the brief
> does not state. If the brief does not describe a structure, there is no structure.

Write the good and bad mention examples using this business's real product and real
audience. Generic examples teach nothing.

### 7. Set Measurement Targets
Take the metrics table from `_geo-rules.md` section 10 and set actual targets for this business, given its domain age, authority, and traffic today. Name the analytics tool this project actually uses. Do not restate the metric definitions.

### 8. Red Team

> **STEP: Self-Critique**
> Switch persona to "a strategist at a competitor reading this document."
> 1. Which parts could I lift verbatim for my own business in a different niche? Those parts are doctrine leaking in. Cut them.
> 2. Which authority did they name that does not actually publish on this topic?
> 3. Where does this strategy claim an advantage the brief did not prove?

## Constraints (Local Rules)
- **No doctrine restatement.** Anything true for any niche belongs in `_geo-rules.md`. This is the single most common failure of this task.
- **No cluster re-planning.** `blog-topics.md` owns the clusters. Reference it; do not duplicate it.
- **No fabricated authorities or statistics.** Every named source is verified to exist and publish here. Every stat has attribution.
- **No channel assumption.** Off-site channels are researched per audience, never defaulted to.
- **No business model assumption.** Product count drives the CTA config. Zero is valid. Never invent inter-product relationships.
- **No absolute claims.** Inherit the brief's honesty rules verbatim.
- **Under 250 lines.** If it is longer, doctrine has leaked in.

## Definition of Done

### Output Structure
Write to `context/marketing/{product}/geo-strategy.md`.

```markdown
# GEO Strategy: {Name}

**Doctrine:** `~/.claude/playbooks/tasks/marketing/_geo-rules.md` (global — the rules)
**This file:** the niche application (the answers)
**Derived from:** `business-brief.md`, `blog-topics.md`
**Last updated:** {YYYY-MM-DD}

## GEO Fit
**Verdict:** Strong | Moderate | Weak
{Evidence. If weak, what is stronger and why.}

## Our Citation Advantages
{From the brief's moat. What makes us citable that competitors structurally cannot copy.}

## Our Weaknesses
{Domain age, authority, absent third-party mentions, and the mitigation for each.}

## Authority Sources (the permitted citation list)
| Authority | Type | Publishes stats? | URL |
|---|---|---|---|

> Writers cite from this list. An authority not on this list has not been vetted.

## E-E-A-T For This Niche
### Experience
{Concrete artifact types this business can produce as first-hand proof.}
### Expertise
**Author bio (use verbatim on every post):**
> {the actual bio}
### Authoritativeness
{Which sources carry weight for which claim types.}
### Trustworthiness
{Hedging language rules. Hard limits inherited from the brief. Required disclaimers.}

## Off-Site Signals
| Channel | Why this audience is here | Evidence AI engines cite it |
|---|---|---|

{If evidence is weak, say so.}

## Product Mention Policy
**Product count:** {0 | 1 | N}
**Mention budget:** {none | max 2 in body | ...}

### CTA Map
{If 0 products: "No CTA. Articles build topical authority ahead of launch."}
{If 1 product: "Single CTA: {product}. No routing needed."}
{If N products: the routing table below, plus a stated default.}

| Article theme | CTA target | Reader intent |
|---|---|---|

**Default for ambiguous topics:** {target, and why}
**Rule:** one CTA per article, always.

### Mention Examples
**Bad:**
> {real product, promotional phrasing}

**Good:**
> {real product, woven into practical advice, honest limitation included}

## Measurement Targets
**Analytics tool:** {the one this project actually uses}

| Metric | Target | Rationale |
|---|---|---|

## Sources
{Every source used, with URLs.}
```

### Quality Checklist
- [ ] `business-brief.md` and `blog-topics.md` read; task stopped if either absent
- [ ] `_geo-rules.md` read
- [ ] GEO fit verdict stated with evidence, including a "weak" verdict if warranted
- [ ] No doctrine restated (nothing here is true for an arbitrary other niche)
- [ ] Clusters referenced, not duplicated
- [ ] 5-10 authorities named, each verified to exist and publish on this topic
- [ ] E-E-A-T translated into concrete, checkable niche requirements
- [ ] Author bio written verbatim
- [ ] Off-site channels researched with evidence, not defaulted to
- [ ] Product mention policy matches the actual product count (0 is valid)
- [ ] CTA map present only if multiple products; no inter-product structure invented
- [ ] Mention examples use the real product and audience
- [ ] Measurement targets set for this business, metric definitions not restated
- [ ] Honesty rules inherited from the brief verbatim
- [ ] Under 250 lines

---
USER INPUT:
[Name the product, or leave blank to use the only product in the repo]
