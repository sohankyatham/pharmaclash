"""Phase 1: the curated dataset is internally consistent and loads correctly."""
from pharmaclash.data import load_drugs


def test_dataset_is_consistent(raw_data):
    meta = raw_data["meta"]
    enzymes = set(meta["enzymes"])
    sens = set(meta["enums"]["sensitivity"])
    strength = set(meta["enums"]["strength"])
    qt = set(meta["enums"]["qt_risk"])
    ids = [d["id"] for d in raw_data["drugs"]]
    assert len(ids) == len(set(ids)), "duplicate drug ids"
    for d in raw_data["drugs"]:
        assert d["sources"], f"{d['id']} has no sources"
        assert all(s in meta["sources"] for s in d["sources"])
        for s in d["substrate_of"]:
            assert s["enzyme"] in enzymes and s["sensitivity"] in sens
        for i in d["inhibits"] + d["induces"]:
            assert i["enzyme"] in enzymes and i["strength"] in strength
        assert d["qt_risk"] in qt
        assert 0 <= d["acb_score"] <= 3
        for alt in d["alternatives"]:
            assert alt in ids, f"{d['id']} alternative {alt} missing"


def test_load_drugs_returns_dict_by_id(raw_data):
    drugs = load_drugs()
    assert isinstance(drugs, dict)
    assert len(drugs) == len(raw_data["drugs"])
    assert drugs["simvastatin"]["name"] == "Simvastatin"
