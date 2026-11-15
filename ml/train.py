"""Train and evaluate direct 100-day regional environmental outlook models."""

from pathlib import Path
import argparse
import hashlib
import importlib.metadata
import json
import platform
import sys
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_pinball_loss
from threadpoolctl import threadpool_limits

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from analytics.baseline import SeasonalBaseline
from analytics.features import add_window, feature_table, future_target
from analytics.predict import enforce_temperature_order, physical_bounds, predict_target, reference_metadata
from analytics.schema import FEATURES, OBSERVATIONS, SCHEMA_VERSION, TARGETS, WINDOWS


def write_json(path: Path, value):
    path.write_text(json.dumps(value, indent=2, allow_nan=False))


def build_samples(daily: pd.DataFrame):
    frames = []
    for cell, history in daily.groupby("cell"):
        history = history.sort_values("date").set_index("date").asfreq("D").reset_index()
        features = feature_table(history)
        source = history.set_index("date")
        eligible = features.notna().all(axis=1)
        eligible &= (features.index.dayofyear % 7 == 0)
        complete_future = pd.Series(True, index=features.index)
        for specification in TARGETS.values():
            complete_future &= source[specification["column"]].shift(-1).iloc[::-1].rolling(100, min_periods=100).count().iloc[::-1].eq(100)
        eligible &= complete_future
        for start, end in WINDOWS:
            frame = add_window(features, start, end)
            for target, specification in TARGETS.items():
                frame[f"target_{target}"] = future_target(source[specification["column"]], start, end, specification["aggregation"], specification.get("offset", 0))
            frame = frame.loc[eligible].dropna()
            frame["issue_date"] = frame.index
            frame["label_end"] = frame.index + pd.Timedelta(days=100)
            frame["cell"] = cell
            frame["spatial_split"] = history["spatial_split"].dropna().iloc[0]
            frames.append(frame.reset_index(drop=True))
    data = pd.concat(frames, ignore_index=True)
    data["split"] = "excluded"
    data.loc[(data.issue_date < "2024-01-01") & (data.label_end < "2024-01-01") & data.spatial_split.eq("known"), "split"] = "train"
    data.loc[(data.issue_date >= "2024-01-01") & (data.label_end < "2025-01-01") & data.spatial_split.eq("known"), "split"] = "validation"
    data.loc[data.issue_date >= "2025-01-01", "split"] = "test"
    train = data[data.split.eq("train")]
    validation = data[data.split.eq("validation")]
    test = data[data.split.eq("test")]
    if min(len(train), len(validation), len(test)) < 1000:
        raise RuntimeError("Insufficient data for chronological evaluation")
    if train.label_end.max() >= validation.issue_date.min() or validation.label_end.max() >= test.issue_date.min():
        raise AssertionError("Future labels overlap a later evaluation split")
    if set(train.cell) & set(test.loc[test.spatial_split.eq("unseen"), "cell"]):
        raise AssertionError("Spatial holdout locations occur in training")
    return data


def metric_set(y, result, reference):
    y = np.asarray(y)
    mean, quantiles = result["mean"], result["quantiles"]
    return {"count": len(y), "mae": float(np.mean(np.abs(y - mean))), "rmse": float(np.sqrt(np.mean((y - mean) ** 2))), "bias": float(np.mean(mean - y)), "baseline_mae": float(np.mean(np.abs(y - reference[:, 0]))), "interval_80_coverage": float(np.mean((y >= quantiles[:, 0]) & (y <= quantiles[:, 2]))), "interval_80_mean_width": float(np.mean(quantiles[:, 2] - quantiles[:, 0])), "pinball_loss": {str(q): float(mean_pinball_loss(y, quantiles[:, i], alpha=q)) for i, q in enumerate((0.1, 0.5, 0.9))}}


