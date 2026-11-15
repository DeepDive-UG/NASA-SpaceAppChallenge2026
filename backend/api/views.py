from django.http import JsonResponse, HttpResponse, HttpResponseBadRequest  
from django.views.decorators.http import require_GET, require_http_methods
from django.views.decorators.csrf import ensure_csrf_cookie
from django.core.cache import cache
from datetime import datetime, timezone, timedelta
import math
import re
import json

import hashlib
from datetime import datetime, timezone
from .prism_state import get_state_map, get_legend

from .environment import active_alerts, usgs_features, current_fires


@require_GET
@ensure_csrf_cookie
def health(request):
    return JsonResponse({"status": "ok", "service": "CropTips"})


@require_GET
def alerts(request):
    point = request.GET.get("point")
    if point:
        try:
            lat, lon = map(float, point.split(","))
            if not all(map(math.isfinite, (lat, lon))) or not (32.53 <= lat <= 42.01 and -124.48 <= lon <= -114.13):
                raise ValueError
            point = f"{lat:.4f},{lon:.4f}"
        except ValueError:
            return JsonResponse({"error": "point must be latitude,longitude inside the California bounding box"}, status=400)
    return environmental_response("alerts:" + (point or "CA"), lambda: active_alerts(point))


@require_GET
def water(request):
    station = request.GET.get("station", "")
    if not re.fullmatch(r"USGS-\d{8,15}", station):
        return JsonResponse({"error": "Invalid USGS station ID"}, status=400)

    def retrieve():
        metadata = list(usgs_features("monitoring-locations", id=station))
        if not metadata or metadata[0]["properties"].get("state_code") != "06":
            raise ValueError("Station must be located in California")
        observations = list(usgs_features("latest-continuous", monitoring_location_id=station))
        today = datetime.now(timezone.utc).date()
        try:
            recent = list(usgs_features("daily", monitoring_location_id=station, parameter_code="00060", statistic_id="00003", time=f"{today - timedelta(days=8)}/{today - timedelta(days=1)}"))
            history_status = "available" if recent else "no_observations"
        except (OSError, ValueError):
            recent, history_status = [], "unavailable"
        return {"station": metadata[0], "observations": observations, "recent_discharge": recent, "history_status": history_status}

    return environmental_response("water:" + station, retrieve)


@require_GET
def fires(request):
    return environmental_response("fires:CA", current_fires)


def environmental_response(key, retrieve):
    payload = cache.get(key)
    if payload is None:
        try:
            payload = {"retrieved_at": datetime.now(timezone.utc).isoformat(), "data": retrieve()}
        except ValueError as exc:
            return JsonResponse({"status": "unavailable", "error": str(exc)}, status=502)
        except OSError:
            return JsonResponse({"status": "unavailable", "error": "Environmental source is unavailable"}, status=503)
        cache.set(key, payload, timeout=300)
    return JsonResponse({"status": "ok", "cache_seconds": 300, **payload})


ALLOWED_VARIABLES = {"tmax", "tmin", "tmean", "tdmean", "ppt", "vpdmax", "vpdmin"}
 
 
@require_GET
def state_map(request):
    """GET /api/state-map/?variable=tmax&lat=30.27&lon=-97.74&label=Austin -> image/png (stan wykrywany ze współrzędnych)
    GET /api/state-map/?state=TX&variable=tmax -> image/png (bez znacznika)"""
    variable = request.GET.get("variable", "tmax")
    state = request.GET.get("state") or None
    if not state and not (request.GET.get("lat") and request.GET.get("lon")):
        return HttpResponseBadRequest("Podaj state albo lat i lon")
    if variable not in ALLOWED_VARIABLES:  # wartość trafia do adresu URL, więc tylko z listy
        return HttpResponseBadRequest("Nieobsługiwana zmienna")
 
    marker = None
    lat, lon = request.GET.get("lat"), request.GET.get("lon")
    if lat and lon:
        try:
            marker = {"lat": float(lat), "lon": float(lon)}
        except ValueError:
            return HttpResponseBadRequest("lat/lon muszą być liczbami")
        if request.GET.get("label"):
            marker["label"] = request.GET["label"][:40]
 
    raw_key = repr((variable, (state or "").lower(), marker, datetime.now(timezone.utc).strftime("%Y%m%d%H")))
    key = "prism:" + hashlib.md5(raw_key.encode()).hexdigest()  # krótki klucz bezpieczny dla memcached
    cached = cache.get(key)
    if cached is None:
        try:
            cached = get_state_map(variable, state, marker=marker, return_date=True)
        except ValueError as e:          # zły stan / współrzędne
            return HttpResponseBadRequest(str(e))
        except FileNotFoundError as e:   # brak mapy w ostatnich dniach
            return HttpResponse(str(e), status=404)
        cache.set(key, cached, 3600)
 
    png, map_date = cached
    resp = HttpResponse(png, content_type="image/png")
    if map_date:
        resp["X-Prism-Date"] = map_date  # data mapy, odczytywana przez frontend
    resp["Cache-Control"] = "public, max-age=3600"
    return resp
 
 
