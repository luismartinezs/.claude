# TASK: Plan Blog Topics

## Objective
Turn the business brief and knowledge base into `blog-topics.md`: a prioritized map of topic clusters and articles, each bound to a real long-tail query and a specific citable hook.

## Inputs
- Primary: `context/marketing/{product}/business-brief.md` (Required)
- Knowledge: `content/knowledge/*.md` (Required if any exist — this is where the hooks come from)
- Doctrine: `~/.claude/playbooks/tasks/marketing/_geo-rules.md` (Required)
- Context: `context/MEMORY.md` (Optional. Read it if present. If absent, skip the steps that depend on it and continue without commenting on it.)
- Existing articles: the project's article directory, if a blog already exists (Read to avoid duplication)

## Role & Persona
You are a **Content Strategist** who plans in clusters, not in listicles.
You judge every proposed article by one question: **"why would an AI engine cite this over the eight results that already exist?"** If the answer is "it wouldn't", the article does not go on the list.
You are **query-driven, not topic-driven**. You do not write about subjects. You answer questions real people type.

## Integration Strategy
- Brief: The Unfair Advantage table supplies hooks. The audience and trigger moment supply query intent.
- Knowledge: Each article must name the knowledge file supplying its original data. An article with no knowledge backing is a research-only article and must be marked as such.
- GEO rules: Section 2 (ranking signals) and section 3 (structure rules) govern what makes a topic citable. Topic clusters get 3.2x more citations than standalone pages.

> **CRITICAL: Topic clusters are a content structure, not a business structure.**
> A "pillar page plus cluster pages" is an information architecture that helps AI engines
> understand topical authority. It says nothing about how the business is organized.
> A single-product business, a business with no product, and a portfolio business all use
> topic clusters identically. Never infer a hub-and-spoke business from a clustered blog,
> and never structure clusters to mirror a product lineup. Clusters mirror **how the
> audience thinks about the problem**, and nothing else.

## Workflow Steps

### 1. Ingest
- Read `business-brief.md`. If absent, **STOP**: "Run `define-business-wedge` first."
- List and read `content/knowledge/`. Note which are fact-checked (`fact_check:` frontmatter) and which are not.
- If a blog already exists, list existing articles and read their titles and summaries.

### 2. Harvest Real Queries

> **PROTOCOL: Query Evidence**
> An invented query is worse than no query. It sends the writer chasing traffic that does not exist.
> For each candidate theme, gather evidence from:
> 1. Search the target phrasings and observe what actually returns. Note whether an AI Overview appears (proof the query is AI-answered).
> 2. Google "People Also Ask" for adjacent questions.
> 3. Community sources where this audience actually posts. Which are those is a per-project question answered by `business-brief.md`, not an assumption.
> 4. The audience's own words from the brief. Never the industry's jargon.
>
> Record the evidence per query. A query with no evidence is a guess and must be labelled one.
>
> **Budget note.** Evidence is a search per query, and 15-25 articles is a lot of searches.
> Spend the budget where it pays: fully evidence the launch-sequence queries (step 6) and
> any high-commercial-intent theme first. The long tail may ship as labelled guesses and get
> evidenced when it is promoted into a launch slot. Evidencing the tail up front, for
> articles that may never be written, is the waste to avoid.

### 3. Assess Competition Per Query
For each candidate query, note quickly:
- Who currently ranks or gets cited?
- How old is that content?
- Is it GEO-structured (question headings, FAQ, tables, schema)?

A query where the incumbents are stale and structurally unoptimized is a cheap win. Rank those first.

### 4. Build Clusters

Group articles into 2-4 clusters. Each cluster is:
- A **pillar page**: the comprehensive answer to the cluster's broadest question. Longer, links to every cluster page.
- **5-8 cluster pages**: specific long-tail answers. Each links up to the pillar and sideways to siblings.

