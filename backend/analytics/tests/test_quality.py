"""Tests for empirical interval-coverage disclosure."""

import unittest
from analytics.quality import evaluate_metrics


class QualityTests(unittest.TestCase):
    def test_undercoverage_in_either_spatial_split_is_disclosed(self):
        known = {"interval_80_coverage": 0.9, "mae": 1.0, "baseline_mae": 1.1}
        unseen = {"interval_80_coverage": 0.6, "mae": 2.0, "baseline_mae": 1.5}
        metrics = {"temperature_min": {"known": {"1-100": known}, "unseen": {"1-100": unseen}}}
        result = evaluate_metrics(metrics)["temperature_min"]["1-100"]
        self.assertEqual(result["interval_status"], "below_nominal_coverage")
        self.assertEqual(result["unseen_test_mae"], 2.0)


if __name__ == "__main__":
    unittest.main()
