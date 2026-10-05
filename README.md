# PharmaClash

**A medication-safety engine that scores how drug-interaction risk accumulates across a patient's entire regimen — then fixes it.**

Most interaction checkers answer one question at a time: *is drug A safe with drug B?* That misses how real harm happens. An 80-year-old on eight medications is rarely hurt by a single pair; they're hurt by a shared metabolic bottleneck and by burden that stacks silently across the whole list. PharmaClash models the regimen as a system, shows the mechanism, and searches for a safer version of it.

> [!WARNING]
> **Educational prototype. Not for clinical use.** This is a software project built to explore pharmacokinetic modeling and constrained LLM output. It is not a medical device, has not been clinically validated, and must not be used to make treatment decisions. Several values in the dataset carry `needs_review` flags.

---

## What it does

**1. Scores the whole regimen.** A deterministic rules engine finds every pairwise enzyme interaction and layers three cumulative burden meters on top.

**2. Explains the mechanism.** Every interaction resolves to a specific enzyme and a specific effect — not a severity label with no reasoning. A force-directed graph renders drugs, the CYP enzymes they compete over, and the risks they feed.

**3. Fixes the regimen.** A combinatorial optimizer searches therapeutic alternatives for a substitution set that minimizes total risk, and reports what it *couldn't* fix — drugs locked by the clinician or with no safer alternative — instead of pretending a clean answer exists.

On the demo patient, adding Paxlovid to an existing regimen takes total risk from 13 to 41, and a course of clarithromycin takes it to 80. The optimizer brings it down to 19 with five substitutions, while flagging apixaban and amlodipine for a clinician's judgment:

| Regimen state | Total risk |
|---|---|
| Demo patient baseline | 13 |
| \+ Paxlovid (nirmatrelvir/ritonavir) | 41 |
| \+ clarithromycin | 80 |
| After optimizer (5 swaps) | **19** |

---

## The risk model

All clinical facts come from `data/drugs.json` — a hand-curated 36-drug dataset. Nothing is inferred by a model.

### Enzyme interactions

For each ordered pair of drugs (perpetrator **P**, victim **V**) and each enzyme **E**:

- **Inhibition** — P inhibits E and V is a substrate of E → `increased_levels`
- **Induction** — P induces E and V is a substrate of E → `decreased_levels`
- **Prodrug blockade** — P inhibits E and E is V's activation enzyme → `reduced_activation`

Severity comes from inhibitor strength × substrate sensitivity (strong/moderate/weak = 3/2/1, sensitive/moderate/minor = 3/2/1):

| Product | Severity |
|---|---|
| ≥ 6 | high |
| 3–5 | moderate |
| 1–2 | low |

A strong inhibitor of an enzyme listed in the victim's `contraindicated_with_strong_inhibitor_of` escalates straight to `contraindicated`.

### Cumulative burden meters

Pairwise checks miss burden that stacks. Three meters catch it:

- **QT prolongation** — weighted by risk category (known / possible / conditional)
- **Anticholinergic burden** — summed ACB scores, the mechanism behind falls and confusion in elderly patients
- **Bleeding risk** — count of contributing drugs

### Total risk

Interactions score low/moderate/high/contraindicated = 1/3/6/10. Meter levels score low/moderate/high = 1/3/6. The sum is **deterministic and independent of input order** — the regimen is deduplicated and all internal work is sorted by ID, so the same drug list always produces the same number.

---

## Explanations that can't hallucinate

The LLM layer is deliberately boxed in. It never sees the drug database and never generates clinical claims — it only rephrases interactions the engine already computed:

- One `chat.completions` call in JSON mode, `temperature=0`
- The prompt forbids introducing any claim not present in the engine's output
- The reply must cover every interaction ID the engine found, or it is rejected
- **Any** error, timeout, or incomplete response falls back to deterministic template sentences

A regimen with no interactions makes no API call at all. The result: no network dependency, no quota dependency, and no path for an invented drug fact to reach the user.

