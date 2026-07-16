# Workflow: GEO Pipeline (Bootstrap)

## Starting State
A business or product exists, in any state from "an idea with a spec" to "shipped and selling". It has no content strategy, no knowledge base, and possibly no blog.

## End State
The project has a knowledge base, a topic map, a niche GEO strategy, a build-validated blog, and a distribution surface wired in the repo (crawler-reachable once live; the live-domain audit parks until deploy for a pre-launch product). Every subsequent article is then produced by the `create-blog-post` workflow, which is a different workflow and runs many times.

**Run this once per product.** Do not re-run it per article.

## Tools Discovered
- Doctrine: `~/.claude/playbooks/tasks/marketing/_geo-rules.md` (global, static, read by most steps)
- Tasks: `marketing/define-business-wedge`, `marketing/plan-research`, `research/research-topic`, `marketing/fact-check-content`, `marketing/plan-blog-topics`, `marketing/generate-geo-strategy`, `marketing/setup-blog-infra`, `marketing/setup-distribution-surface`
- Scripts: the project's typecheck and build
- Gaps: none. Step 3 fans out over N topics and is the only step with a variable run count.

## The Split
This pipeline separates **rules** from **application**, the same way the playbooks library
separates framework from project:

| Layer | Lives in | Scope |
|---|---|---|
| GEO doctrine | `~/.claude/playbooks/tasks/marketing/_geo-rules.md` | Global. Never copied into a project. |
| Niche application | `context/marketing/{product}/geo-strategy.md` | Per product. |
| Content surface | `context/marketing/blog-infra.md` | Per repo. |
| Knowledge | `content/knowledge/*.md` | Per repo, shared across products. |

**No step assumes a business model.** Product count is read, never assumed. Zero products is
a valid configuration and produces a valid pipeline. Nothing here assumes hub-and-spoke, a
portfolio, B2C, SaaS, or any go-to-market. If a step's output implies a structure the
business brief did not state, that step has failed.

## Invariants
- **The trust chain is interruption-safe by design: unstamped means unchecked.** Step 3 can
  be killed mid-sweep with zero corrupted state, because a file is trusted only through its
  `fact_check:` stamp, never through in-progress state. A half-verified file is just an
  unstamped file, re-checked or triaged later with no forensics. This is a deliberate
  property, not luck. Preserve it: never add a "verifying" or partial-credit state.
- **Verification is upstream of strategy, always: 3 → 5, never the reverse.** The authority
  list in `geo-strategy.md` is harvested from what step 3 verified. Step 3 therefore runs
  external-only, and must not wait on a strategy that does not exist yet.
- **A pre-launch product parks step 7 rather than failing it.** "Done" tolerates a deferred
  live-domain audit. See step 7.

## Steps

1. **Define the Business Wedge**
   - Input: the product name, or "the whole repo"
   - Task: `playbooks/tasks/marketing/define-business-wedge.md`
   - Output: `context/marketing/{product}/business-brief.md`
   - Note: mines existing specs, READMEs, and landing copy **before** interviewing. Asking what a repo file already answers is a defect.
   - Gate: the user confirms the brief, especially the Unfair Advantage table. Everything downstream inherits it.
   - Skip condition: a current, confirmed `business-brief.md` already exists.

2. **Plan the Research**
   - Input: `business-brief.md`
   - Task: `playbooks/tasks/marketing/plan-research.md`
   - Output: `context/marketing/{product}/research-plan.md` (8-15 scoped topics with a dependency order)
   - Gate: the user approves the topic list before research burns hours. This is the cheapest place to cut a bad topic.
   - Note: the dependency order is load-bearing. Step 3b consumes it and cannot function without it.