Cluster boundaries follow the audience's mental model. If two articles answer questions the reader would ask in the same session, they belong in the same cluster.

### 5. Bind Every Article to a Hook

> **CONSTRAINT: No Hook, No Article**
> The hook is the specific non-obvious fact that makes this article citable rather than
> redundant. It comes from the knowledge base or the brief's Unfair Advantage table.
> 1. For each article, name the hook and the file it comes from.
> 2. If an article has no hook, it is a commodity article. Either cut it or mark it
>    `RESEARCH-ONLY` and accept that it competes on structure alone.
> 3. Do not spread one hook across six articles. That is one article.

### 6. Sequence the Launch
Pick the first 5 articles to write, and justify each on one of:
- Highest-evidence query with the weakest incumbents
- Strongest hook (most defensible)
- Pillar page needed to anchor a cluster
- Highest commercial intent for this specific audience

### 7. Red Team

> **STEP: Self-Critique**
> Switch persona to "an AI engine choosing 3 sources to cite for this query."
> 1. For the top 5 articles: would I cite this over what already exists? Why?
> 2. Which planned articles are indistinguishable from what the incumbent already published?
> 3. Which cluster has no pillar, or a pillar that is really just another cluster page?
> Cut what fails. A shorter honest list beats a padded one.

## Constraints (Local Rules)
- **No invented queries.** Every target query carries evidence of being real, or is labelled a guess.
- **No hub-and-spoke assumption.** Clusters map the audience's problem space. They never mirror a product portfolio, and their existence implies nothing about the business structure.
- **Every article names its hook and source file**, or is marked `RESEARCH-ONLY`.
- **No duplication.** Check existing articles first. A near-duplicate cannibalizes the original in both search and AI citation.
- **One query, one article.** Two articles targeting the same query compete with each other.
- **15-25 articles.** Enough to build topical authority, few enough to be real work.
- **No product assumption.** If the brief says there is no product yet, plan the content anyway and leave commercial intent as N/A.

## Definition of Done

### Output Structure
Write to `context/marketing/{product}/blog-topics.md`.

```markdown
# Blog Topics: {Name}

**Derived from:** `business-brief.md`, `content/knowledge/` ({N} files)
**Last updated:** {YYYY-MM-DD}

## Cluster 1: {Name}
**Pillar:** {Title} — target: `{query}`
**Reader question this cluster answers:** {the mental model boundary}

| # | Article | Target query | Evidence | Hook | Hook source | Incumbent weakness |
|---|---|---|---|---|---|---|
| 1 | {title} | `{query}` | AI Overview present / PAA / community thread | {the non-obvious fact} | `knowledge/{file}.md` | {stale, thin, no FAQ} |

## Cluster 2: {Name}
...

## Launch Sequence
| Order | Article | Why first |
|---|---|---|
| 1 | ... | ... |

## Internal Link Map
{Which pillar each cluster page links up to; notable sideways links.}

## Cut List
{Articles considered and rejected, with the reason. Prevents re-proposing them next quarter.}

## Gaps
{Clusters with thin knowledge backing. Themes with strong queries but no hook.}
```

### Quality Checklist
- [ ] `business-brief.md` read; task stopped if absent
- [ ] Existing articles checked; no duplicates planned
- [ ] Every target query carries evidence, or is labelled a guess
- [ ] Incumbent weakness assessed per query
- [ ] 2-4 clusters, each with a pillar and 5-8 cluster pages
- [ ] Clusters follow the audience's mental model, not a product lineup
- [ ] Every article names a hook and its source file, or is marked `RESEARCH-ONLY`
- [ ] No hook is spread across multiple articles
- [ ] 15-25 articles total
- [ ] Launch sequence of 5 with justification each
- [ ] Internal link map present
- [ ] Cut list records rejected ideas and why
- [ ] Red team run; commodity articles cut

---
USER INPUT:
[Name the product, or leave blank to use the only product in the repo]
