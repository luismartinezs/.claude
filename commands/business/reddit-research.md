---
description: Research a subreddit to find wants, needs, and opportunities. Analyzes pain signals, clusters them into ranked opportunities, and saves a structured report.
argument-hint: subreddit name (e.g., "solopreneur" or "r/solopreneur")
---

You are a demand discovery researcher. Your job is to deeply research a single subreddit to find unmet wants, needs, and pain points — real opportunities backed by evidence.

## Input

Subreddit: $ARGUMENTS

Clean the input: strip "r/" prefix if present, lowercase, trim whitespace. If empty or missing, stop and ask the user for a subreddit name.

## Output

Save the final report to: `research/reddit/<subreddit>/<YYYY-MM-DD>-analysis.md` (use today's date).
Create directories as needed.
At the end, tell the user the file path and give a brief (3-5 line) summary of the top findings.

---

## Execution Plan

You MUST run Phase 1, then Phase 2 (two parallel agents), then Phase 3 and 4 sequentially.

### Phase 1: Recon

Use WebSearch to find subreddit info: `r/<subreddit> subreddit rules subscribers self-promotion`

Extract and note:
- Subscriber count (approximate is fine)
- Subreddit description and purpose
- Subreddit rules (especially self-promotion policies)
- Any patterns around how the community receives external tools/resources

### Phase 2: Signal Collection

Launch TWO parallel agents using the Agent tool. Both must run concurrently.

**Agent A — Arctic Shift Historical Search:**
```
You are researching the subreddit "<subreddit>" for pain signals using Arctic Shift's API.

IMPORTANT API DETAILS:
- Post search endpoint: https://arctic-shift.photon-reddit.com/api/posts/search
- Comment search endpoint: https://arctic-shift.photon-reddit.com/api/comments/search
- For posts, use parameter: query=<keyword>
- For comments, use parameter: body=<keyword>
- Other params: subreddit=<subreddit>&limit=100
- OR operator is NOT supported. Use individual keyword searches.
- Sorting by score is NOT supported. Results come sorted by created_utc desc.

Use WebFetch on each URL. Run as many searches in parallel as possible.

POST SEARCHES (one keyword/phrase per request):
1. query=looking+for
2. query=I+wish
3. query=frustrated
4. query=recommend
5. query=worth+buying
6. query=worth+paying
7. query=alternative+to
8. query=how+do+I
9. query=struggling
10. query=annoying

COMMENT SEARCHES (highest value — these capture raw pain):
1. body=I+wish
2. body=frustrated
3. body=hate+that
4. body=would+pay
5. body=looking+for

For each result, extract: id, title (posts only), body/selftext (first 300 chars), score, num_comments (posts only), created_utc, permalink, author.

CRITICAL: Filter aggressively. Only include results where the post/comment body actually expresses a want, need, frustration, or willingness to pay. Generic discussion that happens to contain the keyword is NOT a signal. A post titled "Looking for PvP partners" is a signal. A post that mentions "looking for" in passing while discussing lore is NOT.

If Arctic Shift is down or returns errors, report what happened and return whatever partial data you got.

Return all results as a structured list with the search query that found each result noted.
```

**Agent B — WebSearch + Ecosystem Context:**
```
You are researching the subreddit "r/<subreddit>" for pain signals using web search. You may also find corroborating evidence from external sources (surveys, GitHub issues, dev blogs) — this is valuable but must be clearly labeled as [CORROBORATION], not primary evidence.

Run these WebSearch queries (run as many in parallel as possible):

PAIN SIGNAL SEARCHES:
1. site:reddit.com r/<subreddit> "looking for" OR "need a tool" OR "can anyone recommend"
2. site:reddit.com r/<subreddit> "I wish" OR "frustrated" OR "hate that"
3. site:reddit.com r/<subreddit> "would pay" OR "worth paying" OR "take my money" OR "shut up and take"
4. site:reddit.com r/<subreddit> "how do I" OR "how to" OR "help me with"
5. site:reddit.com r/<subreddit> "alternative to" OR "switched from" OR "better than"
6. site:reddit.com r/<subreddit> "tried" "but" OR "didn't work" OR "doesn't work"
7. site:reddit.com r/<subreddit> "is there a way" OR "does anyone know how"
8. site:reddit.com r/<subreddit> "worst" OR "broken" OR "needs to be fixed"

CONTEXT SEARCHES (to understand what the community cares about):
9. r/<subreddit> most popular tools resources
10. r/<subreddit> community complaints common problems
11. r/<subreddit> best resources guides recommendations

If any search returns thin results, retry without the site: prefix, using "reddit r/<subreddit>" as keywords instead.

For each result, record:
- Title and URL
- Search snippet (the preview text)
- Which query found it
- Whether the snippet contains a clear pain signal (explicit want, frustration, money signal, failed solution)

CRITICAL FILTERING: Not every Reddit post is a signal. People asking normal usage questions is expected behavior. Only flag posts where someone is expressing:
- An unmet need (something they want but can't find)
- Frustration with existing solutions (something exists but fails them)
- Willingness to spend money or time on a solution
- A workaround they've built because no good solution exists
- A question asked so frequently it indicates a systemic gap

Do NOT flag:
- Normal help questions that are just part of using the product/hobby
- General discussion or opinions
- "Is X worth buying?" posts (these are purchase anxiety, not product opportunities)
- Memes, jokes, or community in-jokes

Return all qualifying signals as a structured list.
```

### Phase 3: Extraction & Classification

After both agents complete, merge their results. Deduplicate by post ID (same post found by both agents = stronger signal).

**Engagement-based filtering:** Before classification, apply this filter:
- Posts with score < 5 AND < 15 comments = WEAK signal (can be included but must be marked weak)
- Posts with score >= 5 OR >= 15 comments = MODERATE signal
- Posts with score >= 50 OR >= 50 comments = STRONG signal
- A weak signal only counts toward opportunity frequency if corroborated by other weak signals on the same theme (3+ weak signals on the same topic = 1 moderate signal)

For each qualifying signal, classify it:

**Signal Type** (pick one):
- `explicit-want` — "Looking for...", "Is there a tool that...", "Can anyone recommend..."
- `frustration` — "I'm sick of...", "Why is X so...", "X is broken/terrible"
- `workaround` — "What I do is..." / DIY solutions (indicates unmet need being hacked around)
- `repeated-question` — Same question asked by multiple people across different posts
- `money-signal` — "I'd pay for...", "Worth the price?", "Free alternative to..."
- `failed-solution` — "I tried X but..." (reveals what exists AND why it fails)

**Temporal Tag** (pick one based on actual data, not gut feeling):
- `evergreen` — Found in posts older than 12 months AND posts from the last 3 months
- `persistent` — Found only in posts older than 6 months (might be solved by now)
- `emerging` — Found only in posts from the last 6 months

**For each signal, record:**
- Signal type
- Temporal tag
- Engagement level (weak/moderate/strong)
- Verbatim quote (the actual user words — 1-2 sentences max)
- Post title and permalink
- Score + comment count
- Source (which agent found it)

### Phase 4: Analysis & Report

Cluster the signals into **opportunity themes** — group related signals that point to the same underlying need. Name each theme clearly.

**Evidence verification:** Before finalizing, re-read each evidence quote under every opportunity and verify it actually describes the opportunity it's listed under. Remove or reclassify any misplaced quotes. A quote about "bundle size tools" does not belong under a "PDF generation" opportunity.

**Rank opportunities by this formula (qualitative, not numeric):**
- Frequency: How many MODERATE or STRONG signals point to this need? (Weak signals are supporting evidence only)
- Intensity: Mild annoyance or hair-on-fire problem?
- Willingness to pay: Any explicit money signals? (Don't guess — only count evidence)
- Addressability: Can an external tool/resource actually solve this, or can only the product creator fix it? (e.g., "the game stutters" is not addressable by you; "I can't find the right build" IS addressable)

**For each opportunity, assess confidence:**
- `high` — 3+ moderate/strong signals, addressable by external resource, evergreen tag
- `medium` — 2+ moderate signals OR 5+ corroborated weak signals, some addressability
- `low` — 1-2 signals, or not clearly addressable

**Existing Solutions verification:** For each opportunity's "Existing Solutions & Why They Fail" section, ONLY include solutions that were explicitly mentioned by community members in the collected signals. Do NOT speculate about what tools exist or don't exist. If no community member mentioned trying a solution, write "No existing solutions mentioned in collected signals."

Include a **Community Culture** section:
- Self-promotion rules (from Phase 1 recon)
- Examples of well-received tool/resource posts found during research (if any)
- Overall receptiveness to external links (hostile / cautious / welcoming)

---

## Report Format

Write the report in this exact structure:

```markdown
# Reddit Research: r/<subreddit>
**Date:** YYYY-MM-DD
**Subscribers:** ~X

## Community Profile
<1-2 paragraphs about what this community is, what they care about, posting culture>

### Self-Promotion Rules
<What the rules say about linking external resources>

### Receptiveness to Tools/Resources
<hostile / cautious / welcoming — with evidence>

---

## Opportunities (Ranked)

### 1. [Opportunity Name] — Confidence: HIGH/MEDIUM/LOW
**Temporal:** evergreen/persistent/emerging
**Frequency:** X moderate/strong signals (Y weak) | **Intensity:** mild/moderate/severe | **WTP:** yes (evidence) / no evidence
**Addressability:** Can an external tool/resource solve this? <yes/partial/no — explain>

**Pain Summary:**
<2-3 sentence summary of the underlying need>

**Existing Solutions Mentioned & Why They Fail:**
<ONLY solutions explicitly mentioned by community members. If none mentioned, say so.>

**Evidence (strongest first):**
> [STRONG] "verbatim quote" — u/user, [post title](permalink), score X, N comments
> [MODERATE] "verbatim quote" — u/user, [post title](permalink), score X, N comments
> [WEAK] "verbatim quote" — u/user, [post title](permalink), score X, N comments
> ...

---

### 2. [Next Opportunity]
...

---

## Weak Signals (Low Confidence)
<Brief list of patterns that appeared 1-2 times — worth watching in future runs but not actionable yet>

## Data Collection Notes
- Arctic Shift: <status — success/partial/failed, number of results>
- WebSearch: <status — success/partial/failed, number of queries run>
- Total unique posts analyzed: N
- Signals after engagement filtering: N (X strong, Y moderate, Z weak)
```

---

## Important Rules

1. **Evidence over inference.** Every claim must be backed by a verbatim quote and link. Do not invent or hallucinate signals.
2. **Do not suggest solutions, products, or site designs.** This is demand discovery only. The output is an opportunity map, not a product spec.
3. **Do not suggest monetization models.** That's out of scope.
4. **Do not suggest engagement strategies.** Just report the community culture facts.
5. **Graceful degradation.** If a data source fails, use the other. Never fail completely — always produce a report with whatever data you collected. Note gaps in the Data Collection Notes section.
6. **Deduplication matters.** A signal found by both agents is stronger than one found by only one. Note this in the evidence.
7. **Quality over quantity.** 3 well-evidenced opportunities beat 10 speculative ones.
8. **Filter aggressively.** Normal questions that are expected behavior in any community are NOT signals. "How do I beat this boss?" in a gaming sub is normal. "I've tried 5 different guides and none of them work for my build" is a signal. The difference is evidence of a GAP — something that should exist but doesn't.
9. **Addressability matters.** An opportunity you can't address with an external resource is not an opportunity for YOU. "The game crashes" is a problem only the developer can fix. Deprioritize unaddressable problems.
10. **Existing solutions must be verified.** Only mention existing solutions that community members explicitly referenced. Do not Google for competitors and add them — that's a different analysis.
