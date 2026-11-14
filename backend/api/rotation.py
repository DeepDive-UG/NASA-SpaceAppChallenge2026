import json
import math
import os
from datetime import date, timedelta
from functools import lru_cache
from pathlib import Path

from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_POST

from analytics.crops import FOOD_CROPS, catalogue, screen_temperature
from .field import profile_for


@require_GET
def crops(request):
    query = request.GET.get("q", "").strip().casefold()[:100]
    rows = [row for row in catalogue() if row["scientific_name"] in FOOD_CROPS]
    if query:
        rows = [row for row in rows if query in (row["name"] + " " + row["scientific_name"] + " " + row["common_names"] + " " + row["family"]).casefold()]
    return JsonResponse({"crops": sorted(rows, key=lambda row: row["name"]), "source": "data/EcoCrop_DB.csv"})


@lru_cache(maxsize=2)
def observation_table(path, modified):
    import pandas as pd
    return pd.read_csv(path, parse_dates=["date"])


def outlook_for(field):
    if field.get("latitude") is None or field.get("longitude") is None:
        return {"available": False, "reason": "Add your field location in My field to obtain regional conditions."}
    path = Path(os.environ.get("CROPTIPS_OBSERVATIONS_PATH", str(Path.home() / "CropTips-data/california/ml100-work/daily.csv.gz")))
    if not path.exists():
        return {"available": False, "reason": "Recent environmental observations are not available yet. No weather values have been assumed."}
    try:
        table = observation_table(str(path), path.stat().st_mtime_ns)
        last = table["date"].max().date()
        yesterday = date.today() - timedelta(days=1)
        if last < yesterday:
            return {"available": False, "reason": f"The available observations end on {last.isoformat()}. More recent observations are required for a planting decision today.", "available_through": last.isoformat()}
        sites = table[["latitude", "longitude", "cell"]].drop_duplicates()
        distance = (sites.latitude - field["latitude"]) ** 2 + ((sites.longitude - field["longitude"]) * math.cos(math.radians(field["latitude"]))) ** 2
        site = sites.loc[distance.idxmin()]
        kilometres = math.sqrt(float(distance.min())) * 111
        if kilometres > 75:
            return {"available": False, "reason": "The current observation sample is too far from this field. Local input coverage is needed."}
        history = table[(table.cell == site.cell) & (table.date.dt.date <= yesterday)].sort_values("date").tail(30).copy()
        history["date"] = history.date.dt.strftime("%Y-%m-%d")
        from analytics.service import get_outlook
        prediction = get_outlook(history.to_dict("records"), date.today().isoformat())
        return {"available": True, "prediction": prediction, "grid_distance_km": round(kilometres, 1), "resolution": "Regional grid estimates, not field sensors"}
    except (ValueError, KeyError, RuntimeError, OSError, ImportError):
        return {"available": False, "reason": "A valid current outlook could not be generated from the available observations."}


def histories_for(field, sector_id):
    return sorted([row for row in field["crop_history"] if sector_id is None or not row["sector_id"] or row["sector_id"] == sector_id], key=lambda row: row["year"], reverse=True)


