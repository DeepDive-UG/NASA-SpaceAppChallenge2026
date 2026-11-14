from unittest import TestCase

from analytics.crops import screen_temperature, search_crops


class CropScreenTests(TestCase):
    def setUp(self):
        self.crop = {"id": "okra", "source": {"file": "test", "line": 2}, "temperature_c": {"optimal_min": 20, "optimal_max": 30, "absolute_min": 12, "absolute_max": 35}}

    def outlook(self, temperature):
        return {"status": "experimental_historical_outlook", "whole_period": {"conditions": {"temperature_mean": {"mean_estimate": temperature, "units": "degC"}}}}

    def test_real_catalogue_finds_exact_okra_alias_first(self):
        self.assertEqual(search_crops("okra")[0]["scientific_name"], "Abelmoschus esculentus")

    def test_missing_outlook_cannot_be_green(self):
        self.assertEqual(screen_temperature(self.crop, None)["status"], "amber")

    def test_matching_average_is_not_planting_safety(self):
        result = screen_temperature(self.crop, self.outlook(25))
        self.assertEqual(result["status"], "amber")
        self.assertEqual(result["economic_profitability"], "not_assessed")

    def test_outside_ecological_average_range_is_mismatch(self):
        self.assertEqual(screen_temperature(self.crop, self.outlook(8))["status"], "red")

    def test_invalid_descriptor_order_is_flagged(self):
        self.crop["temperature_c"]["optimal_min"] = 50
        self.assertEqual(screen_temperature(self.crop, self.outlook(25))["label"], "More information needed")
