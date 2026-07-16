# Workflow: Create Blog Post

## Starting State
The `bootstrap-geo-content` bootstrap has run. A target topic exists, normally a row in
`blog-topics.md`. The knowledge base, strategy, and blog infrastructure are in place.

## End State
A researched, drafted, audited, fact-checked article sits in the content collection with
`draft: true`, passing the build, ready for the user to publish.

## Tools Discovered
- Doctrine: `~/.claude/playbooks/tasks/marketing/_geo-rules.md`
- Tasks: `marketing/research-blog-brief`, `marketing/draft-blog-post`, `marketing/audit-blog-geo`, `marketing/fact-check-content`, `marketing/publish-blog-post`
- Scripts: the project's typecheck and build; the global cover image generator (`~/.claude/playbooks/scripts/marketing/generate-blog-image.ts`, prompt craft in `marketing/_cover-image-prompts.md`), if `blog-infra.md` declares it. Never hand-build a cover; if the generator is unavailable, publish falls back to the declared placeholder and flags `[NEEDS IMAGE]`.
- Gaps: none.

## Prerequisites
`blog-topics.md`, `geo-strategy.md`, and `blog-infra.md` must exist. If any is missing, run
`playbooks/workflows/bootstrap-geo-content.md` first. Without them, every task below would be
guessing at paths, authorities, and product policy.

Operates in **1 chat**, sequentially. Each step produces a file that feeds the next. All
artifacts live in `context/marketing/{product}/blogposts/{slug}/`.

## Steps

1. **Research the Brief**
   - Input: the target topic or long-tail query
   - Task: `playbooks/tasks/marketing/research-blog-brief.md`
   - Output: `blog-brief.md` (competitive analysis, knowledge data, statistics bank, FAQ candidates, outline)
   - Gate: the task stops on its own if the topic is too broad, already covered, or unplanned.
   - Note: the brief records whether the backing knowledge file is fact-checked. Drafting from unverified knowledge makes step 4 expensive.

2. **Draft the Article**
   - Input: `blog-brief.md`
   - Task: `playbooks/tasks/marketing/draft-blog-post.md`
   - Output: `blog-draft-v0.md`
   - Constraint: write from the brief. Every statistic comes from its bank; every quote from the authority list. Anything missing is flagged `[NEEDS DATA: ...]`, never invented.

3. **Audit and Revise Loop** — repeat until score >= 70 with zero Critical Findings, or 2 revision passes, whichever comes first:

   3a. **Audit**
     - Input: `blog-draft-v{N}.md` + `blog-brief.md`
     - Task: `playbooks/tasks/marketing/audit-blog-geo.md`
     - Output: `geo-audit-v{N}.md` (scorecard, Critical Findings, ranked fixes)

   3b. **Revise** (only if score < 70 or Critical Findings exist)
     - Input: `blog-draft-v{N}.md` + `geo-audit-v{N}.md` + `blog-brief.md`
     - Task: `playbooks/tasks/marketing/draft-blog-post.md` (revision mode)
     - Output: `blog-draft-v{N+1}.md`
     - Constraint: address the Priority Fixes in order. Do not touch unflagged prose. Never overwrite a previous version.

   - **Critical Findings are not score deductions.** An unsourced claim or an off-list authority blocks publication at any score. They must reach zero.
   - Escalation: if the score is still under 70 after 2 revisions, stop and report. The brief is probably thin, and more drafting will not fix a research problem.

   3c. **Polish pass** (once, only when the gate is already passed) — if the draft scores >= 70 with zero Critical Findings but the audit still lists Priority Fixes:
     - Input: the passing draft + `geo-audit-v{N}.md`
     - Task: `playbooks/tasks/marketing/draft-blog-post.md` (revision mode)
     - Output: one more `blog-draft-v{N+1}.md`
     - Apply **only** the audit's listed Priority Fixes, cheapest first. Touch nothing else. **No re-audit, no loop** — this is a single mechanical pass, then proceed to fact-check.
     - Why this exists: the audit prescribes concrete fixes at every score, but the old gate applied them only below 70, so a 90-scoring draft's cheap fixes (trim a hook, split a long section, soften a claim) were computed and then thrown away. One capped pass captures that value without reopening the loop. Fixes the auditor legitimately defers to fact-check (overstated claims) stay with fact-check; do not double-handle them here.

4. **Fact-Check**
   - Input: the passing `blog-draft-v{N}.md`
   - Task: `playbooks/tasks/marketing/fact-check-content.md`
   - Output: the draft, corrected and stamped with `fact_check:` frontmatter, plus a verification report
   - Note: articles are the top of the dependency chain. They are verified **against** the knowledge base, never the reverse, and an unverified knowledge file cannot serve as a reference here.
   - Note: this runs after the audit and before publishing, deliberately. Auditing a draft that fact-checking is about to rewrite wastes a pass, and publishing before fact-checking puts a wrong claim somewhere expensive: indexed, cited, and cross-checked against every other page on the domain.
   - Gate: contradicted and overstated claims corrected. Unresolved Insufficient claims either cut or explicitly accepted by the user.

5. **Publish**
   - Input: `blog-draft-v{N}.md` + `geo-audit-v{N}.md` + fact-check report + `blog-brief.md`
   - Task: `playbooks/tasks/marketing/publish-blog-post.md`
   - Output: an article file at the path declared in `blog-infra.md`, `draft: true`
   - Gate: the task enforces its own hard gates (no Critical Findings, score >= 70, fact-checked, no placeholders) and the build must pass.
   - Note: the CTA follows the product count in `geo-strategy.md`. Zero products means no CTA, and that is a complete result.

6. **Go Live** (user action)
   - The user sets `draft: false` and deploys. Never done on the user's behalf without an explicit request.

## Loop Economics
Steps 1 and 4 are the expensive ones (web research and claim verification). Steps 2, 3, and
5 are cheap. So a thin brief is the most costly failure available here: it produces a draft
that cannot be fixed by revision, burns both audit passes, and sends you back to step 1
anyway. When step 3 stalls under 70, suspect the brief before the writer.

## Gaps & Recommendations
- Articles in the same cluster share competitive research. Writing a cluster in sequence makes step 1 progressively cheaper.
- The pillar page is worth writing after 2-3 of its cluster pages exist, so it can link to real articles rather than promises.
- If several articles keep flagging the same `[NEEDS DATA]`, that is a research gap, not a writing gap. Add a topic to `research-plan.md` and run `research-topic` rather than patching each article.