def candidate_result(crop, field, sector, climate):
    by_id = {row["id"]: row for row in catalogue()}
    sector_id = sector.get("id")
    history = histories_for(field, sector_id)
    warnings, reasons = [], []
    score = 0
    red = False
    ph = sector.get("soil_ph") if sector.get("soil_ph") is not None else field.get("soil_ph")
    bounds = crop["soil_ph"]
    if ph is None:
        warnings.append("A soil pH test is needed to check this crop's pH requirements.")
    elif bounds["absolute_min"] is not None and bounds["absolute_max"] is not None and bounds["absolute_min"] <= bounds["absolute_max"]:
        if ph < bounds["absolute_min"] or ph > bounds["absolute_max"]:
            red = True
            reasons.append(f"Recorded soil pH {ph:g} is outside the EcoCrop range {bounds['absolute_min']:g}–{bounds['absolute_max']:g} for this crop.")
            score -= 100
        elif bounds["optimal_min"] is not None and bounds["optimal_max"] is not None and bounds["optimal_min"] <= ph <= bounds["optimal_max"]:
            reasons.append(f"Recorded soil pH {ph:g} falls within the crop's optimal range.")
            score += 10
        else:
            warnings.append("The recorded pH is outside the known optimal range or that range is incomplete.")
    else:
        warnings.append("The crop's pH limits need further source information.")
    if history:
        latest_year = history[0]["year"]
        previous = [row for row in history if row["year"] == latest_year]
        resolved = [by_id.get(row["crop_id"]) for row in previous]
        if any(row and row["family"] == crop["family"] for row in resolved):
            warnings.append(f"This crop shares the {crop['family']} family with a crop recorded in {latest_year}. Review disease history before repeating that family.")
            score -= 20 if field["goal"] in {"soil", "diversity"} else 10
        elif all(resolved):
            reasons.append(f"A different crop family from the crops recorded in {latest_year}.")
            score += 20 if field["goal"] in {"soil", "diversity"} else 10
        else:
            warnings.append("Some previous crops are not matched to the crop catalogue; rotation families cannot be fully checked.")
    else:
        warnings.append("Add previous crops to assess rotation history.")
    if climate["available"]:
        check = screen_temperature(crop, climate["prediction"])
        if check["status"] == "red":
            red = True
            score -= 100
        reasons.extend(check["reasons"][:1])
        warnings.append("The 100-day model is experimental and does not establish field-level frost safety.")
    else:
        warnings.append("Current temperature, frost and rainfall suitability have not been assessed.")
    if field["goal"] == "water":
        warnings.append("Crop irrigation requirements are not supplied by EcoCrop annual rainfall limits. Water savings have not been quantified.")
    if field["goal"] == "harvest":
        warnings.append("Harvest yield is not predicted; this is a review of growing conditions and field history.")
    applications = [row for row in field["fertilisers"] if (sector_id is None or not row["sector_id"] or row["sector_id"] == sector_id) and date.fromisoformat(row["date"]) >= date.today() - timedelta(days=365)]
    nitrogen = sum(row["amount"] * (1000 if row["unit"] == "t/ha" else 1) * row["nitrogen_pct"] / 100 for row in applications if row["unit"] in {"kg/ha", "t/ha"} and row["nitrogen_pct"] is not None)
    if applications:
        reasons.append(f"{len(applications)} fertiliser application(s) recorded in the last 12 months. These records do not measure nutrients remaining in the soil.")
    else:
        warnings.append("No fertiliser applications recorded in the last 12 months; this does not establish that none were applied.")
    if sector_id is None and field["sectors"]:
        warnings.append("Whole-field records can include different sectors. Review sector-specific conditions before choosing one crop for the entire field.")
    return {"crop": crop, "status": "red" if red else "amber", "label": "A mismatch was found" if red else "Review before planting", "reasons": reasons, "checks_needed": warnings, "ranking_score": score, "fertiliser_context": {"application_count": len(applications), "recorded_nitrogen_kg_ha": round(nitrogen, 1) if sector_id is not None or not field["sectors"] else None, "meaning": "Applied amounts, not remaining soil nitrogen"}, "sources": [crop["source"], {"url": "https://ipm.ucanr.edu/home-and-landscape/rotating-plantings/", "title": "UC IPM rotation guidance"}], "economic_profitability": "not_assessed"}


@require_POST
def rotation(request):
    stored, _ = profile_for(request)
    if not stored:
        return JsonResponse({"error": "Save your field details in My field first."}, status=409)
    if len(request.body) > 8192:
        return JsonResponse({"error": "Request is too large."}, status=413)
    try:
        payload = json.loads(request.body)
        if payload.get("revision") != stored.revision:
            return JsonResponse({"error": "Your field has changed. Refresh it before requesting suggestions."}, status=409)
        scope = payload.get("scope", "whole")
        if scope not in {"whole", "single", "mix"}:
            raise ValueError("Choose a planning area.")
        ids = payload.get("sector_ids", [])
        if not isinstance(ids, list) or any(not isinstance(value, str) for value in ids):
            raise ValueError("Choose valid sectors.")
        selected = [sector for sector in stored.data["sectors"] if sector["id"] in ids]
        if scope != "whole" and (set(ids) != {row["id"] for row in selected} or len(selected) < (2 if scope == "mix" else 1) or (scope == "single" and len(selected) != 1)):
            raise ValueError("Choose one sector or at least two sectors for a mix.")
        if scope == "whole":
            selected = [{"id": None, "name": stored.data["name"], "area_ha": stored.data["area_ha"], "soil_ph": None}]
        crop_id = payload.get("crop_id")
        choices = [row for row in catalogue() if row["scientific_name"] in FOOD_CROPS and (not crop_id or row["id"] == crop_id)]
        if not choices:
            raise ValueError("Choose a crop from the catalogue.")
    except (ValueError, KeyError, TypeError, AttributeError, UnicodeDecodeError) as exc:
        return JsonResponse({"error": str(exc) if isinstance(exc, ValueError) else "Provide valid planning options."}, status=400)
    climate = outlook_for(stored.data)
    groups, used = [], set()
    for sector in selected:
        ranked = [candidate_result(crop, stored.data, sector, climate) for crop in choices]
        ranked.sort(key=lambda row: (row["status"] == "red", -row["ranking_score"] + (5 if scope == "mix" and row["crop"]["id"] in used else 0), row["crop"]["name"]))
        count = 1 if crop_id or scope == "mix" else 4
        groups.append({"sector": sector, "candidates": ranked[:count]})
        used.add(ranked[0]["crop"]["id"])
    return JsonResponse({"field_revision": stored.revision, "goal": stored.data["goal"], "planting_date": date.today().isoformat(), "horizon_days": 100, "outlook": climate, "groups": groups, "basis": "Saved field records and EcoCrop descriptors. Family diversification is a screening heuristic, not a validated rotation or yield model.", "limitations": ["Estimates do not replace human expertise or local agronomic advice.", "No green planting clearance is issued without a validated current forecast and crop-specific frost and water thresholds.", "Prices and financial profitability are not assessed."]})
