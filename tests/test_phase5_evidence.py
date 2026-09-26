"""Phase 5: TWOSIDES evidence loader and lookup (tested on a small fixture)."""
from pharmaclash.evidence import evidence_for, load_twosides
from tests.conftest import ROOT

FIXTURE = ROOT / "tests" / "fixtures" / "twosides_sample.csv"
COLMAP = {"drug_a": "d1_name", "drug_b": "d2_name", "event": "event",
          "prr": "prr", "reports": "n_reports"}


def idx():
    return load_twosides(FIXTURE, column_map=COLMAP)


def test_lookup_is_symmetric_and_case_insensitive():
    i = idx()
    a = evidence_for(i, "simvastatin", "clarithromycin")
    b = evidence_for(i, "CLARITHROMYCIN", "Simvastatin")
    assert a == b
    assert {e["event"] for e in a} == {"Rhabdomyolysis", "Myalgia"}


def test_sorted_by_prr_and_top_k():
    ev = evidence_for(idx(), "warfarin", "fluconazole", top_k=2)
    assert [e["event"] for e in ev] == ["INR increased", "Haemorrhage"]
    assert set(ev[0]) >= {"event", "prr", "reports"}


def test_missing_pair_returns_empty():
    assert evidence_for(idx(), "pravastatin", "molnupiravir") == []
