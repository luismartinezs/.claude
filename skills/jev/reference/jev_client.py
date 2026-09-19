"""Minimal async client for Jev (TypeSafe) through OpenRouter's decisions endpoint.

Copy into a project and adapt. Needs: httpx, pydantic. Key: OPENROUTER_API_KEY.
Verified live 2026-09-19 against typesafe/jev-1.13-20260917.

    jev = Jev()
    r = await jev.ask("I was charged twice", {
        "is_billing": noul("Is this about billing or payments?"),
        "team": choice("Which team should own this?", {"billing": "Charges, refunds", "tech": "Bugs, outages"}),
        "urgency": score("How urgent is this?", ["Can wait", "This week", "Blocking revenue now"]),
    })
    r.answers["is_billing"]["noul"]      # probability of yes, 0..1 (no confidence field)
    r.answers["team"]["choice"]          # + "confidence", "probabilities"
    r.answers["urgency"]["score"]        # float between levels, + "confidence", "probabilities", "legend"
"""

import os
from typing import Any, Literal, get_args, get_origin

import httpx
from pydantic import BaseModel

DECISIONS_URL = "https://openrouter.ai/api/alpha/decisions"
DEFAULT_MODEL = "~typesafe/jev-latest"  # pin "typesafe/jev-1.13" once thresholds are tuned

JSON = str | dict[str, Any] | list[Any]


def noul(instructions: JSON, yes: str | None = None, no: str | None = None) -> dict:
    q: dict[str, Any] = {"type": "noul", "instructions": instructions}
    if yes is not None or no is not None:
        q["criteria"] = {"true": yes or "Yes.", "false": no or "No."}  # both keys required if criteria present
    return q


def choice(instructions: JSON, options: dict[str, str | None]) -> dict:
    return {"type": "choice", "instructions": instructions, "criteria": options}


def score(instructions: JSON, levels: list[str]) -> dict:
    assert len(levels) >= 2, "score needs at least two ordered levels"
    return {"type": "score", "instructions": instructions, "criteria": levels}


class JevResponse(BaseModel):
    model: str                      # versioned id that actually answered; log it
    answers: dict[str, dict[str, Any]]
    cost_usd: float | None
    input_tokens: int


class Jev:
    """Reuse one instance: the pooled connection is what keeps warm calls fast."""

    def __init__(self, api_key: str | None = None, model: str = DEFAULT_MODEL,
                 client: httpx.AsyncClient | None = None, timeout: float = 10):
        self.api_key = api_key or os.getenv("OPENROUTER_API_KEY")
        self.model = model
        self.client = client or httpx.AsyncClient(timeout=timeout)

    async def ask(self, state: JSON, questions: dict[str, dict]) -> JevResponse:
        if not self.api_key:
            raise RuntimeError("OPENROUTER_API_KEY is not set")
        r = await self.client.post(
            DECISIONS_URL,
            headers={"Authorization": f"Bearer {self.api_key}"},
            json={"model": self.model, "state": state, "questions": questions},
        )
        if r.status_code != 200:
            raise RuntimeError(f"Jev decisions error {r.status_code}: {r.text[:300]}")
        body = r.json()
        usage = body.get("usage", {})
        return JevResponse(model=body["model"], answers=body["answers"],
                           cost_usd=usage.get("cost"), input_tokens=usage.get("input_tokens", 0))


# --- Optional: drive questions from a Pydantic model (bool -> noul, Literal -> choice) ---

def questions_from_model(model: type[BaseModel], option_criteria: dict[str, dict[str, str]] | None = None) -> dict:
    """Field description is the question. Literal options get descriptions from option_criteria."""
    option_criteria = option_criteria or {}
    out: dict[str, dict] = {}
    for name, field in model.model_fields.items():
        if not field.description:
            raise ValueError(f"{name}: the field description is the question; add one")
        if field.annotation is bool:
            out[name] = noul(field.description)
        elif get_origin(field.annotation) is Literal:
            crit = option_criteria.get(name, {})
            out[name] = choice(field.description, {o: crit.get(o) for o in get_args(field.annotation)})
        else:
            raise TypeError(f"{name}: only bool and Literal fields map cleanly; use score() by hand")
    return out


def fill_model(model: type[BaseModel], answers: dict[str, dict], yes_at: float = 0.5) -> BaseModel:
    """Validate answers back into the model; raises if an answer falls outside the schema."""
    values = {k: (a["noul"] >= yes_at if a["type"] == "noul" else a["choice"]) for k, a in answers.items()}
    return model.model_validate(values)
