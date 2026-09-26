"""Regimen optimizer: exhaustive search over each drug's listed alternatives."""
from itertools import product

from pharmaclash.engine import METER_POINTS, SEVERITY_RANK, _drugs, analyze

METER_LABELS = {"qt": "QT", "anticholinergic": "anticholinergic", "bleeding": "bleeding"}


def _dedupe(regimen: list[str]) -> list[str]:
    out = []
    for d in regimen:
        if d not in out:
            out.append(d)
    return out


def _swap_reason(old: str, new: str, before: dict, after: dict) -> str:
    """Short factual reason, derived only from computed interactions and meters."""
    parts = []
    # Every interaction `old` had in the original regimen is gone once `old` is removed.
    conflicts = {}
    for i in before["interactions"]:
        if old not in (i["perpetrator"], i["victim"]):
            continue
        other = i["victim"] if i["perpetrator"] == old else i["perpetrator"]
        conflicts.setdefault(i["enzyme"], set()).add(other)
    for enzyme in sorted(conflicts):
        parts.append(f"avoids {enzyme} conflict with {', '.join(sorted(conflicts[enzyme]))}")
    for key, label in METER_LABELS.items():
        if old in before["meters"][key]["contributors"] and new not in after["meters"][key]["contributors"]:
            parts.append(f"removes {label} risk contribution")
    if not parts:
        parts.append(f"lowers total regimen risk ({before['total_risk']} -> {after['total_risk']})")
    return "; ".join(parts)


def _unresolved(regimen: list[str], locked: set[str], result: dict) -> list[dict]:
    catalog = _drugs()
    issues: dict[str, list[str]] = {}
    for i in result["interactions"]:
        if SEVERITY_RANK[i["severity"]] < SEVERITY_RANK["moderate"]:
            continue
        for drug, role in ((i["perpetrator"], "perpetrator"), (i["victim"], "victim")):
            other = i["victim"] if role == "perpetrator" else i["perpetrator"]
            issues.setdefault(drug, []).append(
                f"{i['severity']} {i['enzyme']} interaction with {other} ({i['effect']})")
    for key, label in METER_LABELS.items():
        m = result["meters"][key]
        if METER_POINTS[m["level"]] >= METER_POINTS["moderate"]:
            for drug in m["contributors"]:
                issues.setdefault(drug, []).append(f"contributes to {m['level']} {label} risk")
    out = []
    for drug in sorted(issues):
        if drug not in catalog:
            continue
        if drug in locked:
            why = "locked"
        elif not catalog[drug]["alternatives"]:
            why = "no listed alternatives"
        else:
            continue
        out.append({"drug": drug, "issue": "; ".join(issues[drug]) + f" ({why}; clinician review)"})
    return out


def optimize(regimen: list[str], locked: list[str] | None = None) -> dict:
    """Find the minimum-risk regimen where each unlocked drug stays or becomes a listed alternative.

    Tie-break: fewest swaps, then alphabetical (sorted drug ids).
    """
    catalog = _drugs()
    locked_set = set(locked or [])
    original = _dedupe(regimen)
    choices = []
    for d in original:
        if d in catalog and d not in locked_set:
            choices.append([d] + [a for a in catalog[d]["alternatives"] if a in catalog])
        else:
            choices.append([d])

    cache: dict[tuple, int] = {}
    best_key, best = None, None
    for combo in product(*choices):
        if len(set(combo)) != len(combo):
            continue
        canon = tuple(sorted(combo))
        if canon not in cache:
            cache[canon] = analyze(list(combo))["total_risk"]
        swaps = sum(1 for a, b in zip(original, combo) if a != b)
        key = (cache[canon], swaps, canon)
        if best_key is None or key < best_key:
            best_key, best = key, list(combo)

    before = analyze(original)
    after = analyze(best)
    swaps = [{"from": a, "to": b, "reason": _swap_reason(a, b, before, after)}
             for a, b in zip(original, best) if a != b]
    return {
        "original_regimen": original,
        "regimen": best,
        "original_risk": before["total_risk"],
        "optimized_risk": after["total_risk"],
        "swaps": swaps,
        "unresolved": _unresolved(best, locked_set, after),
    }
