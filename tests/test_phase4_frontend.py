"""Phase 4: frontend exists and its mock data matches the engine contract."""
import json

from pharmaclash.engine import analyze
from tests.conftest import ROOT


def test_mock_matches_engine(demo):
    path = ROOT / "web" / "public" / "mock" / "analyze_demo.json"
    assert path.exists(), "generate web/public/mock/analyze_demo.json from analyze()"
    mock = json.loads(path.read_text())
    live = analyze(demo["regimen"] + ["nirmatrelvir_ritonavir"])
    assert mock["total_risk"] == live["total_risk"]
    assert {"nodes", "edges", "interactions", "meters"} <= set(mock)


def test_frontend_uses_force_graph():
    pkg = json.loads((ROOT / "web" / "package.json").read_text())
    deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}
    assert any("react-force-graph" in d for d in deps)