---

## Architecture

```
pharmaclash/
  data.py         load_drugs() -> dict[id, drug]
  engine.py       analyze(regimen) -> interactions, meters, graph, total_risk
  optimizer.py    optimize(regimen, locked=[]) -> swaps, unresolved, new risk
  explain.py      LLM explanations with template fallback
  api.py          FastAPI app, routes under /api
web/              Next.js frontend (force-directed graph, meters, animation)
data/             drugs.json (curated, 36 drugs), demo_patient.json
tests/            30 acceptance tests
scripts/          gen_mocks.py — generates offline demo snapshots
```

**Optimizer design.** Risk is cached per sorted drug combination, and ties break on `(total_risk, number_of_swaps, sorted_drug_ids)` — so the result is reproducible, and among equally safe regimens it prefers the one that changes the least about the patient's therapy.

**Offline-capable frontend.** `scripts/gen_mocks.py` runs the real engine to produce snapshots of every demo state. If the API is unreachable the UI falls back to them and shows an explicit "Offline · demo snapshot" badge, so a live demo never dies on a bad network.

### API

| Route | Purpose |
|---|---|
| `GET /api/drugs` | Drug list for the picker |
| `POST /api/analyze` | Full risk analysis of a regimen |
| `POST /api/optimize` | Substitution search, honors `locked` drugs |
| `POST /api/explain` | Grounded natural-language explanations |

---

## Running it

Requires Python 3.11+ and Node 18+.

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: source .venv/Scripts/activate
pip install -r requirements.txt
```

Backend:

```bash
uvicorn pharmaclash.api:app --reload --port 8000
```

Interactive API docs at `http://localhost:8000/docs`.

Frontend:

```bash
cd web && npm install && npm run dev
```

For LLM explanations, copy `.env.example` to `.env` and add an `OPENAI_API_KEY`. Without one, explanations use the template path and everything else works unchanged.

Tests:

```bash
pytest -q        # 30 passed
```

The suite covers phases 1–4 (engine, optimizer, API, frontend contract). Phases 5 and 6 — evidence retrieval and ML signal detection — are specified in `TASKS.md` but not implemented; their placeholder tests are excluded in `pytest.ini`.

---

## How this was built

The implementation was written by an agent loop under a test-enforced harness, which is part of what the project was built to explore.

The acceptance tests, the curated drug dataset, and the engine's rules were authored by hand first and made **immutable** — a `PreToolUse` hook blocks any edit to `tests/`, `data/drugs.json`, or the hooks themselves. A `Stop` hook then refuses to end a session while the current phase's tests fail, retrying up to 8 times. The agent tracks its own progress in `.claude/phases`, logs every assumption and judgment call to `DECISIONS.md`, and commits only after a phase goes green.

The point is that correctness is defined by artifacts the agent cannot touch. `DECISIONS.md` is the record of every trade-off made along the way, and `README_START.md` documents how to run the harness.

---

## Data sources

Curated from published references:

- **CYP enzyme roles** — the Flockhart Table (Indiana University) and the FDA table of substrates, inhibitors and inducers
- **QT risk categories** — CredibleMeds risk classifications
- **Anticholinergic scores** — the Anticholinergic Cognitive Burden (ACB) scale
- **Paxlovid interactions** — the nirmatrelvir/ritonavir label

Per-drug citations live in each entry's `sources` field.

## Limitations

- **36 drugs.** A curated teaching set, not a formulary. Unknown drug IDs are returned in `unknown_drugs` and ignored rather than crashing.
- **Not clinically validated.** Entries flagged `needs_review` — mostly ACB scores and some QT categories — have not been independently verified.
- **No patient-specific pharmacokinetics.** Renal and hepatic function, age, weight, and genotype all affect real interaction severity, and none are modeled.
- **Pairwise mechanism only.** Three-way metabolic interactions are not modeled beyond the cumulative meters.
