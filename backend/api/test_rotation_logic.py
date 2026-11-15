from copy import deepcopy
from django.test import SimpleTestCase
from analytics.crops import catalogue
from .example_field import example_data
from .rotation import candidate_result, soil_context


class RotationLogicTests(SimpleTestCase):
    def setUp(self):
        self.field, _ = example_data()
        self.crop = next(row for row in catalogue() if row['name'] == 'Wheat')
        self.climate = {'available': False}

    def test_soil_priority_changes_rotation_ranking_without_promising_yield(self):
        sector = self.field['sectors'][0]
        self.crop = next(row for row in catalogue() if row['name'] == 'Broccoli')
        lower = candidate_result(self.crop, self.field, sector, self.climate)
        changed = deepcopy(self.field)
        changed['farm_profile']['goals']['soilHealth'] = 100
        higher = candidate_result(self.crop, changed, sector, self.climate)
        self.assertGreater(higher['ranking_score'], lower['ranking_score'])
        effects = {item['goal']: item for item in higher['goal_effects']}
        self.assertEqual(effects['soilHealth']['weight'], 100)
        self.assertIn('healthier soil is not guaranteed', effects['soilHealth']['text'])
        self.assertEqual(effects['water']['status'], 'unknown')
        self.assertIn('cannot tell yet', effects['water']['text'])

    def test_longer_crop_cycle_is_disclosed(self):
        crop = {**self.crop, 'growth_days': {'min': 110, 'max': 200}}
        result = candidate_result(crop, self.field, self.field['sectors'][0], self.climate)
        self.assertTrue(any('beyond the 100-day' in item for item in result['checks_needed']))
        self.assertTrue(any('Weather has not been checked' in item for item in result['checks_needed']))

    def test_archived_soil_estimates_are_not_current_planting_inputs(self):
        period = {'start_date': '2026-10-02', 'end_date': '2026-10-11', 'conditions': {'soil_temperature': {'mean_estimate': 20, 'units': 'degC'}, 'surface_soil_moisture': {'mean_estimate': .2, 'units': 'm3 m-3'}}}
        result = soil_context({'available': False, 'last_model_run': {'prediction': {'periods': [period]}}})
        self.assertTrue(result['available'])
        self.assertFalse(result['current'])
        self.assertEqual(result['conditions']['soil_temperature']['mean_estimate'], 20)
        self.assertEqual(result['start_date'], '2026-10-02')
