# Field notes

## jev-1.13 known failure modes

Summarised from https://docs.typesafe.ai/model-jaggedness/jev-1.13.md (reviewed by
TypeSafe 2026-09-17). Re-read that page when the model version changes.

| Failure mode | Do instead |
|---|---|
| Literal reading: answers the words, not the intent | State the exact condition. Put boundary cases in criteria. Split interpretation into two literal questions |
| Math, counting, numeric closeness (hex colours, etc.) | Compute in code. Pass named buckets. One noul per item and sum in code |
| Date/time ordering and windows | Extract date parts as choices (with a "not stated" option). Compare in code |
| Indirection, double negatives, multi-hop | Ask directly. Point at state fields by name |
| Large state with irrelevant detail | Filter in code first. Or use a relevance noul to filter |
| Adversarial content in state can steer it | Precise criteria. Test edge cases. Don't treat it as a security boundary |
| Instructions contradicting criteria | Make criteria an extension of the instruction (true = yes) |
| Structural invariants (noul vs choice, q vs not-q) don't hold | Ask each decision one way. Don't reuse a noul threshold on a choice |
| Generation | Don't. Extract candidates with regex or an LLM, and let Jev pick one |

Language: English is best. Other languages work but are weaker, so watch confidence.

## Experiment: live form gate (2026-09-19, /home/luis/dev/jev-tests)

Schema: `is_genuine_intent` (noul), `contains_sensitive_or_malicious_data` (noul),
`user_sentiment_tier` (choice: frustrated/neutral/enthusiastic),
`suggested_target_handler` (choice: self_service_docs/tier_1_support/executive_escalation),
with a one-line description per option. About 550 input tokens per call, about $0.000022.

| Input | Result | Gate |
|---|---|---|
| `asdf asdf qwerty lorem ipsum test test 123` | genuine=F | ask for detail |
| "How do I rotate my API key from the dashboard?" | docs | suggest docs |
| Password + `sk_live_…` pasted into a login complaint | sensitive=T | block |
| `'; DROP TABLE users; -- lol` | sensitive=T, genuine=F | block |
| "The new analytics dashboard is fantastic!" | enthusiastic, tier_1 | submit |
| "March invoices show the wrong VAT rate…" | neutral, tier_1 | submit |
| "Webhook broken, dropped prod transactions, losing $4,000/hr" | frustrated, executive (conf 1.0) | on-call |

All judgments were sensible. Latency 577–795 ms warm (median 606), about 950 ms cold.

Design choices that worked:
- Gate precedence in code: sensitive → not genuine → urgent → docs → submit.
- Frontend: 350 ms debounce on input, immediate on blur, AbortController so only the
  newest text renders, min 20 chars, **fail open** (an audit error never blocks submit).
- Validate answers back into the Pydantic model so an off-schema option raises.
- Tests: `httpx.MockTransport` returning a canned decisions body. No key needed.

## Experiment: "librarian" doc routing (2026-09-19, /home/luis/dev/jev-tests/librarian)

Question: given a prompt to a coding agent, which of 45 ~/claymore docs (one hand-written
description each) should it read first, if any? One noul per doc, all 45 in one request
(about 5,500 input tokens, $0.00023, ~700 ms). 27 hand-labelled prompts: 20 with a correct doc,
7 plain coding tasks where nothing applies. Baseline: text-embedding-3-small cosine.

| Method | Right doc ranked first | Wrong suggestions | Silent when nothing applies |
|---|---|---|---|
| Jev, flat `noul >= 0.5` | (all found) | 86 | 6/7 |
| Jev, flat `noul >= 0.7` | (19/20 found) | 22 | 7/7 |
| **Jev, top-1 only if `>= 0.75`** | **18/20 suggested, 0 wrong** | **0** | **7/7** |
| Embeddings top-1 | 13/20 | 5 (+7 on unrelated) | 0/7 |
| Embeddings any cosine threshold | ≤ 48% recall | — | — |

Lessons:
- **Jev's ranking is excellent (right doc first in 19/20), but absolute noul values run
  hot across a fan-out.** Broad docs (projects overview, general notes) scored 0.5–0.75 on
  almost everything. Use a relative rule (top-1, or top-k within a margin) plus a floor,
  not a flat threshold.
- **Embeddings can't say "none" usefully.** Right docs scored as low as 0.34 cosine while
  wrong docs often outscored them (right doc first in only 13/20), so any threshold strict
  enough to avoid wrong picks misses most right ones (≤ 48% recall). Top-k always suggests something.
- **Descriptions carry the whole thing.** The design contracts all begin with identical
  boilerplate, so auto-extracted "first lines" descriptions can't tell them apart. Write
  one per doc. The one real miss ("opus or fable at high effort?" → model-picking doc,
  ranked 5th at 0.53) was a description that said "Claude model" without naming the models.
- Caveats: small set, self-written labels and descriptions, clean single-intent prompts.
- **Decision (2026-09-19): not built.** ~/claymore has no reliable current-vs-outdated signal
  (outdated docs sit outside `legacy/`, and some `legacy/` docs are still accurate), and
  pointing an agent at stale doctrine is worse than pointing at nothing. Luis references docs
  manually instead. Revisit only if the vault gains a trustworthy "current" marker.

## Experiment: Stop-hook quality gate, mock cases (2026-09-19, /home/luis/dev/jev-tests/quality-gate)

State = {user_request, agent_actions_this_turn (edits, commands + exit codes), agent_final_message}.
Code derives facts (checked after last edit? last check failed? code vs .md edit); Jev answers
5 nouls (claims working, claims checked, hands back, avoidable question, incomplete undisclosed);
rules combine. 17 hand-written cases (9 should block, 8 should pass): **17/17 at threshold 0.6–0.7**,
16/17 at 0.5, all blocks for the expected reason. About 640 tokens, $0.000027 per check.
- Clear separation on most nouls (0.9+ vs <0.2). Softest: `incomplete_undisclosed` (0.53 on a
  legitimate clarifying question) and `claims_checked` (only 0.6–0.7 when the message just says
  "tests pass", 0.96 for "I tested it"). Let code facts carry verification; use ≥0.7.
- Splitting facts (code) from wording (Jev) is what made it work: "did a test run after the last
  edit" is unreliable for Jev (dates/order/counting weakness) and trivial in code.
- Caveat: self-written, short, clean cases. Real final messages are long multi-part summaries.
- **Mock results did not transfer to real transcripts.** Replaying 20 real turns (this
  session + a Codex session) first gave 7 would-blocks, all false alarms. Real requests are
  mostly questions and advice, not tasks. Fixes that brought it to 0 real false alarms
  while keeping 17/17 mock: a `request_is_task` noul gating the stop-short checks (0.94–0.98
  for tasks, 0.02–0.11 for questions); verification checks only when code was edited;
  exit codes ≥128 (killed by signal) are not test failures; "advice the user asked for" and
  "needs permission (e.g. commit)" excluded from hands_back. Always replay on real transcripts.
- Live since 2026-09-19 in log-only mode: `~/bin/jev-quality-gate` (Stop hook, Claude Code
  and Codex). Review with `jev-quality-gate review --days 7`.
