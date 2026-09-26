# PharmaClash — Agent Instructions

PharmaClash is an interactive medication-safety engine. It shows how drug-interaction risk
builds up across a patient's whole regimen, explains the mechanism visually, fixes the regimen
with an optimizer, and (later) flags undocumented interaction signals with ML.
Educational prototype, not for clinical use.

Work through `TASKS.md` phase by phase. Read it now.

## Non-negotiable rules

1. **Never edit `tests/`, `data/drugs.json`, `data/demo_patient.json`, or `.claude/`
   (except `.claude/phases`).** These are human-owned. A hook blocks edits. If a test or data
   entry looks wrong, add a `TEST CONCERN` entry to `DECISIONS.md` and keep working on something else.
2. **Never invent drug facts.** All clinical knowledge comes from `data/drugs.json` (and later
   TWOSIDES/OFFSIDES files). The LLM may only rephrase facts the engine already computed.
3. **Do not ask the human questions.** Make the most reasonable assumption, log it in
   `DECISIONS.md` (one line: date, decision, why), and continue.
4. **When you START a phase, append its number to `.claude/phases`** (space-separated, e.g. `1 2 3`).
   The stop gate enforces every listed phase. **Commit after the phase passes:**
   `git add -A && git commit -m "phase N: ..."`. Never add a phase you were not asked to do.
5. Keep dependencies minimal. Python 3.11+, use `.venv`. Never commit secrets; read
   `OPENAI_API_KEY` from the environment at request time (not import time).
6. Don't run destructive commands, don't push to remotes.

## Repository layout (target)

```
pharmaclash/           Python package
  __init__.py
  data.py              load_drugs() -> dict[id, drug]
  engine.py            analyze(regimen) -> AnalyzeResult dict
  optimizer.py         optimize(regimen, locked=[]) -> OptimizeResult dict
  explain.py           explanations (template fallback + OpenAI)
  evidence.py          TWOSIDES loader + lookup           (phase 5)
  api.py               FastAPI app, routes under /api
ml/                    offline ML pipeline                 (phase 6)
  split.py  features.py  negatives.py  train.py
web/                   Next.js frontend                    (phase 4)
data/                  drugs.json (curated), demo_patient.json, raw/ (gitignored downloads)
tests/                 human-owned acceptance tests
```

## Engine rules (tests depend on these exact rules)

**Enzyme interactions.** For every ordered pair (perpetrator P, victim V) with P != V, and every
enzyme E where P inhibits E and V is a substrate of E:
- weight(strength): strong=3, moderate=2, weak=1; weight(sensitivity): sensitive=3, moderate_sensitive=2, minor=1
- product = strength × sensitivity → `high` if ≥6, `moderate` if 3–5, `low` if 1–2
- if P's strength is `strong` and E is in V's `contraindicated_with_strong_inhibitor_of` → `contraindicated`
- effect = `increased_levels`
Same for inducers (P induces E, V substrate of E) with effect `decreased_levels`.
**Prodrugs:** if V has `activation_enzyme` == E and P inhibits E → effect `reduced_activation`,
severity strong→high, moderate→moderate, weak→low.
A drug never interacts with itself. Interaction id: `f"{P}__{V}__{E}__{effect}"`.

**Meters (cumulative risk):**
- QT: points known=3, possible=2, conditional=1, none=0. Level: 0→none, 1–3→low, 4–5→moderate, ≥6→high
- Anticholinergic: sum of `acb_score`. Level: 0→none, 1–2→low, ≥3→high
- Bleeding: count of drugs with `bleeding_risk`. Level: 0→none, 1→low, 2→moderate, ≥3→high

**Total risk:** interactions low=1, moderate=3, high=6, contraindicated=10, plus meter levels
low=1, moderate=3, high=6. Deterministic and independent of input order.

Unknown drug ids go in `unknown_drugs` and are otherwise ignored (never crash).

## Contracts

`analyze(regimen: list[str]) -> dict`
```json
{
  "regimen": ["..."],
  "nodes": [{"id": "simvastatin", "label": "Simvastatin", "type": "drug|enzyme|risk"}],
  "edges": [{"source": "...", "target": "...", "kind": "substrate|inhibits|induces|activates|contributes", "severity": "none|low|moderate|high|contraindicated"}],
  "interactions": [{"id": "...", "perpetrator": "...", "victim": "...", "enzyme": "CYP3A4",
                    "effect": "increased_levels|decreased_levels|reduced_activation",
                    "severity": "low|moderate|high|contraindicated",
                    "facts": ["short factual strings built from data"], "sources": ["FDA_DDI"]}],
  "meters": {"qt": {"score": 0, "level": "none", "contributors": []},
             "anticholinergic": {"score": 0, "level": "none", "contributors": []},
             "bleeding": {"score": 0, "level": "none", "contributors": []}},
  "total_risk": 0,
  "unknown_drugs": []
}
```
Enzyme nodes use the enzyme name as id (e.g. `CYP3A4`); risk nodes use `risk_qt`,
`risk_anticholinergic`, `risk_bleeding`. Every edge endpoint must exist in `nodes`.

`optimize(regimen, locked=[]) -> dict`
```json
{"original_regimen": [], "regimen": [], "original_risk": 0, "optimized_risk": 0,
 "swaps": [{"from": "simvastatin", "to": "pravastatin", "reason": "..."}],
 "unresolved": [{"drug": "apixaban", "issue": "..."}]}
```
Search: each unlocked drug may stay or become one of its listed `alternatives`; enumerate all
combinations; pick minimum total risk; tie-break by fewest swaps, then alphabetical. No duplicate
drugs in a regimen. `unresolved` = drugs still involved in a moderate+ interaction or meter
that have no alternatives (or are locked).

API (FastAPI, prefix `/api`): `GET /drugs`, `POST /analyze {"regimen": []}`,
`POST /optimize {"regimen": [], "locked": []}`, `POST /explain {"regimen": []}` →
`{"mode": "llm|template", "explanations": [{"interaction_id", "text", "sources"}]}`.
Without `OPENAI_API_KEY`, `/explain` uses a template built only from `facts` (mode `template`).
With a key, the LLM rewrites facts into plain English and must not add new claims.
Enable CORS for `http://localhost:3000`.

## Commands

```
source .venv/bin/activate
pytest -q                     # all tests
uvicorn pharmaclash.api:app --reload --port 8000
cd web && npm run dev         # frontend on :3000
```

## Frontend design direction (phase 4)

Next.js (App Router) + TypeScript + Tailwind + `react-force-graph-2d`. Dark "clinical control room"
look: near-black background, drug nodes as soft circles, enzyme nodes as hexagon-ish hubs,
risk nodes as larger rings. Edge colors: low=amber-ish dim, moderate=amber, high=red,
contraindicated=bright red pulsing. Animate changes when a drug is added/removed. Panels:
drug picker (search + add/remove), three risk meters, "Why" panel listing interactions with
sources, and a prominent "Fix this regimen" button that animates swaps. ML-predicted edges
(phase 6) render as dashed lines with a probability label. Must look good on a laptop projector.
Use the Playwright MCP (if available) to screenshot and check your own UI.
