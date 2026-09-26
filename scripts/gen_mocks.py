"""Generate frontend mock data from the real engine (offline fallback for the demo).

Run from the repo root:  .venv/Scripts/python scripts/gen_mocks.py
Writes web/public/mock/{analyze_demo.json, drugs.json, scenario.json}.
"""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from pharmaclash.api import list_drugs  # noqa: E402
from pharmaclash.engine import analyze  # noqa: E402
from pharmaclash.explain import template_text  # noqa: E402
from pharmaclash.optimizer import optimize  # noqa: E402

OUT = ROOT / "web" / "public" / "mock"


def key(regimen):
    return ",".join(sorted(set(regimen)))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    demo = json.loads((ROOT / "data" / "demo_patient.json").read_text(encoding="utf-8"))
    base = demo["regimen"]
    pax = "nirmatrelvir_ritonavir"

    analyses, optimizations = {}, {}

    def add(reg):
        res = analyze(reg)
        for i in res["interactions"]:
            i["explanation"] = template_text(i)
        analyses[key(reg)] = res

    for reg in (base, base + [pax], base + [pax, "clarithromycin"]):
        add(reg)
        out = optimize(reg, locked=[pax])
        optimizations[key(reg) + "|" + pax] = out
        # Every intermediate state of the animated "fix", swap by swap.
        cur = list(reg)
        for s in out["swaps"]:
            cur = [s["to"] if d == s["from"] else d for d in cur]
            add(cur)

    (OUT / "analyze_demo.json").write_text(json.dumps(analyze(base + [pax]), indent=1), encoding="utf-8")
    (OUT / "drugs.json").write_text(json.dumps(list_drugs(), indent=1), encoding="utf-8")
    (OUT / "scenario.json").write_text(json.dumps(
        {"demo": demo, "analyze": analyses, "optimize": optimizations}), encoding="utf-8")
    print(f"wrote {len(analyses)} analyses, {len(optimizations)} optimizations to {OUT}")


if __name__ == "__main__":
    main()
