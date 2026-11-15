"""Tests for causal features, horizon labels, and input contracts."""

import unittest
import numpy as np
import pandas as pd
from analytics.features import feature_table, future_target, inference_features
from analytics.schema import FEATURES, OBSERVATIONS, WINDOWS


def sample_history(days=160):
    data = pd.DataFrame({"date": pd.date_range("2023-01-01", periods=days), "latitude": 36.5, "longitude": -120.0})
    for column in OBSERVATIONS:
        data[column] = np.arange(days, dtype=float) / 1000 + 0.2
    data["temperature_mean_c"] = 15.0
    data["temperature_min_c"] = 8.0
    data["temperature_max_c"] = 22.0
    data["soil_temperature_k"] = 285.0
    return data


class FeatureTests(unittest.TestCase):
    def test_soil_temperature_target_converts_kelvin_without_changing_inputs(self):
        values = pd.Series([273.15, 283.15, 293.15, 303.15])
        result = future_target(values, 1, 2, "mean", offset=-273.15)
        self.assertAlmostEqual(result.iloc[0], 15.0)
        self.assertAlmostEqual(result.iloc[1], 25.0)
        self.assertTrue(np.isnan(result.iloc[2]))
        self.assertAlmostEqual(values.iloc[0], 273.15)

    def test_future_observations_do_not_change_past_features(self):
        history = sample_history()
        expected = feature_table(history).iloc[50]
        changed = history.copy()
        changed.loc[changed.index > 50, OBSERVATIONS] = 999.0
        pd.testing.assert_series_equal(expected, feature_table(changed).iloc[50])

    def test_target_windows_exclude_issue_day(self):
        values = pd.Series(np.arange(150, dtype=float))
        self.assertEqual(future_target(values, 1, 10, "mean").iloc[0], 5.5)
        self.assertEqual(future_target(values, 91, 100, "min").iloc[0], 91)
        self.assertEqual(future_target(values, 1, 100, "max").iloc[0], 100)
        self.assertEqual(future_target(values, 1, 100, "sum").iloc[0], 5050)

    def test_incomplete_target_window_is_missing(self):
        values = pd.Series(np.arange(150, dtype=float))
        values.iloc[5] = np.nan
        self.assertTrue(np.isnan(future_target(values, 1, 10, "sum").iloc[0]))
        self.assertTrue(np.isnan(future_target(values, 1, 100, "mean").iloc[-1]))

    def test_training_and_inference_features_match(self):
        from analytics.features import add_window
        history = sample_history(60)
        issue, actual = inference_features(history)
        base = feature_table(history).tail(1)
        expected = pd.concat([add_window(base, start, end) for start, end in WINDOWS], ignore_index=True)
        pd.testing.assert_frame_equal(actual, expected)
        self.assertEqual(list(actual.columns), FEATURES)
        self.assertEqual(issue, history.date.iloc[-1])

    def test_missing_dates_are_not_silently_interpolated(self):
        with self.assertRaisesRegex(ValueError, "consecutive"):
            inference_features(sample_history(31).drop(index=15))

    def test_kelvin_air_temperature_is_rejected(self):
        history = sample_history(30)
        history["temperature_mean_c"] = 290
        with self.assertRaisesRegex(ValueError, "Celsius"):
            inference_features(history)

    def test_moisture_percentage_is_rejected(self):
        history = sample_history(30)
        history["rootzone_moisture"] = 25
        with self.assertRaisesRegex(ValueError, "m3/m3"):
            inference_features(history)


if __name__ == "__main__":
    unittest.main()
