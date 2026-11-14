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
        self.assertTrue(any('not been assessed' in warning for warning in candidate['checks_needed']))

    @patch('api.rotation.outlook_for', return_value={'available': False, 'reason': 'No current observations.'})
    def test_mix_uses_sector_history(self, outlook):
        crop = next(row for row in catalogue() if row['scientific_name'] in FOOD_CROPS)
        self.field['sectors'] = [{'id': 'a', 'name': 'A', 'area_ha': 4}, {'id': 'b', 'name': 'B', 'area_ha': 6}]
        self.field['crop_history'] = [{'id': 'h', 'crop_id': crop['id'], 'crop_name': crop['name'], 'year': 2025, 'sector_id': 'a'}]
        self.save()
        response = self.client.post('/api/rotation/', {'revision': 1, 'scope': 'mix', 'sector_ids': ['a', 'b'], 'crop_id': crop['id']}, content_type='application/json')
        groups = response.json()['groups']
        self.assertEqual(len(groups), 2)
        self.assertTrue(any('shares' in warning for warning in groups[0]['candidates'][0]['checks_needed']))
        self.assertFalse(any('shares' in warning for warning in groups[1]['candidates'][0]['checks_needed']))
        self.assertTrue(all(group['candidates'][0]['status'] != 'green' for group in groups))

    def test_invalid_json_and_scope(self):
        self.assertEqual(self.client.put('/api/field/', '[]', content_type='application/json').status_code, 400)
        self.save()
        response = self.client.post('/api/rotation/', {'revision': 1, 'scope': 'single', 'sector_ids': ['absent']}, content_type='application/json')
        self.assertEqual(response.status_code, 400)

    def test_csrf_required(self):
        client = Client(enforce_csrf_checks=True)
        self.assertEqual(client.put('/api/field/', {'field': self.field, 'revision': 0}, content_type='application/json').status_code, 403)
