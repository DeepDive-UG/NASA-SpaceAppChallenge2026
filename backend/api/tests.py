from datetime import datetime, timezone
from unittest.mock import patch
from django.core.cache import cache
from django.test import SimpleTestCase
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
