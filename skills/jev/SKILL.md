---
name: jev
description: Use Jev (TypeSafe's System One decision model) through OpenRouter with Luis's OpenRouter key. Covers the one endpoint that works (/api/alpha/decisions, not chat completions), request/response shapes for noul/choice/score, tested Python and TypeScript clients, measured latency and cost, and traps already hit. Use whenever a task mentions Jev, TypeSafe, System One, "typesafe:jev", OpenRouter decisions, or wants a fast, cheap typed judgment on text (classify, route, gate, moderate, score) instead of an LLM call. Complements the official typesafe:typesafe-ai skill, which covers concepts and patterns.
---

# Jev through OpenRouter

Jev is TypeSafe's decision model. It does not generate text: you send a `state`
(text or JSON) plus named typed questions, and get back one typed answer per
question with probabilities. It is billed per input token only.

**Last verified live: 2026-09-19** against `typesafe/jev-1.13-20260917`. If today
is well past that, run the re-check at the bottom before relying on the details.

## Which route to use

Luis has an **OpenRouter** key (`OPENROUTER_API_KEY`), not a TypeSafe key.

| Route | Works with an OpenRouter key? |
|---|---|
| `POST https://openrouter.ai/api/alpha/decisions` | **Yes. Use this.** |
| OpenRouter `/chat/completions`, OpenAI SDK, `openrouter:` in pydantic-ai | No: 400 "is a decisions model and cannot be used with the chat/completions endpoint" |
| pydantic-ai `Agent("typesafe:jev-latest")`, `typesafe-sdk` | No: they call `api.typesafe.ai/v1/systemone` and need `TYPESAFE_API_KEY` |

So code that follows TypeSafe's docs or pydantic-ai examples verbatim will not run
with Luis's key. Call the decisions endpoint directly with one of the tested,
copyable clients: `reference/jev_client.ts` (TypeScript, no deps; the default for
Hono/Bun/Vue products) or `reference/jev_client.py` (Python, httpx + pydantic).

## Traps already hit

- **Model ids differ by route.** OpenRouter: `~typesafe/jev-latest` (alias) or
  `typesafe/jev-1.13` (pinned). TypeSafe direct: `jev-latest` / `jev-1.13.0`.
- **The alias moves** to each new release. Log `response.model` (the versioned id
  that answered). Pin the version once thresholds have been tuned.
- **Noul has no `confidence`.** `noul` itself is P(yes). Choice and score have
  `confidence` plus a full `probabilities` distribution.
- **Noul `criteria` needs both `true` and `false` keys** if you send it at all.
- **Questions cost as much as the state.** Instructions and option descriptions are
  billed input. A 4-question form audit on a 1–2 sentence text is about 440–550 tokens,
  or about $0.00002. Claims like "$0.000004 per call" assume about 95 tokens total.
- **Question ids are not sent to the model.** Put all the meaning in `instructions`
  and `criteria`.
- **`python-dotenv`'s `load_dotenv()` with no path crashes in `python -` heredocs.**
  Pass the `.env` path explicitly.
- **Auto-mode safety classifier**: a script that proxies or forwards the API key
  (e.g. a mock transport relaying to OpenRouter) got blocked as credential
  exploration. Call the endpoint plainly.

## Measured performance (from Bangkok, sequential, pooled connection)

- Warm latency: **~600 ms median** (577–795 ms over 7 calls). Cold first call: ~950 ms.
  Not the ~80 ms some marketing copy claims. Size barely matters: 1 question ≈ 4 questions.
  Fine for blur or debounced input (≥300 ms). Too slow for every keystroke.
- Where it goes (measured 2026-09-19): about **300 ms is OpenRouter + geography**
  (steady; Bangkok edge → OpenRouter core → back) and about **320 ms is TypeSafe**
  (285–495 ms, including the OpenRouter→TypeSafe hop). TypeSafe's API runs only in AWS
  us-west-2 (Oregon), about 220 ms round trip from Bangkok. Our own network to OpenRouter's
  edge is about 17 ms.
  - To see the split for any call: `GET https://openrouter.ai/api/v1/generation?id=<gen-dec-…>`,
    field `latency` = provider time in ms (stats appear a few seconds after the call).
  - Going faster requires a TypeSafe key (skipping OpenRouter) and a server near Oregon.
    Users in Asia still pay the ~220 ms Pacific round trip either way.
- Cost: $0.042 per M input tokens, $0 output. Returned per call in `usage.cost`.
- Limits: 32k context on OpenRouter. TypeSafe lists 1,200 req/min and a 64k total
  budget direct.

## Using it well (short version; details in the official skill and docs)

- One narrow judgment per question. Ask independent questions together: they run
  in parallel in one request, for one latency.
- Keep math, counting, dates, and exact rules in code. Jev is literal and weak at
  numbers. See `reference/field-notes.md` for jev-1.13's known failure modes.
- Threshold on the probabilities in code, and scale thresholds with the stakes. A
  bool mapped at `noul >= 0.5` is too lax for a security gate; use a lower cutoff.
- Adversarial text in `state` can steer answers. A Jev "is this malicious?" check is
  a signal, not a security boundary. And the text has already left your server by
  then, so regex-scrub real secrets client-side first.

## Files

- `reference/jev_client.ts`: TypeScript client, zero dependencies (fetch). Answers are
  typed from the questions (`choice` → union of its options). Rejects off-schema answers.
  Runs on Bun and Node 20.3+. Bun auto-loads `.env`; on Node use `node --env-file=.env`.
- `reference/jev_client.py`: async Python client, `noul/choice/score` builders, and
  Pydantic-model ↔ questions mapping with schema validation of answers.
- `reference/openrouter-api.md`: exact request/response shapes and errors.
- `reference/field-notes.md`: jev-1.13 failure modes and the observed results of
  the form-gate, librarian, quality-gate and notification-label experiments.
- Worked project: `/home/luis/dev/jev-tests` (live form gate: FastAPI + debounced
  textarea, `audit.py`, tests with a mocked transport; `librarian/` and `quality-gate/`
  experiments).
- Retired integrations (2026-09-23, results in `reference/field-notes.md`): a Stop-hook
  quality gate (~18% precision on 325 real turns) and a phone-notification priority
  labeller (ignored in practice). Do not rebuild either without a new idea; judging
  whether an agent's turn is really finished is a weak fit for Jev.

## Going deeper

For concepts, patterns (fan-out, confidence routing, composite scoring) and
cookbooks, use the official **`typesafe:typesafe-ai`** skill if installed, or read
https://docs.typesafe.ai/llms.txt (append `.md` to any page path for Markdown).
Its code samples target TypeSafe's API: translate the endpoint and model id as above.

## Re-check (when stale or something fails)

```sh
# Model still listed, current version, price, context:
curl -s "https://openrouter.ai/api/v1/models/~typesafe/jev-latest/endpoints"
curl -s "https://openrouter.ai/api/v1/models/typesafe/jev-1.13/endpoints"
# Endpoint contract (look for /api/alpha/decisions and the Decisions* schemas):
curl -s https://openrouter.ai/openapi.json | python3 -c "import json,sys;d=json.load(sys.stdin);print([p for p in d['paths'] if 'decision' in p])"
# Known model limitations for the current version:
curl -s https://docs.typesafe.ai/models.md; curl -s https://docs.typesafe.ai/llms.txt | grep -i jaggedness
```

If the endpoint moved out of `alpha`, or the facts above changed, update this skill.