@require_GET
def state_legend(request):
    """GET /api/state-legend/?variable=tmean -> image/png (legenda wycięta z mapy PRISM danej zmiennej)"""
    variable = request.GET.get("variable", "tmax")
    if variable not in ALLOWED_VARIABLES:
        return HttpResponseBadRequest("Nieobsługiwana zmienna")
 
    key = "prism-legend:" + hashlib.md5(
        repr((variable, datetime.now(timezone.utc).strftime("%Y%m%d%H"))).encode()).hexdigest()
    png = cache.get(key)
    if png is None:
        try:
            png, _ = get_legend(variable)
        except FileNotFoundError as e:
            return HttpResponse(str(e), status=404)
        except ValueError as e:
            return HttpResponseBadRequest(str(e))
        cache.set(key, png, 3600)
 
    resp = HttpResponse(png, content_type="image/png")
    resp["Cache-Control"] = "public, max-age=3600"
    return resp

from .models import Gear
 
# Te same typy co GEAR_TYPES we froncie (MyGear.jsx)
GEAR_TYPES = {
    "Tractor", "Combine harvester", "Plough", "Seed drill", "Sprayer",
    "Fertilizer spreader", "Cultivator", "Harrow", "Mower", "Baler", "Trailer",
}
STATUSES = {"available", "unavailable"}
MAX_GEAR = 200  # limit na użytkownika/sesję
 
 
def _scope(request):
    """Czyj sprzęt: zalogowanego użytkownika albo bieżącej sesji gościa."""
    if request.user.is_authenticated:
        return {"owner": request.user}
    if not request.session.session_key:
        request.session.create()
    return {"owner": None, "session_key": request.session.session_key}
 
 
def _dump(g):
    return {"id": g.id, "name": g.name, "status": g.status}
 
 
def _error(message, status):
    # fieldApi we froncie oczekuje JSON-a, także przy błędach: {"error": "..."}
    return JsonResponse({"error": message}, status=status)
 
 
def _body(request):
    try:
        data = json.loads(request.body or b"{}")
    except ValueError:
        return None
    return data if isinstance(data, dict) else None
 
 
@require_http_methods(["GET", "POST"])
def gear_list(request):
    """GET /api/gear/ -> {"gear": [...]}   POST /api/gear/ {"name": "Tractor"} -> 201 {"gear": {...}}"""
    scope = _scope(request)
    if request.method == "GET":
        return JsonResponse({"gear": [_dump(g) for g in Gear.objects.filter(**scope)]})
 
    data = _body(request)
    if data is None:
        return _error("Invalid request.", 400)
    name = data.get("name")
    if name not in GEAR_TYPES:
        return _error("Unknown gear type.", 400)
    if Gear.objects.filter(**scope).count() >= MAX_GEAR:
        return _error("Gear limit reached.", 400)
    gear = Gear.objects.create(name=name, **scope)
    return JsonResponse({"gear": _dump(gear)}, status=201)
 
 
@require_http_methods(["PATCH", "DELETE"])
def gear_item(request, pk):
    """PATCH /api/gear/<id>/ {"status": "unavailable"}   DELETE /api/gear/<id>/ -> {"ok": true}"""
    gear = Gear.objects.filter(pk=pk, **_scope(request)).first()
    if gear is None:
        return _error("Gear not found.", 404)
 
    if request.method == "DELETE":
        gear.delete()
        return JsonResponse({"ok": True})  # JSON, nie 204: fieldApi wymaga odpowiedzi JSON
 
    data = _body(request)
    status = data.get("status") if data else None
    if status not in STATUSES:
        return _error("Invalid status.", 400)
    gear.status = status
    gear.save(update_fields=["status"])
    return JsonResponse({"gear": _dump(gear)})