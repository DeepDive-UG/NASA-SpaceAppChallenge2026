import json
import math
import re
import uuid
from datetime import date

from django.db import IntegrityError, transaction
from django.http import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_http_methods

from .models import FieldProfile

TEXTURES = {"unknown", "sand", "sandy_loam", "loam", "silt_loam", "clay_loam", "clay"}
GOALS = {"soil", "water", "harvest", "diversity"}


def empty_field():
    return {"name": "", "area_ha": None, "latitude": None, "longitude": None, "soil_texture": "unknown", "soil_class": "unknown", "soil_ph": None, "irrigation": "unknown", "water_station_id": None, "goal": "soil", "sectors": [], "crop_history": [], "fertilisers": []}


def profile_for(request):
    key = request.session.get("field_workspace")
    if not key:
        key = str(uuid.uuid4())
        request.session["field_workspace"] = key
    if request.user.is_authenticated:
        owned = FieldProfile.objects.filter(owner=request.user).first()
        if owned:
            return owned, key
    existing = FieldProfile.objects.filter(workspace_key=key).first()
    if existing and existing.owner_id and existing.owner_id != getattr(request.user, "pk", None):
        key = str(uuid.uuid4())
        request.session["field_workspace"] = key
        return None, key
    if existing and request.user.is_authenticated and not existing.owner_id:
        existing.owner = request.user
        existing.save(update_fields=["owner"])
    return existing, key


def text(value, label, required=False, maximum=200):
    if not isinstance(value, str) or len(value.strip()) > maximum or (required and not value.strip()):
        raise ValueError(f"{label}: provide {'a value' if required else 'text'} up to {maximum} characters.")
    return value.strip()


def numeric(value, label, minimum, maximum, optional=False):
    if value in (None, "") and optional:
        return None
    if isinstance(value, bool):
        raise ValueError(f"{label}: enter a number.")
    try:
        value = float(value)
    except (TypeError, ValueError):
        raise ValueError(f"{label}: enter a number.") from None
    if not math.isfinite(value) or not minimum <= value <= maximum:
        raise ValueError(f"{label}: enter a value between {minimum} and {maximum}.")
    return value


def choice(value, allowed, label):
    if not isinstance(value, str) or value not in allowed:
        raise ValueError(f"{label}: choose one of the available options.")
    return value


