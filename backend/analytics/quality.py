"""Held-out evaluation metadata for model consumers."""


def evaluate_metrics(metrics: dict) -> dict:
    report = {}
    for target, results in metrics.items():
        report[target] = {}
        for window, known in results["known"].items():
            unseen = results["unseen"][window]
            coverage_met = min(known["interval_80_coverage"], unseen["interval_80_coverage"]) >= 0.8
            report[target][window] = {
                "interval_status": "empirical_coverage_met" if coverage_met else "below_nominal_coverage",
                "nominal_coverage": 0.8,
                "known_test_coverage": known["interval_80_coverage"],
                "unseen_test_coverage": unseen["interval_80_coverage"],
                "known_test_mae": known["mae"],
                "unseen_test_mae": unseen["mae"],
                "known_test_reference_mae": known["baseline_mae"],
                "unseen_test_reference_mae": unseen["baseline_mae"],
            }
    return report
