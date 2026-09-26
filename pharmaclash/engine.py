"""Rules engine: pairwise enzyme interactions plus cumulative risk meters.

All clinical knowledge comes from data/drugs.json; the rules are the ones in CLAUDE.md.
"""
from functools import lru_cache

from pharmaclash.data import load_drugs

STRENGTH_WEIGHT = {"strong": 3, "moderate": 2, "weak": 1}
SENSITIVITY_WEIGHT = {"sensitive": 3, "moderate_sensitive": 2, "minor": 1}
PRODRUG_SEVERITY = {"strong": "high", "moderate": "moderate", "weak": "low"}

SEVERITY_RANK = {"none": 0, "low": 1, "moderate": 2, "high": 3, "contraindicated": 4}
INTERACTION_POINTS = {"low": 1, "moderate": 3, "high": 6, "contraindicated": 10}
METER_POINTS = {"none": 0, "low": 1, "moderate": 3, "high": 6}

QT_POINTS = {"known": 3, "possible": 2, "conditional": 1, "none": 0}

RISK_NODES = {
    "qt": ("risk_qt", "QT prolongation"),
    "anticholinergic": ("risk_anticholinergic", "Anticholinergic burden"),
    "bleeding": ("risk_bleeding", "Bleeding"),
}

EFFECT_PHRASE = {
    "increased_levels": "can raise blood levels of",
    "decreased_levels": "can lower blood levels of",
    "reduced_activation": "can reduce activation of",
}


@lru_cache(maxsize=1)
def _drugs() -> dict[str, dict]:
    # Read-only shared copy; never mutate it.
    return load_drugs()


def _product_severity(product: int) -> str:
    if product >= 6:
        return "high"
    if product >= 3:
        return "moderate"
    return "low"


def _qt_level(score: int) -> str:
    if score == 0:
        return "none"
    if score <= 3:
        return "low"
    if score <= 5:
        return "moderate"
    return "high"


def _acb_level(score: int) -> str:
    if score == 0:
        return "none"
    if score <= 2:
        return "low"
    return "high"


def _bleeding_level(count: int) -> str:
    return ["none", "low", "moderate"][count] if count < 3 else "high"


def _merge_sources(*lists) -> list[str]:
    out = []
    for lst in lists:
        for s in lst:
            if s not in out:
                out.append(s)
    return out


def _interaction(p: dict, v: dict, enzyme: str, effect: str, severity: str, facts: list[str]) -> dict:
    return {
        "id": f"{p['id']}__{v['id']}__{enzyme}__{effect}",
        "perpetrator": p["id"],
        "victim": v["id"],
        "enzyme": enzyme,
        "effect": effect,
        "severity": severity,
        "facts": facts,
        "sources": _merge_sources(p["sources"], v["sources"]),
    }


def _pair_interactions(p: dict, v: dict) -> list[dict]:
    """All interactions where p is the perpetrator and v the victim."""
    out = []
    v_substrates = {s["enzyme"]: s["sensitivity"] for s in v["substrate_of"]}
    for mode, effect, verb in (("inhibits", "increased_levels", "inhibitor"),
                               ("induces", "decreased_levels", "inducer")):
        for mod in p[mode]:
            enzyme, strength = mod["enzyme"], mod["strength"]
            if enzyme not in v_substrates:
                continue
            sensitivity = v_substrates[enzyme]
            product = STRENGTH_WEIGHT[strength] * SENSITIVITY_WEIGHT[sensitivity]
            severity = _product_severity(product)
            facts = [
                f"{p['name']} is a {strength} {verb} of {enzyme}.",
                f"{v['name']} is a {sensitivity.replace('_', ' ')} substrate of {enzyme}.",
                f"{p['name']} {EFFECT_PHRASE[effect]} {v['name']} via {enzyme}.",
            ]
            if (mode == "inhibits" and strength == "strong"
                    and enzyme in v["contraindicated_with_strong_inhibitor_of"]):
                severity = "contraindicated"
                facts.append(f"{v['name']} is contraindicated with strong {enzyme} inhibitors.")
            if v.get("notes"):
                facts.append(v["notes"])
            out.append(_interaction(p, v, enzyme, effect, severity, facts))
    activation = v.get("activation_enzyme")
    if activation:
        for mod in p["inhibits"]:
            if mod["enzyme"] != activation:
                continue
            strength = mod["strength"]
            facts = [
                f"{v['name']} is a prodrug activated by {activation}.",
                f"{p['name']} is a {strength} inhibitor of {activation}.",
                f"{p['name']} {EFFECT_PHRASE['reduced_activation']} {v['name']} via {activation}.",
            ]
            out.append(_interaction(p, v, activation, "reduced_activation",
                                    PRODRUG_SEVERITY[strength], facts))
    return out


