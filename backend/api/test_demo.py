from django.contrib.auth import get_user_model
from django.test import Client, TestCase, override_settings
from .demo import DEMO_USERNAME, ensure_demo
from .models import FieldProfile, Gear


@override_settings(CROPTIPS_DEMO_ENABLED=True)
class DemoAccountTests(TestCase):
    def test_two_visitors_open_same_demo_account(self):
        first = self.client.post('/api/demo/start/')
        second_client = Client()
        second = second_client.post('/api/demo/start/')
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(self.client.session['_auth_user_id'], second_client.session['_auth_user_id'])
        field = self.client.get('/api/field/').json()['field']
        self.assertTrue(field['demo_account'])
        self.assertEqual(field['area_ha'], 32)
        self.assertEqual(field['water_station_id'], 'USGS-11222975')
        self.assertEqual(len(field['fertilisers']), 3)
        self.assertEqual(len(self.client.get('/api/gear/').json()['gear']), 4)
        user = get_user_model().objects.get(username=DEMO_USERNAME)
        self.assertFalse(user.has_usable_password())
        self.assertFalse(user.is_staff)

    def test_existing_non_demo_account_is_not_adopted(self):
        get_user_model().objects.create_user(username=DEMO_USERNAME, password='existing-private-password')
        self.assertEqual(self.client.post('/api/demo/start/').status_code, 409)
        self.assertNotIn('_auth_user_id', self.client.session)

    def test_start_requires_csrf_and_can_be_disabled(self):
        self.assertEqual(Client(enforce_csrf_checks=True).post('/api/demo/start/').status_code, 403)
        with override_settings(CROPTIPS_DEMO_ENABLED=False):
            self.assertEqual(self.client.post('/api/demo/start/').status_code, 404)

    def test_reopening_does_not_reset_edits(self):
        user, stored = ensure_demo()
        stored.data['name'] = 'Edited demonstration farm'
        stored.save()
        ensure_demo()
        stored.refresh_from_db()
        self.assertEqual(stored.data['name'], 'Edited demonstration farm')
        self.assertEqual(FieldProfile.objects.filter(owner=user).count(), 1)
        self.assertEqual(Gear.objects.filter(owner=user).count(), 4)
