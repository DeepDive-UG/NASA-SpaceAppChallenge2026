"""Load versioned local models and generate a 100-day regional outlook."""

from pathlib import Path
import json
import hashlib
import importlib.metadata
import joblib
import numpy as np
import pandas as pd
from threadpoolctl import threadpool_limits
from .features import inference_features
from .schema import FEATURES, SCHEMA_VERSION, TARGETS, WINDOWS


def reference_metadata(issue_dates, features: pd.DataFrame) -> pd.DataFrame:
    dates = pd.DatetimeIndex(issue_dates)
    starts = dates + pd.to_timedelta(features["lead_start"].to_numpy(), unit="D")
    return pd.DataFrame({"latitude": features["latitude"].to_numpy(), "longitude": features["longitude"].to_numpy(), "reference_month": starts.month, "window_days": features["window_days"].to_numpy().astype(int)})


def physical_bounds(target: str, values):
    if target == "precipitation":
        return np.maximum(values, 0)
    if target == "soil_moisture":
        return np.clip(values, 0, 1)
    return np.asarray(values)


def predict_target(bundle: dict, features: pd.DataFrame, metadata: pd.DataFrame) -> dict:
    reference = bundle["baseline"].predict(metadata)
    with threadpool_limits(limits=4):
        mean = bundle["mean_model"].predict(features)
        quantiles = np.column_stack([bundle["quantile_models"][str(q)].predict(features) for q in (0.1, 0.5, 0.9)])
    quantiles = np.sort(quantiles, axis=1)
    for index, row in enumerate(features.itertuples(index=False)):
        key = f"{int(row.lead_start)}-{int(row.lead_end)}"
        if bundle["selection"][key] == "seasonal_baseline":
            mean[index] = reference[index, 0]
            quantiles[index] = reference[index, 1:4]
        adjustment = bundle["interval_adjustment"][key]
        quantiles[index, 0] -= adjustment
        quantiles[index, 2] += adjustment
    return {"mean": physical_bounds(bundle["target"], mean), "quantiles": physical_bounds(bundle["target"], quantiles), "reference": reference}


def enforce_temperature_order(predictions: dict) -> dict:
    mean = predictions["temperature_mean"]
    for field in ("mean", "quantiles"):
        predictions["temperature_min"][field] = np.minimum(predictions["temperature_min"][field], mean[field])
        predictions["temperature_max"][field] = np.maximum(predictions["temperature_max"][field], mean[field])
    return predictions


class Forecaster:
    def __init__(self, model_directory: str | Path | None = None):
        directory = Path(model_directory) if model_directory else Path(__file__).parent / "artifacts"
        self.manifest = json.loads((directory / "manifest.json").read_text())
        if self.manifest["schema_version"] != SCHEMA_VERSION or self.manifest["features"] != FEATURES:
            raise RuntimeError("The model feature schema does not match this analytics package")
        expected_version = self.manifest["dependencies"]["scikit-learn"]
        if importlib.metadata.version("scikit-learn") != expected_version:
            raise RuntimeError(f"Models require scikit-learn {expected_version}")
        for target, artifact in self.manifest["artifacts"].items():
            actual = hashlib.sha256((directory / artifact["file"]).read_bytes()).hexdigest()
            if actual != artifact["sha256"]:
                raise RuntimeError(f"Model checksum mismatch: {target}")
        self.bundles = {target: joblib.load(directory / f"{target}.joblib") for target in TARGETS}

    def predict(self, history: pd.DataFrame, planting_date: str) -> dict:
        issue_date, features = inference_features(history)
        requested_date = pd.Timestamp(planting_date)
        if requested_date.tzinfo is not None or requested_date != requested_date.normalize():
            raise ValueError("Planting date must be a calendar date without a time zone")
        if requested_date != issue_date + pd.Timedelta(days=1):
            raise ValueError("The latest complete observation day must immediately precede the planting date; stale inputs cannot produce a current outlook")
        metadata = reference_metadata([issue_date] * len(features), features)
        predictions = enforce_temperature_order({target: predict_target(bundle, features, metadata) for target, bundle in self.bundles.items()})
        periods = []
        for index, (start, end) in enumerate(WINDOWS):
            period = {"lead_start": start, "lead_end": end, "start_date": str((issue_date + pd.Timedelta(days=start)).date()), "end_date": str((issue_date + pd.Timedelta(days=end)).date()), "conditions": {}}
            for target, specification in TARGETS.items():
                result = predictions[target]
                expected = float(result["mean"][index])
                lo, median, hi = map(float, result["quantiles"][index])
                reference = result["reference"][index]
                period["conditions"][target] = {"mean_estimate": expected, "median_estimate": median, "interval_80": [lo, hi], "units": specification["units"], "seasonal_reference": float(reference[0]), "reference_difference": expected - float(reference[0]), "reference_position": "below" if expected < reference[1] else "above" if expected > reference[3] else "within", "method": self.bundles[target]["selection"][f"{start}-{end}"], "validation": self.manifest.get("quality", {}).get(target, {}).get(f"{start}-{end}", {"interval_status": "not_assessed"})}
            periods.append(period)
        return {"schema_version": self.manifest["schema_version"], "model_version": self.manifest["model_version"], "observation_date": str(issue_date.date()), "planting_date": str(requested_date.date()), "status": "experimental_historical_outlook", "horizon_days": 100, "periods": periods[:-1], "whole_period": periods[-1], "limitations": ["Inputs are retrospective products; source publication latency is not reconstructed.", "No meteorological forecast or seasonal forecast is included.", "Temperature extremes are minima/maxima of hourly mean regional 2 m air temperature, not field frost measurements.", "Anomalies use a short training reference, not a 30-year climate normal.", "Intervals require empirical evaluation and do not establish planting safety."]}
