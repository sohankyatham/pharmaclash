"""Phase 1: the rules engine follows the rules in CLAUDE.md."""
from pharmaclash.engine import analyze
from tests.conftest import SEVERITY_ORDER


def find(res, perp, victim, effect=None):
    return [i for i in res["interactions"]
            if i["perpetrator"] == perp and i["victim"] == victim
            and (effect is None or i["effect"] == effect)]


def test_paxlovid_simvastatin_is_contraindicated():
    res = analyze(["simvastatin", "nirmatrelvir_ritonavir"])
    hits = find(res, "nirmatrelvir_ritonavir", "simvastatin")
    assert hits and hits[0]["enzyme"] == "CYP3A4"
    assert hits[0]["severity"] == "contraindicated"
    assert hits[0]["effect"] == "increased_levels"
    assert hits[0]["sources"]


def test_paxlovid_apixaban_is_high():
    res = analyze(["apixaban", "nirmatrelvir_ritonavir"])
    hits = find(res, "nirmatrelvir_ritonavir", "apixaban")
    assert hits and hits[0]["severity"] == "high"


def test_paxlovid_amlodipine_is_moderate():
    res = analyze(["amlodipine", "nirmatrelvir_ritonavir"])
    hits = find(res, "nirmatrelvir_ritonavir", "amlodipine")
    assert hits and hits[0]["severity"] == "moderate"


def test_omeprazole_citalopram_is_moderate_2c19():
    res = analyze(["omeprazole", "citalopram"])
    hits = find(res, "omeprazole", "citalopram")
    assert hits and hits[0]["enzyme"] == "CYP2C19" and hits[0]["severity"] == "moderate"


def test_prodrug_activation_is_reduced():
    res = analyze(["clopidogrel", "omeprazole"])
    hits = find(res, "omeprazole", "clopidogrel", "reduced_activation")
    assert hits and hits[0]["severity"] == "moderate"


def test_no_self_interaction():
    res = analyze(["clarithromycin"])
    assert res["interactions"] == []


def test_pravastatin_avoids_paxlovid_conflict():
    res = analyze(["pravastatin", "nirmatrelvir_ritonavir"])
    assert res["interactions"] == []


def test_qt_stacking():
    two = analyze(["citalopram", "clarithromycin"])["meters"]["qt"]
    three = analyze(["citalopram", "clarithromycin", "ondansetron"])["meters"]["qt"]
    assert two["score"] == 6 and two["level"] == "high"
    assert three["score"] > two["score"]
    assert set(two["contributors"]) == {"citalopram", "clarithromycin"}


def test_anticholinergic_meter():
    m = analyze(["oxybutynin"])["meters"]["anticholinergic"]
    assert m["score"] == 3 and m["level"] == "high"
    assert analyze(["metformin"])["meters"]["anticholinergic"]["level"] == "none"


def test_bleeding_meter():
    m = analyze(["apixaban", "citalopram"])["meters"]["bleeding"]
    assert m["score"] == 2 and m["level"] == "moderate"
    assert analyze(["apixaban", "citalopram", "aspirin_low_dose"])["meters"]["bleeding"]["level"] == "high"


def test_unknown_drug_does_not_crash():
    res = analyze(["simvastatin", "not_a_real_drug"])
    assert res["unknown_drugs"] == ["not_a_real_drug"]


def test_order_independent_total_risk(demo):
    reg = demo["regimen"] + ["nirmatrelvir_ritonavir"]
    assert analyze(reg)["total_risk"] == analyze(list(reversed(reg)))["total_risk"]


def test_adding_paxlovid_increases_risk(demo):
    base = analyze(demo["regimen"])["total_risk"]
    worse = analyze(demo["regimen"] + ["nirmatrelvir_ritonavir"])["total_risk"]
    assert worse > base


def test_graph_contract(demo):
    res = analyze(demo["regimen"] + ["nirmatrelvir_ritonavir"])
    node_ids = {n["id"] for n in res["nodes"]}
    for d in demo["regimen"]:
        assert d in node_ids
    assert "CYP3A4" in node_ids
    for e in res["edges"]:
        assert e["source"] in node_ids and e["target"] in node_ids
        assert e["severity"] in SEVERITY_ORDER
    for key in ("qt", "anticholinergic", "bleeding"):
        assert set(res["meters"][key]) >= {"score", "level", "contributors"}
