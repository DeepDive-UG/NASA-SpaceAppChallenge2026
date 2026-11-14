import hashlib
import json
import os
import time
from datetime import datetime, timezone
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen

USGS = "https://api.waterdata.usgs.gov/ogcapi/v1/collections"
NWS = "https://api.weather.gov/alerts/active?area=CA"
NIFC = "https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Incident_Locations_Current/FeatureServer/0"
WATER_EVENTS = {"Flood Warning", "Flood Watch", "Flood Advisory", "Flash Flood Warning", "Flash Flood Watch", "Flash Flood Statement", "Hydrologic Outlook"}
FIRE_EVENTS = {"Red Flag Warning", "Fire Weather Watch", "Fire Warning"}
PILOT_STATIONS = ("USGS-11446500", "USGS-11377100", "USGS-11251000", "USGS-11152500", "USGS-11074000")


def fetch_json(url):
    headers = {"User-Agent": os.environ.get("ENVIRONMENT_USER_AGENT", "CropTips/0.1 (environmental research)"), "Accept": "application/geo+json, application/json"}
    if urlparse(url).hostname == "api.waterdata.usgs.gov" and os.environ.get("USGS_API_KEY"):
        headers["X-Api-Key"] = os.environ["USGS_API_KEY"]
    for attempt in range(3):
        try:
            with urlopen(Request(url, headers=headers), timeout=40) as response:
                return json.load(response)
        except (OSError, ValueError):
            if attempt == 2:
                raise
            time.sleep(2 ** attempt)


def usgs_features(collection, **params):
    url = f"{USGS}/{collection}/items?{urlencode({'f': 'json', 'limit': 10000, **params})}"
    seen = set()
    while url:
        if url in seen or urlparse(url).hostname != "api.waterdata.usgs.gov":
            raise ValueError("Invalid USGS pagination link")
        seen.add(url)
        page = fetch_json(url)
        yield from page["features"]
        url = next((link["href"] for link in page.get("links", []) if link.get("rel") == "next"), None)


def normalize_alert(feature, now=None):
    p = feature["properties"]
    event = p.get("event")
    if event not in WATER_EVENTS | FIRE_EVENTS or p.get("status") != "Actual" or p.get("messageType") == "Cancel":
        return None
    now = now or datetime.now(timezone.utc)
    expires = p.get("expires")
    if not expires or datetime.fromisoformat(expires.replace("Z", "+00:00")) <= now:
        return None
    source_id = feature.get("id") or p["id"]
    return {
        "id": source_id, "revision": hashlib.sha256(json.dumps(feature, sort_keys=True).encode()).hexdigest(),
        "source": "NWS", "category": "water" if event in WATER_EVENTS else "fire",
        "event": event, "severity": p.get("severity"), "headline": p.get("headline"),
        "description": p.get("description"), "instruction": p.get("instruction"),
        "area": p.get("areaDesc"), "geometry": feature.get("geometry"),
        "affected_zones": p.get("affectedZones", []), "sent": p.get("sent"),
        "onset": p.get("onset"), "expires": expires, "source_url": p.get("web") or source_id,
        "meaning": "fire_weather_risk" if event in {"Red Flag Warning", "Fire Weather Watch"} else "official_warning",
    }


def active_alerts(point=None):
    url = NWS if point is None else "https://api.weather.gov/alerts/active?" + urlencode({"point": point})
    page = fetch_json(url)
    return [alert for feature in page["features"] if (alert := normalize_alert(feature))]


def current_fires():
    features = []
    offset = 0
    while True:
        params = {"f": "geojson", "where": "POOState = 'US-CA' AND IncidentTypeCategory = 'WF'", "outFields": "IrwinID,IncidentName,POOCounty,PercentContained,IncidentSize,ModifiedOnDateTime_dt,FireDiscoveryDateTime", "outSR": 4326, "resultOffset": offset, "resultRecordCount": 1000, "orderByFields": "OBJECTID"}
        page = fetch_json(NIFC + "/query?" + urlencode(params))
        if "error" in page:
            raise OSError("NIFC returned a service error")
        features.extend(page["features"])
        if not page.get("properties", {}).get("exceededTransferLimit") and not page.get("exceededTransferLimit"):
            break
        offset += len(page["features"])
        if not page["features"]:
            raise OSError("NIFC pagination did not advance")
    return {"type": "FeatureCollection", "features": features, "source_url": NIFC, "meaning": "reported_wildfire_incidents_not_evacuation_orders"}
