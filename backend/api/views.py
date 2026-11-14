from django.http import JsonResponse
from django.views.decorators.http import require_GET
from django.views.decorators.csrf import ensure_csrf_cookie
from django.core.cache import cache
from datetime import datetime, timezone, timedelta
import math
import re

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