3. **Build the Knowledge Base** (fan-out, then verify, in dependency order)

   For each topic in `research-plan.md`, **in the plan's dependency order** (Level 0 first):

   3a. **Research the topic**
     - Task: `playbooks/tasks/research/research-topic.md`
     - Output: `content/knowledge/{filename}.md` (unverified)

   3b. **Fact-check it**
     - Task: `playbooks/tasks/marketing/fact-check-content.md`
     - Output: same file, corrected and stamped with `fact_check:` frontmatter
     - Constraint: **verify bottom-up.** A Level 1 file cannot be verified before the Level 0 file it depends on. Verifying out of order silently poisons the trust chain, and the metadata then certifies nothing.
     - **Tier: `triage`.** These are internal knowledge files verified in bulk. Run `fact-check-content` in its `triage` tier (load-bearing claims verified fully; attributed, hedged claims accepted on the source's authority), recorded in each `fact_check.tier`. Full per-claim external verification here, on top of the research pass, is what blows a token budget twice. A file gets escalated to `full` only when an article is about to quote it.
     - **This always runs in bootstrap mode.** `fact-check-content` lists `geo-strategy.md` as an input for its authority list, but that file is produced in step 5, after this. So on a bootstrap run there is no authority list yet, and that is correct, not a gap: verification draws on primary sources directly, and step 5 then *harvests the sources you verified here* into the authority list. The dependency runs 3 → 5, never the reverse. Do not let a fact-check STOP for a missing `geo-strategy.md`.

   - Note: topics at the same level are independent and can run in any order.
   - Gate: all P1 topics researched and verified before step 4. P2 and P3 may lag.

4. **Plan the Topics**
   - Input: `business-brief.md` + `content/knowledge/*.md`
   - Task: `playbooks/tasks/marketing/plan-blog-topics.md`
   - Output: `context/marketing/{product}/blog-topics.md` (2-4 clusters, 15-25 articles, each bound to a real query and a hook)
   - Note: topic clusters are a **content** structure. They mirror how the audience thinks about the problem, never a product lineup, and they imply nothing about the business's structure.
   - Gate: the user approves the launch sequence.

5. **Generate the GEO Strategy**
   - Input: `business-brief.md` + `blog-topics.md` + `_geo-rules.md`
   - Task: `playbooks/tasks/marketing/generate-geo-strategy.md`
   - Output: `context/marketing/{product}/geo-strategy.md` (authority list, niche E-E-A-T, off-site signals, product mention policy, CTA map, measurement targets)
   - Note: runs after step 4 because it needs the query evidence to judge GEO fit honestly. It states a "weak fit" verdict when the evidence says so.
   - Note: the **authority list is harvested here from the sources step 3 already verified.** This is why step 3's fact-checks run external-only: the strategy is downstream of verification, not upstream. If you find yourself wanting the authority list during step 3, that is the circular-dependency smell — resolve it by deriving the list here, from what verification actually cited.
   - Note: this file must contain nothing true of an arbitrary other niche. Doctrine leaking in here is this step's characteristic failure.

6. **Set Up the Blog Infrastructure**
   - Input: the project
   - Task: `playbooks/tasks/marketing/setup-blog-infra.md`
   - Output: a working static blog + `context/marketing/blog-infra.md`
   - Constraint: static only. No adapter, no `output: 'server'`, no `prerender = false`. No new dependencies.
   - Note: `blog-infra.md` is the surface declaration every downstream task reads instead of hardcoding a path. It is written from the code and verified by reading the code back.
   - Gate: typecheck and build pass; each authoring error class adversarially verified to fail the build.
   - Independence: steps 6 and 7 do not depend on steps 1-5 and can run earlier if you want the blog standing before the strategy is settled.

7. **Set Up the Distribution Surface**
   - Input: `blog-infra.md` + `geo-strategy.md`
   - Task: `playbooks/tasks/marketing/setup-distribution-surface.md`
   - Output: verified crawler access, `llms.txt`, FAQPage JSON-LD, sitemap `lastmod`, AI referral tracking, and a verification report
   - Note: **crawler access is audited first.** A blocked crawler makes steps 1-6 worthless, and it is the cheapest thing in this whole pipeline to check. Verify against the live domain, not just the repo file.
   - Gate: every item passes with evidence from the built output.
   - **Pre-launch parked state.** This step audits the *live* domain, which a not-yet-launched product (a configuration the brief explicitly supports) does not have. That is not a failure and does not block "done." Do the repo-level half now (robots.txt, llms.txt, JSON-LD, sitemap in the built output), then **park the live-domain checks**: record in `context/MEMORY.md` as "distribution surface: live-domain audit deferred until deploy," and mark this step `deferred`, not `failed`. The bootstrap is complete with step 7 parked; re-run only its live-verification half at deploy.

## After Bootstrap

Run `playbooks/workflows/create-blog-post.md` once per article, following the launch
sequence in `blog-topics.md`. That workflow is the repeatable one. This one is done.

## Maintenance
- Content updated within 30 days gets 3.2x more citations; content older than 12 months gets cited 40-60% less. Review published articles monthly and refresh stats. Freshness is not a nice-to-have, it is a top-three ranking signal.
- Re-run step 5 when the product surface changes (a launch, a new product, a pivot). The CTA map and mention policy are derived from product count and go stale silently.
- Re-run step 4 when the knowledge base grows enough to support new clusters.
- Do not re-run step 1 unless the business itself changes.

## Gaps & Recommendations
- Step 3 is the long pole. 8-15 research topics, each a focused session, plus a fact-check pass each. Front-load P1 and start writing once those are verified rather than waiting for P3.
- Steps 6 and 7 are independent of 1-5. Run them in parallel with research if the blog does not exist yet.
- The `{product}` path segment supports repos holding more than one product. A single-product repo still uses its slug, so a second product later costs nothing. Knowledge and blog infra stay shared at the repo level, because they genuinely are.