def main(work: Path, artifacts: Path, report_directory: Path, targets=None, examples=None):
    artifacts.mkdir(parents=True, exist_ok=True)
    report_directory.mkdir(parents=True, exist_ok=True)
    daily = pd.read_csv(work / "daily.csv.gz", parse_dates=["date"])
    manifest = json.loads((work / "data_manifest.json").read_text())
    data = build_samples(daily)
    train = data[data.split.eq("train")]
    validation = data[data.split.eq("validation")]
    test = data[data.split.eq("test")]
    xtrain, xvalidation, xtest = (frame[FEATURES] for frame in (train, validation, test))
    mtrain, mvalidation, mtest = (reference_metadata(frame.issue_date, frame[FEATURES]) for frame in (train, validation, test))
    targets = set(TARGETS) if targets is None else set(targets)
    if not targets or not targets <= set(TARGETS):
        raise ValueError("Choose supported training targets")
    previous_manifest = json.loads((artifacts / "manifest.json").read_text()) if targets != set(TARGETS) else None
    if previous_manifest and (previous_manifest["features"] != FEATURES or previous_manifest["source_manifest_sha256"] != hashlib.sha256((work / "data_manifest.json").read_bytes()).hexdigest()):
        raise RuntimeError("Reused artifacts must have identical features and source data")
    previous_comparison = json.loads((report_directory / "validation_selection.json").read_text()) if previous_manifest else {}
    arguments = dict(max_iter=120, max_leaf_nodes=15, min_samples_leaf=40, learning_rate=0.05, l2_regularization=1, early_stopping=False, random_state=42)
    predictions = {}
    candidate_report = {}
    all_bundles = {}
    for target in TARGETS:
        if target not in targets:
            if previous_manifest["targets"][target] != TARGETS[target]:
                raise RuntimeError(f"Reused target definition changed: {target}")
            artifact = previous_manifest["artifacts"][target]
            path = artifacts / artifact["file"]
            if hashlib.sha256(path.read_bytes()).hexdigest() != artifact["sha256"]:
                raise RuntimeError(f"Reused model checksum mismatch: {target}")
            restored = joblib.load(path)
            predictions[target] = predict_target(restored, xtest, mtest)
            candidate_report[target] = previous_comparison[target]
            all_bundles[target] = restored
            print(f"Reused verified artifact: {target}", flush=True)
            continue
        ytrain = train[f"target_{target}"].to_numpy()
        yvalidation = validation[f"target_{target}"].to_numpy()
        baseline = SeasonalBaseline().fit(mtrain, ytrain)
        reference = baseline.predict(mvalidation)
        arguments = dict(max_iter=120, max_leaf_nodes=15, min_samples_leaf=40, learning_rate=0.05, l2_regularization=1, early_stopping=False, random_state=42)
        print(f"Training {target}: {len(train)} training rows", flush=True)
        with threadpool_limits(limits=4):
            mean_model = HistGradientBoostingRegressor(loss="squared_error", **arguments).fit(xtrain, ytrain)
            quantile_models = {str(q): HistGradientBoostingRegressor(loss="quantile", quantile=q, **arguments).fit(xtrain, ytrain) for q in (0.1, 0.5, 0.9)}
            predicted_mean = physical_bounds(target, mean_model.predict(xvalidation))
            predicted_quantiles = physical_bounds(target, np.sort(np.column_stack([quantile_models[str(q)].predict(xvalidation) for q in (0.1, 0.5, 0.9)]), axis=1))
        selection, adjustment, comparison = {}, {}, {}
        for start, end in WINDOWS:
            key = f"{start}-{end}"
            mask = validation.lead_start.eq(start).to_numpy() & validation.lead_end.eq(end).to_numpy()
            y = yvalidation[mask]
            model_mae = float(mean_absolute_error(y, predicted_mean[mask]))
            baseline_mae = float(mean_absolute_error(y, reference[mask, 0]))
            selection[key] = "hist_gradient_boosting" if model_mae < baseline_mae else "seasonal_baseline"
            bands = predicted_quantiles[mask] if selection[key] == "hist_gradient_boosting" else reference[mask, 1:4]
            scores = np.maximum(bands[:, 0] - y, y - bands[:, 2])
            adjustment[key] = max(0.0, float(np.quantile(scores, 0.8, method="higher")))
            comparison[key] = {"validation_rows": int(mask.sum()), "model_mae": model_mae, "baseline_mae": baseline_mae, "selected": selection[key], "interval_expansion": adjustment[key]}
        bundle = {"target": target, "schema_version": SCHEMA_VERSION, "feature_names": FEATURES, "mean_model": mean_model, "quantile_models": quantile_models, "baseline": baseline, "selection": selection, "interval_adjustment": adjustment}
        path = artifacts / f"{target}.joblib"
        joblib.dump(bundle, path, compress=3)
        restored = joblib.load(path)
        with threadpool_limits(limits=4):
            np.testing.assert_allclose(restored["mean_model"].predict(xtest.head(16)), mean_model.predict(xtest.head(16)))
        predictions[target] = predict_target(restored, xtest, mtest)
        candidate_report[target] = comparison
        all_bundles[target] = restored
        print(f"Saved {target}; ML selected in {sum(method == 'hist_gradient_boosting' for method in selection.values())}/{len(WINDOWS)} windows", flush=True)
    predictions = enforce_temperature_order(predictions)
    metrics = {}
    for target, result in predictions.items():
        target_metrics = {}
        y = test[f"target_{target}"].to_numpy()
        for spatial_split in ("known", "unseen"):
            target_metrics[spatial_split] = {}
            for start, end in WINDOWS:
                mask = test.spatial_split.eq(spatial_split).to_numpy() & test.lead_start.eq(start).to_numpy() & test.lead_end.eq(end).to_numpy()
                if not mask.any():
                    continue
                subset = {"mean": result["mean"][mask], "quantiles": result["quantiles"][mask]}
                target_metrics[spatial_split][f"{start}-{end}"] = metric_set(y[mask], subset, result["reference"][mask])
        if target == "temperature_min":
            cold = y <= 0
            target_metrics["cold_subset"] = {"definition": "Observed minimum hourly mean regional 2 m air temperature <= 0 degC; not field frost", "count": int(cold.sum()), "mae": float(np.mean(np.abs(y[cold] - result["mean"][cold]))) if cold.any() else None}
        metrics[target] = target_metrics
    versions = {name: importlib.metadata.version(name) for name in ("numpy", "pandas", "scikit-learn", "scipy", "joblib", "threadpoolctl")}
    metadata = {"schema_version": SCHEMA_VERSION, "model_version": "california-100d-v2", "python_version": platform.python_version(), "dependencies": versions, "features": FEATURES, "windows": WINDOWS, "targets": TARGETS, "data_start": manifest["first_date"], "data_end": manifest["last_date"], "source_versions": manifest["source_versions"], "publication_latency_reconstructed": False, "forecast_inputs_used": False, "landfire_used": False, "source_manifest_sha256": hashlib.sha256((work / "data_manifest.json").read_bytes()).hexdigest(), "artifacts": {target: {"file": f"{target}.joblib", "sha256": hashlib.sha256((artifacts / f"{target}.joblib").read_bytes()).hexdigest()} for target in TARGETS}}
    metadata["target_training"] = {target: {"trained_in_this_run": target in targets, "artifact_model_version": "california-100d-v2" if target in targets else previous_manifest.get("target_training", {}).get(target, {}).get("artifact_model_version", previous_manifest["model_version"])} for target in TARGETS}
    write_json(artifacts / "manifest.json", metadata)
    write_json(report_directory / "metrics.json", metrics)
    write_json(report_directory / "validation_selection.json", candidate_report)
    write_json(report_directory / "splits.json", {split: {"rows": len(frame), "issue_start": str(frame.issue_date.min().date()), "issue_end": str(frame.issue_date.max().date()), "last_label_date": str(frame.label_end.max().date()), "locations": int(frame.cell.nunique())} for split, frame in (("train", train), ("validation", validation), ("test", test))})
    write_json(report_directory / "data_provenance.json", manifest)
    write_json(report_directory / "training_config.json", {"seed": 42, "issue_sampling": "One UTC issue date per seven days", "horizon_days": 100, "history_days": 30, "model_parameters": arguments, "selection": "Validation MAE per target and forecast window; no test-driven selection", "intervals": "Quantiles 0.1, 0.5, 0.9 with nonnegative validation residual expansion; correlated windows and distribution shift preclude a finite-sample coverage guarantee", "spatial_holdout": "25% of sampled MERRA-2 cells never enter training or validation", "temperature_postprocessing": "Minimum <= mean <= maximum, applied to point estimates and corresponding quantiles", "inputs": "Observed daily environmental conditions and calendar only; no future weather forecasts or LANDFIRE layers"})
    example_directory = examples or work / "validation"
    example_directory.mkdir(parents=True, exist_ok=True)
    example_cell = int(test[test.spatial_split.eq("known")].cell.iloc[0])
    issue_date = test[(test.cell == example_cell)].issue_date.iloc[0]
    example = daily[(daily.cell == example_cell) & (daily.date <= issue_date)].sort_values("date").tail(30)
    example[["date", "latitude", "longitude", *OBSERVATIONS]].to_json(example_directory / "example_history.json", orient="records", date_format="iso", indent=2)
    expected = test[(test.cell == example_cell) & (test.issue_date == issue_date)]
    write_json(example_directory / "example_expected.json", {"issue_date": str(issue_date.date()), "planting_date": str((issue_date + pd.Timedelta(days=1)).date()), "target_mean_values": {target: predictions[target]["mean"][test.index.get_indexer(expected.index)].tolist() for target in TARGETS}})
    print("Training, serialization and held-out evaluation completed", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--work", type=Path, required=True)
    parser.add_argument("--artifacts", type=Path, default=Path(__file__).resolve().parents[1] / "backend/analytics/artifacts")
    parser.add_argument("--targets", nargs="+", choices=list(TARGETS))
    parser.add_argument("--examples", type=Path)
    parser.add_argument("--reports", type=Path, default=Path(__file__).resolve().parent / "reports")
    args = parser.parse_args()
    main(args.work, args.artifacts, args.reports, args.targets, args.examples)
