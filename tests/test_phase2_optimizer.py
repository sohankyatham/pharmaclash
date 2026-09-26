"""Phase 2: the optimizer finds a safer regimen within each drug's listed alternatives."""
import time

from pharmaclash.data import load_drugs
from pharmaclash.engine import analyze
from pharmaclash.optimizer import optimize

PAX = "nirmatrelvir_ritonavir"


def test_fix_reduces_risk_and_keeps_locked_drug(demo):
    reg = demo["regimen"] + [PAX]
    out = optimize(reg, locked=[PAX])
    assert out["optimized_risk"] < out["original_risk"]
    assert PAX in out["regimen"]
    assert len(out["regimen"]) == len(reg)
    assert len(set(out["regimen"])) == len(out["regimen"])
    assert "simvastatin" not in out["regimen"]
    assert out["optimized_risk"] == analyze(out["regimen"])["total_risk"]


def test_swaps_only_use_listed_alternatives(demo):
    drugs = load_drugs()
    out = optimize(demo["regimen"] + [PAX], locked=[PAX])
    assert out["swaps"]
    for s in out["swaps"]:
        assert s["to"] in drugs[s["from"]]["alternatives"]
        assert s["reason"]


def test_unresolved_reports_drugs_without_alternatives(demo):
    out = optimize(demo["regimen"] + [PAX], locked=[PAX])
    unresolved = {u["drug"] for u in out["unresolved"]}
    assert {"apixaban", "amlodipine"} <= unresolved


def test_clarithromycin_swapped_for_azithromycin(demo):
    out = optimize(demo["regimen"] + [PAX, "clarithromycin"], locked=[PAX])
    assert "clarithromycin" not in out["regimen"]
    assert "azithromycin" in out["regimen"]


def test_no_contraindicated_after_fix(demo):
    out = optimize(demo["regimen"] + [PAX], locked=[PAX])
    res = analyze(out["regimen"])
    assert all(i["severity"] != "contraindicated" for i in res["interactions"])


def test_safe_regimen_unchanged():
    out = optimize(["metformin", "lisinopril", "pravastatin"])
    assert out["swaps"] == []
    assert sorted(out["regimen"]) == sorted(["metformin", "lisinopril", "pravastatin"])


def test_deterministic_and_fast(demo):
    reg = demo["regimen"] + [PAX, "clarithromycin"]
    t = time.time()
    a = optimize(reg, locked=[PAX])
    assert time.time() - t < 2.0
    assert a == optimize(reg, locked=[PAX])
