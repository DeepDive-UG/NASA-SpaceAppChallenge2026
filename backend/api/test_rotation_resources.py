from datetime import datetime, timezone
from unittest.mock import patch
from django.core.cache import cache
from django.test import TestCase
from analytics.crops import catalogue
from .field import empty_field
from .models import Gear
from .rotation_resources import crop_resources


class RotationResourceTests(TestCase):
    def setUp(self):
        cache.clear()
        station = patch('api.views.station_data', return_value={'station': {'properties': {'monitoring_location_name': 'Test station'}}, 'observations': []})
        station.start()
        self.addCleanup(station.stop)
        self.client.post('/api/field/example/')
        self.field = self.client.get('/api/field/').json()['field']
        self.field['farm_profile']['goals']['yield'] = 80
        self.wheat = next(row for row in catalogue() if row['scientific_name'] == 'Triticum aestivum')

    def test_available_combine_changes_readiness_without_yield_prediction(self):
        context = {'gear': [{'name': 'Combine harvester', 'status': 'available'}], 'water': {'irrigation': 'drip', 'status': 'not_selected', 'readings': []}}
        result = crop_resources(self.wheat, self.field, context)
        self.assertGreater(result['ranking_adjustment'], 0)
        self.assertEqual(result['equipment']['status'], 'ready_to_check')
        context['gear'][0]['status'] = 'unavailable'
        unavailable = crop_resources(self.wheat, self.field, context)
        self.assertLess(unavailable['ranking_adjustment'], 0)
        self.assertIn('contract', unavailable['equipment']['text'])
        self.assertIn('not a yield prediction', result['scope'])

    @patch('api.rotation.outlook_for', return_value={'available': False, 'reason': 'No current observations.'})
    def test_saved_gear_is_scoped_and_used_in_rotation(self, outlook):
        gear = self.client.post('/api/gear/', {'name': 'Combine harvester'}, content_type='application/json')
        self.assertEqual(gear.status_code, 201)
        Gear.objects.create(name='Baler', session_key='another-session')
        result = self.client.post('/api/rotation/', {'revision': 1, 'crop_id': self.wheat['id']}, content_type='application/json').json()
        self.assertNotIn('Baler', [item['name'] for item in result['resources']['gear']])
        self.assertIn('Combine harvester', [item['name'] for item in result['resources']['gear']])
        self.assertEqual(result['groups'][0]['candidates'][0]['practical']['equipment']['status'], 'ready_to_check')
        self.assertEqual(result['resources']['water']['field_supply'], 'unverified')

    @patch('api.views.station_data')
    @patch('api.rotation.outlook_for', return_value={'available': False, 'reason': 'No current observations.'})
    def test_station_zero_flow_is_not_guaranteed_water_allocation(self, outlook, station):
        field = {**self.field, 'water_station_id': 'USGS-11251000'}
        self.client.put('/api/field/', {'revision': 1, 'field': field}, content_type='application/json')
        station.return_value = {'station': {'properties': {'monitoring_location_name': 'Test station'}}, 'observations': [{'properties': {'parameter_code': '00060', 'value': 0, 'unit_of_measure': 'ft3/s', 'time': datetime.now(timezone.utc).isoformat(), 'approval_status': 'Provisional'}}]}
        result = self.client.post('/api/rotation/', {'revision': 2, 'crop_id': self.wheat['id']}, content_type='application/json').json()
        water = result['resources']['water']
        self.assertEqual(water['readings'][0]['value'], 0)
        self.assertEqual(water['field_supply'], 'unverified')
        self.assertIn('zero flow', result['groups'][0]['candidates'][0]['practical']['water']['text'])
        self.assertIn('does not measure your well', result['groups'][0]['candidates'][0]['practical']['water']['text'])

    @patch('api.views.station_data', side_effect=OSError('Station unavailable'))
    @patch('api.rotation.outlook_for', return_value={'available': False, 'reason': 'No current observations.'})
    def test_water_failure_does_not_hide_crop_results(self, outlook, station):
        self.client.put('/api/field/', {'revision': 1, 'field': {**self.field, 'water_station_id': 'USGS-11251000'}}, content_type='application/json')
        response = self.client.post('/api/rotation/', {'revision': 2}, content_type='application/json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['resources']['water']['status'], 'unavailable')
        self.assertTrue(response.json()['groups'])
