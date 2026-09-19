# OpenRouter decisions API for Jev

Source: https://openrouter.ai/openapi.json (`/api/alpha/decisions`, `Decisions*` schemas),
plus live responses on 2026-09-19. The body format matches TypeSafe's own
`POST /v1/systemone` (https://docs.typesafe.ai/api.md). Only the URL, the model id,
and the extra response fields differ.

## Request

```http
POST https://openrouter.ai/api/alpha/decisions
Authorization: Bearer $OPENROUTER_API_KEY
Content-Type: application/json
```

```json
{
  "model": "~typesafe/jev-latest",
  "state": "I was charged twice for order #4411 and checkout is down for all EU customers.",
  "questions": {
    "is_billing": { "type": "noul", "instructions": "Is this about billing or payments?" },
    "is_billing_c": {
      "type": "noul",
      "instructions": "Is this about billing or payments?",
      "criteria": { "true": "Mentions charges, invoices, refunds", "false": "Anything else" }
    },
    "team": {
      "type": "choice",
      "instructions": "Which team should own this?",
      "criteria": { "billing": "Charges, refunds", "tech": "Bugs, outages", "sales": null }
    },
    "urgency": {
      "type": "score",
      "instructions": "How urgent is this?",
      "criteria": ["Can wait", "Should be fixed this week", "Blocking revenue right now"]
    }
  }
}
```

Fields:
- `model` (required): `~typesafe/jev-latest` or pinned `typesafe/jev-1.13`.
- `state` (required): string, JSON object, or array. Prefer named JSON fields when the
  context has several parts, and reference them in instructions as `` `ticket.body` ``.
- `questions` (required): map of your ids to questions. Ids are **not** sent to the model.
  - `noul`: `instructions` required. `criteria` optional, but if present needs both
    `"true"` and `"false"`.
  - `choice`: `instructions` and `criteria` (map of option to description or `null`) required.
  - `score`: `instructions` and `criteria` (ordered array, ≥2 levels, low → high) required.
  - `instructions` and criteria values can also be JSON objects or arrays, for
    definitions, exclusions, and examples.
- Optional: `session_id` (≤256 chars, for OpenRouter observability only, not sent to
  the provider), `user`, `provider` (routing preferences), `trace`.

## Response (actual, 2026-09-19)

```json
{
  "id": "gen-dec-…",
  "model": "typesafe/jev-1.13-20260917",
  "provider": "TypeSafe",
  "usage": { "cost": 1.8354e-05, "input_tokens": 437, "output_tokens": 70 },
  "answers": {
    "is_billing": { "type": "noul", "noul": 0.97 },
    "team": {
      "type": "choice", "choice": "tech", "confidence": 0.83,
      "probabilities": { "sales": 0, "billing": 0.11, "tech": 0.89 }
    },
    "urgency": {
      "type": "score", "score": 2, "confidence": 0.99,
      "legend": { "0": "Can wait", "1": "Should be fixed this week", "2": "Blocking revenue right now" },
      "probabilities": { "0": 0, "1": 0, "2": 1 }
    }
  }
}
```

- `noul`: P(yes), 0–1. **No `confidence` field.**
- `choice`: `choice` is the top option. `probabilities` sums to 1. `confidence` summarises
  how concentrated the distribution is (it is not the top probability: 0.89 → 0.83 above).
- `score`: `score` is the probability-weighted level index and can fall between levels.
  Don't interpolate exact magnitudes from it; threshold it.
- `usage.cost` is USD and matches input_tokens × $0.042/M. Output tokens are free.

## Errors

- 400 on `/chat/completions`: "~typesafe/jev-latest is a decisions model and cannot be
  used with the chat/completions endpoint. Use the /api/alpha/decisions endpoint instead."
- 400 invalid parameters. 401 bad key. 429 rate limited (back off exponentially; there
  is no SDK doing it for you on this route). TypeSafe also documents 529 overloaded.

## Translating TypeSafe docs samples

TypeSafe docs use `typesafe_sdk` (`client.system_one(state, {"q": Noul(...)})`). The
equivalent here is the same questions as plain dicts posted to the URL above, with
`model` changed to the OpenRouter id. `Noul(instructions=…)` becomes `{"type": "noul",
"instructions": …}`, and likewise for `Choice` and `Score`.
