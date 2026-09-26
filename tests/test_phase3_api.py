"""Phase 3: HTTP API and grounded explanations."""
from fastapi.testclient import TestClient

from pharmaclash.api import app

client = TestClient(app)
PAX = "nirmatrelvir_ritonavir"


def test_list_drugs():
    r = client.get("/api/drugs")
    assert r.status_code == 200
    items = r.json()
    assert len(items) >= 30
    assert {"id", "name", "class"} <= set(items[0])


def test_analyze_endpoint(demo):
    r = client.post("/api/analyze", json={"regimen": demo["regimen"] + [PAX]})
    assert r.status_code == 200
    body = r.json()
    assert {"nodes", "edges", "interactions", "meters", "total_risk"} <= set(body)


def test_optimize_endpoint(demo):
    r = client.post("/api/optimize", json={"regimen": demo["regimen"] + [PAX], "locked": [PAX]})
    assert r.status_code == 200
    assert r.json()["optimized_risk"] < r.json()["original_risk"]


def test_bad_payload_is_422():
    assert client.post("/api/analyze", json={"wrong": 1}).status_code == 422


def test_explain_template_mode_without_key(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    r = client.post("/api/explain", json={"regimen": ["simvastatin", PAX]})
    assert r.status_code == 200
    body = r.json()
    assert body["mode"] == "template"
    assert body["explanations"]
    for e in body["explanations"]:
        text = e["text"].lower()
        assert "simvastatin" in text
        assert ("paxlovid" in text) or ("nirmatrelvir" in text)
        assert e["sources"]
