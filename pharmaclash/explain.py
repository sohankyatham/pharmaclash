"""Grounded explanations of computed interactions.

Template mode joins the engine's `facts`. LLM mode (only when OPENAI_API_KEY is set at request
time) asks the model to rephrase those same facts; it may not add claims. Any LLM failure falls
back to template mode.
"""
import json
import os

from pharmaclash.engine import _drugs, analyze

DEFAULT_MODEL = "gpt-4o-mini"

SYSTEM_PROMPT = (
    "You rewrite drug-interaction facts into plain English for patients and caregivers. "
    "Use ONLY the facts provided for each interaction. Do not add mechanisms, symptoms, doses, "
    "recommendations, statistics, or any other claim that is not in the facts. "
    "Mention both drugs by name. Two or three short sentences per interaction. "
    'Reply with JSON only: {"explanations": [{"interaction_id": "...", "text": "..."}]}.'
)


def _label(drug_id: str) -> str:
    drug = _drugs().get(drug_id)
    return drug["name"] if drug else drug_id


def template_text(interaction: dict) -> str:
    p, v = _label(interaction["perpetrator"]), _label(interaction["victim"])
    head = f"{interaction['severity'].capitalize()} interaction: {p} and {v} ({interaction['enzyme']})."
    return " ".join([head] + interaction["facts"])


def _template(interactions: list[dict]) -> list[dict]:
    return [{"interaction_id": i["id"], "text": template_text(i), "sources": i["sources"]}
            for i in interactions]


def _llm(interactions: list[dict], api_key: str) -> list[dict]:
    from openai import OpenAI  # imported lazily so template mode never needs it

    payload = [{"interaction_id": i["id"], "perpetrator": _label(i["perpetrator"]),
                "victim": _label(i["victim"]), "severity": i["severity"], "facts": i["facts"]}
               for i in interactions]
    client = OpenAI(api_key=api_key, timeout=20.0)
    resp = client.chat.completions.create(
        model=os.environ.get("OPENAI_MODEL") or DEFAULT_MODEL,
        temperature=0,
        response_format={"type": "json_object"},
        messages=[{"role": "system", "content": SYSTEM_PROMPT},
                  {"role": "user", "content": json.dumps({"interactions": payload})}],
    )
    texts = {e["interaction_id"]: e["text"]
             for e in json.loads(resp.choices[0].message.content)["explanations"]
             if isinstance(e, dict) and e.get("text")}
    # Every interaction must be covered; otherwise treat the reply as unusable.
    if not all(i["id"] in texts for i in interactions):
        raise ValueError("LLM reply did not cover every interaction")
    return [{"interaction_id": i["id"], "text": texts[i["id"]], "sources": i["sources"]}
            for i in interactions]


def explain(regimen: list[str]) -> dict:
    interactions = analyze(regimen)["interactions"]
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if api_key and interactions:
        try:
            return {"mode": "llm", "explanations": _llm(interactions, api_key)}
        except Exception:
            pass
    return {"mode": "template", "explanations": _template(interactions)}
