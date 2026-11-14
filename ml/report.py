"""Render held-out evaluation metrics as a compact Markdown report."""

from pathlib import Path
import argparse
import json


def main(reports: Path):
    metrics = json.loads((reports / "metrics.json").read_text())
    selection = json.loads((reports / "validation_selection.json").read_text())
    splits = json.loads((reports / "splits.json").read_text())
    provenance = json.loads((reports / "data_provenance.json").read_text())
    lines = ["# Held-out evaluation", "", f"Source period: {provenance['first_date']}–{provenance['last_date']}; {provenance['days']} days, {len(provenance['locations'])} regional locations.", "", "The test period starts in 2025. Model/window selection and interval expansion use validation data only. Full 100-day labels are purged at temporal split boundaries. A quarter of sampled locations is held out from training and validation.", "", "| Split | Rows | First issue | Last issue | Last label | Locations |", "|---|---:|---|---|---|---:|"]
    for split, values in splits.items():
        lines.append(f"| {split} | {values['rows']} | {values['issue_start']} | {values['issue_end']} | {values['last_label_date']} | {values['locations']} |")
    for spatial in ("known", "unseen"):
        lines.extend(["", f"## {spatial.capitalize()} locations", "", "Errors retain target units: degC, mm, or m3/m3. Improvement is relative to the training-only seasonal reference; negative values indicate degradation. Coverage is empirical for the nominal 80% interval.", "", "| Target | Lead days | MAE | Reference MAE | Improvement | Coverage | Interval width |", "|---|---|---:|---:|---:|---:|---:|"])
        for target, values in metrics.items():
            for window in ("1-10", "91-100", "1-100"):
                item = values[spatial][window]
                improvement = 100 * (1 - item["mae"] / item["baseline_mae"]) if item["baseline_mae"] else 0
                lines.append(f"| {target} | {window} | {item['mae']:.4f} | {item['baseline_mae']:.4f} | {improvement:.1f}% | {item['interval_80_coverage']:.1%} | {item['interval_80_mean_width']:.4f} |")
    lines.extend(["", "## Validation selection", "", "| Target | Gradient boosting windows | Seasonal reference windows |", "|---|---:|---:|"])
    for target, windows in selection.items():
        ml_count = sum(item["selected"] == "hist_gradient_boosting" for item in windows.values())
        lines.append(f"| {target} | {ml_count} | {len(windows) - ml_count} |")
    cold_path = reports / "cold_proxy.json"
    if cold_path.exists():
        cold = json.loads(cold_path.read_text())
        lines.extend(["", "## Cold-event proxy", "", "The event is a regional hourly mean air-temperature minimum at or below 0 degC. It is not a field-frost label. Forecast windows overlap; these counts are not independent weather events.", "", "| Locations | Lead days | Rule | Misses | False alarms | Recall | Precision |", "|---|---|---|---:|---:|---:|---:|"])
        for spatial, windows in cold["groups"].items():
            for window in ("1-10", "1-100"):
                for rule in ("point_estimate_below_zero", "seasonal_reference_below_zero", "lower_interval_below_zero"):
                    item = windows[window][rule]
                    recall = f"{item['recall']:.1%}" if item["recall"] is not None else "n/a"
                    precision = f"{item['precision']:.1%}" if item["precision"] is not None else "n/a"
                    lines.append(f"| {spatial} | {window} | {rule} | {item['false_negative']} | {item['false_positive']} | {recall} | {precision} |")
    lines.extend(["", "## Limits", "", "These are retrospective regional outlook experiments without external weather or seasonal forecast inputs. Publication latency was not reconstructed. The small number of annual cycles, overlapping forecast windows, product changes and limited spatial holdout prevent claims of operational 100-day forecast skill. Temperature extremes represent extrema of hourly mean air temperature, not ground frost. Source rasters and observation examples remain outside the repository. Full per-window metrics, pinball losses, cold-subset errors and provenance are in the accompanying JSON files.", ""])
    (reports / "README.md").write_text("\n".join(lines))
    print("Rendered held-out evaluation report", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--reports", type=Path, default=Path(__file__).resolve().parent / "reports")
    args = parser.parse_args()
    main(args.reports)
