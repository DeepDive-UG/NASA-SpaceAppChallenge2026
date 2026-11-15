from unittest.mock import patch
from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from analytics.crops import catalogue, FOOD_CROPS
from .field import empty_field


class FieldPlanningTests(TestCase):
    def setUp(self):
        self.field = {**empty_field(), 'name': 'Test field', 'area_ha': 10, 'soil_ph': 6.5}

    def save(self, revision=0):
        return self.client.put('/api/field/', {'field': self.field, 'revision': revision}, content_type='application/json')

    def test_persistence_and_session_isolation(self):
        self.assertEqual(self.save().status_code, 200)
        self.assertEqual(self.client.get('/api/field/').json()['field'], self.field)
        self.assertEqual(Client().get('/api/field/').json()['revision'], 0)

    def test_stale_revision_cannot_overwrite(self):
        self.save()
        self.assertEqual(self.save().status_code, 409)
        self.assertEqual(self.save(revision=1).json()['revision'], 2)

    def test_invalid_area_and_orphan_history(self):
        self.field['sectors'] = [{'id': 'a', 'name': 'A', 'area_ha': 11}]
        self.assertEqual(self.save().status_code, 400)
        self.field['sectors'] = []
        self.field['crop_history'] = [{'id': 'h', 'crop_name': 'Beans', 'year': 2025, 'sector_id': 'missing'}]
        self.assertEqual(self.save().status_code, 400)

    def test_account_ownership_survives_new_session(self):
        self.save()
        user = get_user_model().objects.create_user(username='field-owner', password='test-owner-password')
        self.client.force_login(user)
        self.client.get('/api/field/')
        other = Client()
        other.force_login(user)
        self.assertEqual(other.get('/api/field/').json()['field']['name'], 'Test field')

    @patch('api.rotation.outlook_for', return_value={'available': False, 'reason': 'No current observations.'})
    def test_sourced_soil_mismatch_without_fabricated_weather(self, outlook):
        self.field['soil_ph'] = 14
        self.save()
        crop = next(row for row in catalogue() if row['scientific_name'] in FOOD_CROPS and row['soil_ph']['absolute_max'] is not None and row['soil_ph']['absolute_max'] < 14)
        response = self.client.post('/api/rotation/', {'revision': 1, 'scope': 'whole', 'crop_id': crop['id']}, content_type='application/json')
        self.assertEqual(response.status_code, 200)
        result = response.json()
        candidate = result['groups'][0]['candidates'][0]
        self.assertEqual(candidate['status'], 'red')
        self.assertEqual(candidate['sources'][0]['file'], 'data/EcoCrop_DB.csv')
        self.assertFalse(result['outlook']['available'])
        self.assertTrue(any('not been checked' in warning for warning in candidate['checks_needed']))

    @patch('api.rotation.outlook_for', return_value={'available': False, 'reason': 'No current observations.'})
    def test_mix_uses_sector_history(self, outlook):
        crop = next(row for row in catalogue() if row['scientific_name'] in FOOD_CROPS)
        self.field['sectors'] = [{'id': 'a', 'name': 'A', 'area_ha': 4}, {'id': 'b', 'name': 'B', 'area_ha': 6}]
        self.field['crop_history'] = [{'id': 'h', 'crop_id': crop['id'], 'crop_name': crop['name'], 'year': 2025, 'sector_id': 'a'}]
        self.save()
        response = self.client.post('/api/rotation/', {'revision': 1, 'scope': 'mix', 'sector_ids': ['a', 'b'], 'crop_id': crop['id']}, content_type='application/json')
        groups = response.json()['groups']
        self.assertEqual(len(groups), 2)
        self.assertTrue(any('related crop' in warning for warning in groups[0]['candidates'][0]['checks_needed']))
        self.assertFalse(any('related crop' in warning for warning in groups[1]['candidates'][0]['checks_needed']))
        self.assertTrue(all(group['candidates'][0]['status'] != 'green' for group in groups))

    def test_invalid_json_and_scope(self):
        self.assertEqual(self.client.put('/api/field/', '[]', content_type='application/json').status_code, 400)
        self.save()
        response = self.client.post('/api/rotation/', {'revision': 1, 'scope': 'single', 'sector_ids': ['absent']}, content_type='application/json')
        self.assertEqual(response.status_code, 400)

    def test_csrf_required(self):
        client = Client(enforce_csrf_checks=True)
        self.assertEqual(client.put('/api/field/', {'field': self.field, 'revision': 0}, content_type='application/json').status_code, 403)

