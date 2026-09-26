# PharmaClash — Build Phases

The stop gate runs the tests for every phase listed in `.claude/phases`. You cannot finish a
session while those tests fail. When you start a phase, append its number to `.claude/phases`.
After it passes, commit. Only start phases you were asked to do. When done, write a short
summary in `DECISIONS.md`.

## Phase 1: Data + engine  (tests/test_phase1_*.py)
- `pharmaclash/data.py`: `load_drugs()` returns `{id: drug}` from `data/drugs.json`.
- `pharmaclash/engine.py`: `analyze(regimen)` exactly per the rules and contract in CLAUDE.md.
- `requirements.txt` already lists dependencies; add only if truly needed.
Done when: phase 1 tests pass.

## Phase 2: Optimizer  (tests/test_phase2_optimizer.py)
- `pharmaclash/optimizer.py`: `optimize(regimen, locked=[])` per CLAUDE.md.
- Swap `reason` is a short factual string (e.g. "avoids CYP3A4 conflict with nirmatrelvir_ritonavir").
Done when: phases 1–2 tests pass.

## Phase 3: API + explanations  (tests/test_phase3_api.py)
- `pharmaclash/explain.py`: template mode from `facts`; LLM mode via OpenAI (model from env
  `OPENAI_MODEL`, default a small fast model). LLM prompt: rewrite only the given facts, no new claims.
- `pharmaclash/api.py`: routes per CLAUDE.md, CORS for localhost:3000.
Done when: phases 1–3 tests pass and `uvicorn pharmaclash.api:app` starts.

## Phase 4: Frontend  (tests/test_phase4_frontend.py + `npm run build`)
- Generate `web/public/mock/analyze_demo.json` by running `analyze()` on the demo patient
  regimen plus `nirmatrelvir_ritonavir` (see `data/demo_patient.json`).
- Build the Next.js app in `web/` per the design direction in CLAUDE.md. It calls the backend
  at `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`) and falls back to the mock JSON if
  the backend is down.
- Demo flow must work end to end: load demo patient → add Paxlovid → add clarithromycin →
  "Fix this regimen" (Paxlovid locked) → graph animates to the optimized regimen.
Done when: phase 4 test passes and `npm run build` succeeds.

## Phase 5: Real-world evidence  (tests/test_phase5_evidence.py)
- Download TWOSIDES (and OFFSIDES, needed in phase 6) from the Tatonetti lab nSIDES release
  into `data/raw/` (gitignored). Files are large; stream/filter, don't load everything into memory if avoidable.
- `pharmaclash/evidence.py`: `load_twosides(path, column_map=None)` and
  `evidence_for(index, drug_a, drug_b, top_k=5)`. Inspect the real file header and set the
  DEFAULT column map to match it. The tests pass their own `column_map` for the fixture.
- Build a filtered evidence table for drugs in `data/drugs.json` (match by lowercase name).
  Include top evidence per interaction in `/api/analyze` responses under `interactions[].evidence`
  when available (optional field; don't break the contract).
Done when: phases 1–5 tests pass.

## Phase 6: ML interaction-signal predictor  (tests/test_phase6_ml.py)
- `ml/split.py`: `drug_level_split(pairs_df, test_frac=0.2, seed=0) -> (train_df, test_df, heldout:set)`.
  Held-out drugs never appear in train. Test = pairs involving at least one held-out drug.
- `ml/features.py`: `pair_features(profile_a: dict, profile_b: dict, vocab: list) -> np.ndarray`, symmetric.
- `ml/negatives.py`: `sample_negatives(positives: set[frozenset], drugs: list, n, seed) -> list[tuple]`.
- `ml/train.py`: `run(pairs_csv, profiles_json, out_dir, seed=0) -> metrics dict`. LightGBM.
  Writes `metrics.json` (auroc, auprc, baseline_auroc, n_train, n_test, split="drug_level")
  and `predictions.csv` (drug_a, drug_b, probability) for pairs NOT among known positives.
  Baseline = cosine similarity of profiles.
- Then run on real data (OFFSIDES profiles, TWOSIDES significant pairs), save outputs to
  `data/ml/`, and expose top predicted pairs for regimen drugs via `/api/analyze` as
  `predicted_edges` (optional field). Frontend draws them dashed.
Done when: phases 1–6 tests pass and real-data metrics are saved.

## Later (not now): population view with Synthea, external validation against FDA labels.
