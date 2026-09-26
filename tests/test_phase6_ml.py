"""Phase 6: ML pipeline correctness (tested on synthetic data so it runs fast)."""
import json
import random

import numpy as np
import pandas as pd

from ml.features import pair_features
from ml.negatives import sample_negatives
from ml.split import drug_level_split
from ml.train import run


def synthetic(tmp_path, n_drugs=60, n_effects=30, seed=0):
    rng = random.Random(seed)
    drugs = [f"drug{i}" for i in range(n_drugs)]
    effects = [f"e{j}" for j in range(n_effects)]
    profiles = {d: {e: 1.0 for e in effects if rng.random() < 0.25} for d in drugs}
    pos = []
    for i, a in enumerate(drugs):
        for b in drugs[i + 1:]:
            overlap = len(set(profiles[a]) & set(profiles[b]))
            if overlap >= 4:
                pos.append((a, b))
    pairs_csv = tmp_path / "pairs.csv"
    pd.DataFrame(pos, columns=["drug_a", "drug_b"]).to_csv(pairs_csv, index=False)
    prof_json = tmp_path / "profiles.json"
    prof_json.write_text(json.dumps(profiles))
    return drugs, pos, pairs_csv, prof_json


def test_drug_level_split_has_no_leakage():
    rows = [(f"d{i}", f"d{j}", 1) for i in range(30) for j in range(i + 1, 30) if (i + j) % 3 == 0]
    df = pd.DataFrame(rows, columns=["drug_a", "drug_b", "label"])
    train, test, heldout = drug_level_split(df, test_frac=0.2, seed=0)
    train_drugs = set(train.drug_a) | set(train.drug_b)
    assert heldout and not (train_drugs & heldout)
    assert all((a in heldout) or (b in heldout) for a, b in zip(test.drug_a, test.drug_b))


def test_pair_features_symmetric():
    vocab = ["x", "y", "z"]
    a, b = {"x": 1.0, "y": 0.5}, {"y": 1.0, "z": 2.0}
    assert np.allclose(pair_features(a, b, vocab), pair_features(b, a, vocab))


def test_negatives_exclude_positives_and_self_pairs():
    drugs = [f"d{i}" for i in range(20)]
    positives = {frozenset(("d0", "d1")), frozenset(("d2", "d3"))}
    negs = sample_negatives(positives, drugs, n=50, seed=0)
    assert len(negs) == 50
    for a, b in negs:
        assert a != b and frozenset((a, b)) not in positives


def test_train_writes_honest_metrics_and_predictions(tmp_path):
    drugs, pos, pairs_csv, prof_json = synthetic(tmp_path)
    out = tmp_path / "out"
    metrics = run(pairs_csv, prof_json, out, seed=0)
    saved = json.loads((out / "metrics.json").read_text())
    for k in ("auroc", "auprc", "baseline_auroc", "n_train", "n_test"):
        assert k in saved
    assert saved["split"] == "drug_level"
    assert 0.0 <= saved["auroc"] <= 1.0
    assert metrics["auroc"] == saved["auroc"]
    preds = pd.read_csv(out / "predictions.csv")
    assert {"drug_a", "drug_b", "probability"} <= set(preds.columns)
    known = {frozenset(p) for p in pos}
    assert not any(frozenset((a, b)) in known for a, b in zip(preds.drug_a, preds.drug_b))
