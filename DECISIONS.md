# Decisions log

One line per decision: `YYYY-MM-DD HH:MM | decision | why`.
Use `TEST CONCERN:` for tests or data you believe are wrong (you may not edit them).

2026-09-26 10:00 | Phase 1 started; `.claude/phases` already contained `1`. | Kit ships with phase 1 pre-listed.
2026-09-26 10:05 | `analyze()` dedupes the regimen (first occurrence wins) and returns it in input order; all internal work (interactions, nodes, edges) is sorted by id so output is order-independent. | Contract requires order-independent total risk; dedup avoids double-counting and self-interaction via duplicates.
2026-09-26 10:05 | `interactions[].sources` = union of perpetrator and victim `sources` (perpetrator first). | Data has per-drug sources only, no per-interaction sources; both drugs' facts are used.
2026-09-26 10:05 | `facts` are template sentences built only from drugs.json fields (strength, sensitivity, enzyme, contraindication flag) plus the victim's `notes` string. | "Never invent drug facts"; notes are curated human text.
2026-09-26 10:05 | A drug that is both a substrate and a prodrug for the same enzyme can yield both an increased_levels and a reduced_activation interaction. | The rules list them as separate checks; no current data triggers both.
2026-09-26 10:05 | Graph: enzyme nodes only for enzymes a regimen drug touches; edges drug->enzyme (substrate/inhibits/induces), enzyme->drug (activates), drug->risk node (contributes). Enzyme-edge severity = worst interaction using that edge, else `none`; contributes-edge severity = meter level. All three risk nodes are always present. | Stable graph layout for the frontend; every edge endpoint exists in nodes.
2026-09-26 10:05 | Interactions are sorted by severity (worst first) then id. | Deterministic and most useful order for the "Why" panel.
2026-09-26 10:20 | Phase 2 started (`.claude/phases` = `1 2`). | Rule 4.
2026-09-26 10:25 | Optimizer tie-break key = (total_risk, number of swaps, sorted tuple of drug ids); combos with duplicate drugs are skipped; risk is cached per sorted combo. | Implements "min risk, fewest swaps, then alphabetical" deterministically; demo gives 80 -> 19 with the 5 reference swaps.
2026-09-26 10:25 | Unknown drug ids are kept unchanged in the optimized regimen (treated as unswappable) and never listed as unresolved. | Engine ignores them; optimizer shouldn't drop user input silently.
2026-09-26 10:25 | Swap `reason` lists every enzyme conflict the removed drug had in the ORIGINAL regimen plus any meter it stops contributing to; fallback is "lowers total regimen risk (a -> b)". | Short, factual, derived only from engine output; crediting only conflicts with still-present drugs gave misleading reasons when both partners were swapped.
2026-09-26 10:25 | `unresolved` = drugs in the optimized regimen that are locked or have no alternatives AND are in a moderate+ interaction or contribute to a moderate+ meter. Includes the locked drug itself (e.g. Paxlovid) and meter contributors like azithromycin/sertraline. | Literal reading of CLAUDE.md; the tests only require apixaban and amlodipine to be present.