class OnboardingIntegrationTests(TestCase):
    def setUp(self):
        self.profile = {
            'consent': True, 'farmLocation': {'lat': 36.7, 'lon': -119.8},
            'defaultSoilClass': 'II', 'originalArea': {'value': 10, 'unit': 'acres'},
            'sectorTemplate': 'Whole field',
            'sectors': [{'id': 'north', 'name': 'North', 'direction': 'N', 'areaHa': 4, 'soilClass': 'III', 'currentCrop': 'Wheat', 'notes': 'Sloping edge'}],
            'cropHistory': {'unknown': False, 'sameForAllSectors': True, 'shared': [{'id': 'season', 'year': 2025, 'crop': 'Corn', 'otherCrop': '', 'fertilizers': ['NPK'], 'amountKgHa': 80, 'yield': '180 bu/ac'}], 'bySector': {}},
            'goals': {'yield': 20, 'soilHealth': 55, 'water': 25},
            'waterSource': {'name': 'Farm well', 'description': '', 'type': 'Well', 'lat': '', 'lon': '', 'address': 'Fresno'},
        }

    def put(self, revision=0):
        return self.client.put('/api/field/', {'revision': revision, 'onboarding_profile': self.profile}, content_type='application/json')

    def test_profile_maps_to_shared_field_without_losing_season_data(self):
        response = self.put()
        self.assertEqual(response.status_code, 200, response.content)
        field = self.client.get('/api/field/').json()['field']
        self.assertAlmostEqual(field['area_ha'], 4.046856422)
        self.assertEqual(field['soil_class'], 'II')
        self.assertEqual(field['sectors'][0]['soil_class'], 'III')
        self.assertEqual(field['sectors'][0]['current_crop'], 'Wheat')
        self.assertEqual(field['farm_profile']['cropHistory']['shared'][0]['yield'], '180 bu/ac')
        self.assertEqual(field['farm_profile']['cropHistory']['shared'][0]['fertilizers'], ['NPK'])
        self.assertEqual(field['goal'], 'soil')
        self.assertEqual(field['farm_profile']['goals'], {**self.profile['goals'], 'profit': 0})
        self.assertTrue(field['crop_history'][0]['crop_id'])
        self.assertEqual(field['fertilisers'], [])

    def test_profit_goal_is_saved_with_other_priorities(self):
        self.profile['goals'] = {'yield': 10, 'soilHealth': 20, 'water': 10, 'profit': 60}
        response = self.put()
        self.assertEqual(response.status_code, 200, response.content)
        field = response.json()['field']
        self.assertEqual(field['goal'], 'profit')
        self.assertEqual(field['farm_profile']['goals']['profit'], 60)

    def test_edit_updates_rotation_source_and_keeps_soil_test(self):
        saved = self.put().json()
        field = {**saved['field'], 'soil_ph': 6.8}
        self.client.put('/api/field/', {'revision': 1, 'field': field}, content_type='application/json')
        self.profile['goals'] = {'yield': 10, 'soilHealth': 10, 'water': 80}
        self.profile['sectors'][0]['name'] = 'Updated sector'
        response = self.put(2)
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()['field']['soil_ph'], 6.8)
        with patch('api.rotation.outlook_for', return_value={'available': False, 'reason': 'No current observations.'}):
            result = self.client.post('/api/rotation/', {'revision': 3, 'scope': 'single', 'sector_ids': ['north']}, content_type='application/json').json()
        self.assertEqual(result['goal_weights']['water'], 80)
        self.assertEqual(result['groups'][0]['sector']['name'], 'Updated sector')
        self.assertEqual(result['goal'], 'water')

    def test_invalid_weights_area_history_and_json_are_rejected(self):
        self.profile['goals']['water'] = 100
        self.assertEqual(self.put().status_code, 400)
        self.profile['goals']['water'] = 25
        self.profile['sectors'][0]['areaHa'] = 100
        self.assertEqual(self.put().status_code, 400)
        self.profile['sectors'][0]['areaHa'] = 4
        self.profile['cropHistory']['shared'][0]['fertilizers'] = ['none', 'N']
        self.assertEqual(self.put().status_code, 400)
        self.profile['cropHistory'] = None
        self.assertEqual(self.put().status_code, 400)

    def test_sector_histories_do_not_become_whole_field_history(self):
        self.profile['cropHistory']['sameForAllSectors'] = False
        self.profile['cropHistory']['bySector'] = {'north': self.profile['cropHistory']['shared']}
        response = self.put()
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()['field']['crop_history'][0]['sector_id'], 'north')
        self.assertEqual(response.json()['field']['farm_profile']['cropHistory']['shared'], [])

    def test_legacy_write_cannot_split_onboarding_and_rotation_values(self):
        stored = self.put().json()
        field = {**stored['field'], 'area_ha': 100}
        response = self.client.put('/api/field/', {'revision': 1, 'field': field}, content_type='application/json')
        self.assertEqual(response.status_code, 400)
        self.assertAlmostEqual(self.client.get('/api/field/').json()['field']['area_ha'], 4.046856422)

