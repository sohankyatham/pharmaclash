import json
import pathlib
import sys

import pytest

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


@pytest.fixture(scope="session")
def raw_data():
    return json.loads((ROOT / "data" / "drugs.json").read_text())


@pytest.fixture(scope="session")
def demo():
    return json.loads((ROOT / "data" / "demo_patient.json").read_text())


SEVERITY_ORDER = {"none": 0, "low": 1, "moderate": 2, "high": 3, "contraindicated": 4}
