"""Validate trained artifacts against held-out predictions and runtime contracts."""

from pathlib import Path
import argparse
import json
import sys
import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from analytics.predict import Forecaster


def main(artifacts: Path, examples: Path):
    predictor = Forecaster(artifacts)
    history = pd.read_json(examples / "example_history.json")
    expected = json.loads((examples / "example_expected.json").read_text())
    result = predictor.predict(history, expected["planting_date"])
    periods = [*result["periods"], result["whole_period"]]
    assert len(result["periods"]) == 10 and len(periods) == 11
    for target, values in expected["target_mean_values"].items():
        np.testing.assert_allclose([period["conditions"][target]["mean_estimate"] for period in periods], values, rtol=1e-8, atol=1e-8)
    for period in periods:
        conditions = period["conditions"]
        assert conditions["temperature_min"]["mean_estimate"] <= conditions["temperature_mean"]["mean_estimate"] <= conditions["temperature_max"]["mean_estimate"]
        for target, prediction in conditions.items():
            lo, hi = prediction["interval_80"]
            assert lo <= prediction["median_estimate"] <= hi
            if target in ("precipitation", "soil_moisture", "surface_soil_moisture"):
                assert lo >= 0
            if target in {"soil_moisture", "surface_soil_moisture"}:
                assert hi <= 1
        assert conditions["soil_temperature"]["units"] == "degC"
        assert -123.15 < conditions["soil_temperature"]["mean_estimate"] < 106.85
    try:
        predictor.predict(history, str((pd.Timestamp(expected["planting_date"]) + pd.Timedelta(days=1)).date()))
    except ValueError:
        pass
    else:
        raise AssertionError("Stale observations were accepted for a later planting date")
    json.dumps(result, allow_nan=False)
    (examples / "example_outlook.json").write_text(json.dumps(result, indent=2, allow_nan=False))
    print("Artifacts match held-out predictions; horizon, bounds, JSON and stale-input checks passed", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--artifacts", type=Path, default=Path(__file__).resolve().parents[1] / "backend/analytics/artifacts")
    parser.add_argument("--examples", type=Path, required=True)
    args = parser.parse_args()
    main(args.artifacts, args.examples)