class ExampleFieldTests(TestCase):
    def test_creates_complete_example_and_does_not_overwrite(self):
        created = self.client.post('/api/field/example/').json()
        self.assertEqual(created['field']['area_ha'], 32)
        self.assertEqual(len(created['field']['sectors']), 3)
        self.assertEqual(len(created['field']['crop_history']), 6)
        self.assertEqual(created['field']['farm_profile']['goals']['soilHealth'], 45)
        self.assertEqual(self.client.post('/api/field/example/').status_code, 409)
        self.assertEqual(self.client.get('/api/field/').json()['revision'], 1)
        self.assertEqual(Client().get('/api/field/').json()['revision'], 0)

    def test_requires_csrf(self):
        self.assertEqual(Client(enforce_csrf_checks=True).post('/api/field/example/').status_code, 403)

class SoilSelectionTests(TestCase):
    def test_texture_mismatch_changes_ranking_and_status(self):
        from api.rotation import candidate_result
        crop = next(row for row in catalogue() if row['scientific_name'] in FOOD_CROPS)
        crop = {**crop, 'soil_texture': {'optimal': ['light'], 'absolute': ['light']}}
        field = {**empty_field(), 'soil_ph': 6.5, 'soil_class': 'II', 'soil_texture': 'sand'}
        climate = {'available': False}
        matched = candidate_result(crop, field, {}, climate)
        mismatch = candidate_result(crop, {**field, 'soil_texture': 'clay'}, {}, climate)
        self.assertEqual(mismatch['status'], 'red')
        self.assertGreater(matched['ranking_score'], mismatch['ranking_score'])

    def test_sector_class_overrides_field_class(self):
        from api.rotation import candidate_result
        crop = next(row for row in catalogue() if row['scientific_name'] in FOOD_CROPS)
        field = {**empty_field(), 'soil_ph': 6.5, 'soil_class': 'II'}
        result = candidate_result(crop, field, {'soil_class': 'VII'}, {'available': False})
        self.assertEqual(result['status'], 'red')
        self.assertTrue(any('Class VII' in reason for reason in result['reasons']))

    @patch('api.rotation.observation_table')
    @patch('api.rotation.regional_run', return_value={'planting_date': '2026-10-02'})
    def test_stale_model_run_is_never_current_forecast(self, run, table):
        import pandas as pd
        from api.rotation import outlook_for
        table.return_value = pd.DataFrame([{'date': pd.Timestamp('2026-10-01'), 'cell': 22, 'latitude': 37., 'longitude': -120.}])
        with patch('api.rotation.Path.exists', return_value=True), patch('api.rotation.Path.stat'):
            result = outlook_for({'latitude': 36.65, 'longitude': -119.9})
        self.assertFalse(result['available'])
        self.assertEqual(result['last_model_run']['prediction']['planting_date'], '2026-10-02')
        self.assertEqual(run.call_args.args[2], 22.)

class FieldFitColourTests(TestCase):
    def test_green_describes_soil_rotation_only(self):
        from api.rotation import candidate_result
        crop = next(row for row in catalogue() if row['scientific_name'] == 'Daucus carota')
        previous = next(row for row in catalogue() if row['scientific_name'] == 'Zea mays')
        field = {**empty_field(), 'soil_class': 'II', 'soil_ph': 6.7, 'soil_texture': 'loam', 'crop_history': [{'crop_id': previous['id'], 'crop_name': 'Corn', 'year': 2025, 'sector_id': None}]}
        result = candidate_result(crop, field, {}, {'available': False})
        self.assertEqual(result['status'], 'green')
        self.assertEqual(result['status_scope'], 'soil_and_rotation_fit')
        self.assertTrue(any('Weather has not been checked' in note for note in result['checks_needed']))
