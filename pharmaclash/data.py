"""Loading the curated drug dataset."""
import copy
import json
import pathlib
from functools import lru_cache

DATA_DIR = pathlib.Path(__file__).resolve().parents[1] / "data"
DRUGS_PATH = DATA_DIR / "drugs.json"


@lru_cache(maxsize=1)
def _load_raw() -> dict:
    return json.loads(DRUGS_PATH.read_text(encoding="utf-8"))


def load_meta() -> dict:
    """Return the dataset's `meta` block (enzymes, enums, source descriptions)."""
    return copy.deepcopy(_load_raw()["meta"])


def load_drugs() -> dict[str, dict]:
    """Return `{drug_id: drug}` from data/drugs.json (a fresh copy each call)."""
    return {d["id"]: copy.deepcopy(d) for d in _load_raw()["drugs"]}
