"""Audit cold-event proxies without changing fitted models or thresholds."""

from pathlib import Path
import argparse
import json
import sys
import joblib
import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from analytics.predict import enforce_temperature_order, predict_target, reference_metadata
from analytics.schema import FEATURES, WINDOWS
from train import build_samples


def confusion(actual: np.ndarray, predicted: np.ndarray) -> dict:
    tp = int(np.sum(actual & predicted))
    fp = int(np.sum(~actual & predicted))
    fn = int(np.sum(actual & ~predicted))
    tn = int(np.sum(~actual & ~predicted))
    return {"true_positive": tp, "false_positive": fp, "false_negative": fn, "true_negative": tn, "recall": tp / (tp + fn) if tp + fn else None, "precision": tp / (tp + fp) if tp + fp else None, "false_positive_rate": fp / (fp + tn) if fp + tn else None}


def main(work: Path, artifacts: Path, reports: Path):
    data = build_samples(pd.read_csv(work / "daily.csv.gz", parse_dates=["date"]))
    test = data[data.split.eq("test")]
    features = test[FEATURES]
    metadata = reference_metadata(test.issue_date, features)
    predictions = enforce_temperature_order({target: predict_target(joblib.load(artifacts / f"{target}.joblib"), features, metadata) for target in ("temperature_mean", "temperature_min", "temperature_max")})["temperature_min"]
    actual = test.target_temperature_min.to_numpy() <= 0
    report = {"threshold_degC": 0, "definition": "Minimum hourly mean regional 2 m air temperature <= 0 degC; not field ground frost", "threshold_selection": "Fixed before this audit; no test-driven tuning", "groups": {}}
    for spatial in ("known", "unseen"):
        report["groups"][spatial] = {}
        for start, end in WINDOWS:
            mask = test.spatial_split.eq(spatial).to_numpy() & test.lead_start.eq(start).to_numpy() & test.lead_end.eq(end).to_numpy()
            report["groups"][spatial][f"{start}-{end}"] = {
                "count": int(mask.sum()),
                "point_estimate_below_zero": confusion(actual[mask], predictions["mean"][mask] <= 0),
                "seasonal_reference_below_zero": confusion(actual[mask], predictions["reference"][mask, 0] <= 0),
                "lower_interval_below_zero": confusion(actual[mask], predictions["quantiles"][mask, 0] <= 0),
            }
    reports.mkdir(parents=True, exist_ok=True)
    (reports / "cold_proxy.json").write_text(json.dumps(report, indent=2, allow_nan=False))
    print("Recorded cold-proxy misses and false alarms on held-out data", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--work", type=Path, required=True)
    parser.add_argument("--artifacts", type=Path, default=Path(__file__).resolve().parents[1] / "backend/analytics/artifacts")
    parser.add_argument("--reports", type=Path, default=Path(__file__).resolve().parent / "reports")
    args = parser.parse_args()
    main(args.work, args.artifacts, args.reports)
