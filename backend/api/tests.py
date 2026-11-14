from datetime import datetime, timezone
from unittest.mock import patch
from django.core.cache import cache
from django.test import SimpleTestCase, TestCase, Client
from django.contrib.auth import get_user_model
import json
from .environment import normalize_alert, usgs_features


class EnvironmentTests(SimpleTestCase):
    def setUp(self):
        cache.clear()

    def test_alert_expiry_cancellation_and_fire_meaning(self):
        feature = {"id": "warning-1", "properties": {"event": "Red Flag Warning", "status": "Actual", "messageType": "Alert", "expires": "2026-11-15T00:00:00Z"}}
        now = datetime(2026, 11, 14, tzinfo=timezone.utc)
        self.assertEqual(normalize_alert(feature, now)["meaning"], "fire_weather_risk")
        feature["properties"]["messageType"] = "Cancel"
        self.assertIsNone(normalize_alert(feature, now))
        feature["properties"]["messageType"] = "Alert"
        self.assertIsNone(normalize_alert(feature, datetime(2026, 11, 16, tzinfo=timezone.utc)))

    @patch("api.environment.fetch_json")
    def test_pagination(self, fetch):
        fetch.side_effect = [{"features": [1], "links": [{"rel": "next", "href": "https://api.waterdata.usgs.gov/page2"}]}, {"features": [2]}]
        self.assertEqual(list(usgs_features("daily")), [1, 2])

    @patch("api.views.active_alerts", side_effect=OSError("offline"))
    def test_source_failure_is_not_no_alerts(self, fetch):
        self.assertEqual(self.client.get("/api/environment/alerts/").status_code, 503)

    def test_invalid_coordinates(self):
        self.assertEqual(self.client.get("/api/environment/alerts/?point=nan,0").status_code, 400)

    def test_station_must_be_explicit(self):
        self.assertEqual(self.client.get("/api/environment/water/").status_code, 400)

    @patch("api.views.active_alerts", return_value=[])
    def test_cache(self, fetch):
        for _ in range(2):
            self.assertEqual(self.client.get("/api/environment/alerts/").status_code, 200)
        fetch.assert_called_once()

    @patch("api.views.usgs_features")
    def test_only_selected_station_is_requested(self, features):
        features.side_effect = [[{"id": "USGS-11152500", "properties": {"state_code": "06"}}], [], []]
        response = self.client.get("/api/environment/water/?station=USGS-11152500")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(features.call_args_list[0].kwargs, {"id": "USGS-11152500"})
        self.assertEqual(features.call_args_list[1].kwargs, {"monitoring_location_id": "USGS-11152500"})
        self.assertEqual(features.call_args_list[2].kwargs["monitoring_location_id"], "USGS-11152500")

    @patch("api.views.usgs_features")
    def test_history_failure_preserves_current_observations(self, features):
        features.side_effect = [[{"properties": {"state_code": "06"}}], [{"id": "reading"}], OSError("offline")]
        response = self.client.get("/api/environment/water/?station=USGS-11152500")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["data"]["history_status"], "unavailable")
        self.assertEqual(response.json()["data"]["observations"], [{"id": "reading"}])


class AccountTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.original = "Original-test-passphrase-38!"
        cls.replacement = "Replacement-test-passphrase-71!"
        cls.user = get_user_model().objects.create_user(username="farmer", password=cls.original)

    def post_password(self, **overrides):
        values = {"old_password": self.original, "new_password1": self.replacement, "new_password2": self.replacement, **overrides}
        return self.client.post("/api/account/password/", json.dumps(values), content_type="application/json")

    def test_password_change_requires_authentication(self):
        self.assertEqual(self.post_password().status_code, 401)

    def test_wrong_current_password_preserves_password(self):
        self.client.force_login(self.user)
        self.assertEqual(self.post_password(old_password="incorrect").status_code, 400)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(self.original))

    def test_password_validation_and_confirmation(self):
        self.client.force_login(self.user)
        for new, confirmation in [("123", "123"), (self.replacement, "different")]:
            self.assertEqual(self.post_password(new_password1=new, new_password2=confirmation).status_code, 400)

    def test_success_preserves_current_session_and_invalidates_other_session(self):
        self.client.force_login(self.user)
        other = Client()
        other.force_login(self.user)
        response = self.post_password()
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(self.replacement))
        self.assertFalse(self.user.check_password(self.original))
        self.assertEqual(self.client.get("/api/account/").status_code, 200)
        self.assertEqual(other.get("/api/account/").status_code, 401)

    def test_account_response_excludes_personal_names_and_email(self):
        self.client.force_login(self.user)
        response = self.client.get("/api/account/")
        self.assertEqual(set(response.json()), {"username", "password_change_available"})
        self.assertEqual(self.client.post("/api/account/profile/", "{}", content_type="application/json").status_code, 404)

    def test_logout_ends_session(self):
        self.client.force_login(self.user)
        self.assertEqual(self.client.post("/api/account/logout/").status_code, 200)
        self.assertEqual(self.client.get("/api/account/").status_code, 401)

    def test_password_endpoint_requires_csrf(self):
        client = Client(enforce_csrf_checks=True)
        client.force_login(self.user)
        self.assertEqual(client.post("/api/account/password/", "{}", content_type="application/json").status_code, 403)