def _meters(drugs: list[dict]) -> dict:
    qt_contrib = [d["id"] for d in drugs if QT_POINTS[d["qt_risk"]] > 0]
    qt_score = sum(QT_POINTS[d["qt_risk"]] for d in drugs)
    acb_contrib = [d["id"] for d in drugs if d["acb_score"] > 0]
    acb_score = sum(d["acb_score"] for d in drugs)
    bleed_contrib = [d["id"] for d in drugs if d["bleeding_risk"]]
    return {
        "qt": {"score": qt_score, "level": _qt_level(qt_score), "contributors": qt_contrib},
        "anticholinergic": {"score": acb_score, "level": _acb_level(acb_score),
                            "contributors": acb_contrib},
        "bleeding": {"score": len(bleed_contrib), "level": _bleeding_level(len(bleed_contrib)),
                     "contributors": bleed_contrib},
    }


def total_risk(interactions: list[dict], meters: dict) -> int:
    return (sum(INTERACTION_POINTS[i["severity"]] for i in interactions)
            + sum(METER_POINTS[m["level"]] for m in meters.values()))


def _max_sev(a: str, b: str) -> str:
    return a if SEVERITY_RANK[a] >= SEVERITY_RANK[b] else b


def _graph(drugs: list[dict], interactions: list[dict], meters: dict):
    nodes, edges = [], []
    enzymes: set[str] = set()
    # Severity of each (drug, enzyme, kind) edge = worst interaction that edge takes part in.
    edge_sev: dict[tuple, str] = {}

    def add_edge(source, target, kind):
        edge_sev.setdefault((source, target, kind), "none")
        enzymes.add(target if kind != "activates" else source)

    for d in drugs:
        nodes.append({"id": d["id"], "label": d["name"], "type": "drug"})
        for s in d["substrate_of"]:
            add_edge(d["id"], s["enzyme"], "substrate")
        for m in d["inhibits"]:
            add_edge(d["id"], m["enzyme"], "inhibits")
        for m in d["induces"]:
            add_edge(d["id"], m["enzyme"], "induces")
        if d.get("activation_enzyme"):
            add_edge(d["activation_enzyme"], d["id"], "activates")

    for i in interactions:
        p, v, e, sev = i["perpetrator"], i["victim"], i["enzyme"], i["severity"]
        p_kind = "induces" if i["effect"] == "decreased_levels" else "inhibits"
        v_key = (e, v, "activates") if i["effect"] == "reduced_activation" else (v, e, "substrate")
        for key in ((p, e, p_kind), v_key):
            edge_sev[key] = _max_sev(edge_sev.get(key, "none"), sev)

    for e in sorted(enzymes):
        nodes.append({"id": e, "label": e, "type": "enzyme"})
    for key, (node_id, label) in RISK_NODES.items():
        nodes.append({"id": node_id, "label": label, "type": "risk"})
        for drug_id in meters[key]["contributors"]:
            edges.append({"source": drug_id, "target": node_id, "kind": "contributes",
                          "severity": meters[key]["level"]})

    enzyme_edges = [{"source": s, "target": t, "kind": k, "severity": sev}
                    for (s, t, k), sev in sorted(edge_sev.items())]
    return nodes, enzyme_edges + edges


def analyze(regimen: list[str]) -> dict:
    """Analyze a regimen of drug ids. See CLAUDE.md for the exact rules and contract."""
    catalog = _drugs()
    seen, known, unknown = [], [], []
    for drug_id in regimen:
        if drug_id in seen:
            continue
        seen.append(drug_id)
        (known if drug_id in catalog else unknown).append(drug_id)

    # Sort internally so every output is independent of input order.
    drugs = [catalog[d] for d in sorted(known)]
    interactions = []
    for p in drugs:
        for v in drugs:
            if p["id"] != v["id"]:
                interactions.extend(_pair_interactions(p, v))
    interactions.sort(key=lambda i: (-SEVERITY_RANK[i["severity"]], i["id"]))

    meters = _meters(drugs)
    nodes, edges = _graph(drugs, interactions, meters)
    return {
        "regimen": seen,
        "nodes": nodes,
        "edges": edges,
        "interactions": interactions,
        "meters": meters,
        "total_risk": total_risk(interactions, meters),
        "unknown_drugs": unknown,
    }