def validate_field(raw):
    if not isinstance(raw, dict):
        raise ValueError("Provide field details.")
    result = empty_field()
    result.update({"name": text(raw.get("name"), "Field name", True, 100), "area_ha": numeric(raw.get("area_ha"), "Field area", 0.001, 1000000), "goal": choice(raw.get("goal"), GOALS, "Farming goal"), "soil_texture": choice(raw.get("soil_texture", "unknown"), TEXTURES, "Soil texture"), "soil_class": choice(raw.get("soil_class", "unknown"), {"unknown", "I", "II", "III", "IV", "V", "VI", "VII", "VIII"}, "Land capability class"), "soil_ph": numeric(raw.get("soil_ph"), "Soil pH", 0, 14, True), "irrigation": choice(raw.get("irrigation", "unknown"), {"unknown", "rainfed", "drip", "sprinkler", "furrow", "other"}, "Irrigation")})
    result["latitude"] = numeric(raw.get("latitude"), "Latitude", 32.53, 42.01, True)
    result["longitude"] = numeric(raw.get("longitude"), "Longitude", -124.48, -114.13, True)
    if (result["latitude"] is None) != (result["longitude"] is None):
        raise ValueError("Provide both latitude and longitude, or leave both empty.")
    station = raw.get("water_station_id")
    if station and (not isinstance(station, str) or not re.fullmatch(r"USGS-\d{8,15}", station)):
        raise ValueError("Water station: provide a valid USGS ID.")
    result["water_station_id"] = station or None
    ids = set()
    for key, maximum in (("sectors", 50), ("crop_history", 200), ("fertilisers", 200)):
        rows = raw.get(key, [])
        if not isinstance(rows, list) or len(rows) > maximum:
            raise ValueError(f"Too many {key.replace('_', ' ')} records.")
        for row in rows:
            if not isinstance(row, dict):
                raise ValueError("Invalid field record.")
            identifier = text(row.get("id"), "Record ID", True, 64)
            if identifier in ids:
                raise ValueError("Field record IDs must be unique.")
            ids.add(identifier)
            if key == "sectors":
                result[key].append({"id": identifier, "name": text(row.get("name"), "Sector name", True, 80), "area_ha": numeric(row.get("area_ha"), "Sector area", 0.001, result["area_ha"]), "soil_texture": choice(row.get("soil_texture", "unknown"), TEXTURES, "Sector soil texture"), "soil_ph": numeric(row.get("soil_ph"), "Sector soil pH", 0, 14, True)})
            elif key == "crop_history":
                year = numeric(row.get("year"), "Crop year", 1900, date.today().year)
                if year != int(year):
                    raise ValueError("Crop year must be a whole year.")
                result[key].append({"id": identifier, "crop_id": text(row.get("crop_id", ""), "Crop ID", False, 32), "crop_name": text(row.get("crop_name"), "Crop name", True, 120), "year": int(year), "sector_id": row.get("sector_id") or None, "notes": text(row.get("notes", ""), "Crop notes", False, 1000)})
            else:
                try:
                    applied = date.fromisoformat(row.get("date", ""))
                    if applied > date.today():
                        raise ValueError
                except (ValueError, TypeError):
                    raise ValueError("Fertiliser date must be a valid date up to today.") from None
                result[key].append({"id": identifier, "date": applied.isoformat(), "product": text(row.get("product"), "Fertiliser product", True, 120), "amount": numeric(row.get("amount"), "Fertiliser amount", 0.001, 100000), "unit": choice(row.get("unit"), {"kg/ha", "t/ha", "L/ha"}, "Fertiliser unit"), "nitrogen_pct": numeric(row.get("nitrogen_pct"), "Nitrogen content (%)", 0, 100, True), "sector_id": row.get("sector_id") or None, "notes": text(row.get("notes", ""), "Fertiliser notes", False, 1000)})
    if sum(sector["area_ha"] for sector in result["sectors"]) > result["area_ha"] + 0.00001:
        raise ValueError("The combined sector area exceeds the total field area.")
    sector_ids = {sector["id"] for sector in result["sectors"]}
    for row in result["crop_history"] + result["fertilisers"]:
        if row["sector_id"] and (not isinstance(row["sector_id"], str) or row["sector_id"] not in sector_ids):
            raise ValueError("A history record refers to a removed sector. Reassign it before saving.")
    return result


@require_http_methods(["GET", "PUT"])
@ensure_csrf_cookie
def field_profile(request):
    stored, workspace = profile_for(request)
    if request.method == "GET":
        return JsonResponse({"field": stored.data if stored else empty_field(), "revision": stored.revision if stored else 0, "saved_at": stored.updated_at.isoformat() if stored else None, "storage": "account" if request.user.is_authenticated else "browser_session"})
    if len(request.body) > 200000:
        return JsonResponse({"error": "Field records are too large."}, status=413)
    try:
        payload = json.loads(request.body)
        revision = payload["revision"]
        if type(revision) is not int or revision < 0:
            raise ValueError("Invalid field revision.")
        data = validate_field(payload["field"])
    except (ValueError, TypeError, KeyError, UnicodeDecodeError) as exc:
        return JsonResponse({"error": str(exc) if isinstance(exc, ValueError) else "Provide valid field details."}, status=400)
    try:
        with transaction.atomic():
            if stored:
                from django.utils import timezone
                updated = FieldProfile.objects.filter(pk=stored.pk, revision=revision).update(data=data, revision=revision + 1, updated_at=timezone.now())
                if not updated:
                    return JsonResponse({"error": "Field details changed in another tab. Reload before saving."}, status=409)
                stored.refresh_from_db()
            elif revision == 0:
                stored = FieldProfile.objects.create(workspace_key=workspace, owner=request.user if request.user.is_authenticated else None, data=data)
            else:
                return JsonResponse({"error": "Field details changed. Reload before saving."}, status=409)
    except IntegrityError:
        return JsonResponse({"error": "Field details changed in another tab. Reload before saving."}, status=409)
    return JsonResponse({"field": stored.data, "revision": stored.revision, "saved_at": stored.updated_at.isoformat(), "storage": "account" if request.user.is_authenticated else "browser_session"})
