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
from .market import financial_rank, market_context, price_catalogue


@require_GET
def crops(request):
    query = request.GET.get("q", "").strip().casefold()[:100]
    rows = [row for row in catalogue() if row["scientific_name"] in FOOD_CROPS]
    if query:
        rows = [row for row in rows if query in (row["name"] + " " + row["scientific_name"] + " " + row["common_names"] + " " + row["family"]).casefold()]
    market_data, market_rows = price_catalogue()
    rows = [{**row, "market": market_context(row, market_data, market_rows)} for row in rows]
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
        sites = table[["latitude", "longitude", "cell"]].drop_duplicates()
        distance = (sites.latitude - field["latitude"]) ** 2 + ((sites.longitude - field["longitude"]) * math.cos(math.radians(field["latitude"]))) ** 2
        site = sites.loc[distance.idxmin()]
        kilometres = math.sqrt(float(distance.min())) * 111
        if kilometres > 75:
            return {"available": False, "reason": "The current observation sample is too far from this field. Local input coverage is needed."}
        cutoff = min(last, yesterday)
        prediction = regional_run(str(path), path.stat().st_mtime_ns, float(site.cell), cutoff.isoformat())
        metadata = {"grid_distance_km": round(kilometres, 1), "resolution": "Regional grid estimates, not field sensors"}
        if last < yesterday:
            return {"available": False, "reason": f"NASA observations end on {last.isoformat()}. Today's 100-day forecast needs newer observations.", "available_through": last.isoformat(), "last_model_run": {"prediction": prediction, **metadata}}
        return {"available": True, "prediction": prediction, **metadata}
    except (ValueError, KeyError, RuntimeError, OSError, ImportError):
        return {"available": False, "reason": "A valid current outlook could not be generated from the available observations."}


@lru_cache(maxsize=32)
def regional_run(path, modified, cell, cutoff):
    table = observation_table(path, modified)
    history = table[(table.cell.astype(float) == cell) & (table.date.dt.date <= date.fromisoformat(cutoff))].sort_values("date").tail(30).copy()
    history["date"] = history.date.dt.strftime("%Y-%m-%d")
    from analytics.service import get_outlook
    return get_outlook(history.to_dict("records"), (date.fromisoformat(cutoff) + timedelta(days=1)).isoformat())


@require_GET
def field_outlook(request):
    stored, _ = profile_for(request)
    if not stored:
        return JsonResponse({"available": False, "reason": "Add a field location to load its outlook."})
    return JsonResponse(outlook_for(stored.data))


def histories_for(field, sector_id):
    return sorted([row for row in field["crop_history"] if sector_id is None or not row["sector_id"] or row["sector_id"] == sector_id], key=lambda row: row["year"], reverse=True)



def soil_context(climate):
    current = climate.get("available") is True
    run = climate if current else climate.get("last_model_run", {})
    prediction = run.get("prediction")
    if not prediction:
        return {"available": False, "current": False}
    first = prediction["periods"][0]
    targets = ("soil_temperature", "surface_soil_moisture", "soil_moisture")
    return {"available": True, "current": current, "start_date": first["start_date"], "end_date": first["end_date"], "conditions": {key: first["conditions"][key] for key in targets if key in first["conditions"]}, "scope": "Regional estimates for the first 10 days. Not seedbed measurements or crop-specific germination clearance."}

def candidate_result(crop, field, sector, climate, resources=None):
    by_id = {row["id"]: row for row in catalogue()}
    sector_id = sector.get("id")
    history = histories_for(field, sector_id)
    warnings, reasons = [], []
    score = 0
    weights = field.get("farm_profile", {}).get("goals", {})
    family_weight = 1 + weights.get("soilHealth", 0) / 100
    red = False
    soil_class = sector.get("soil_class")
    if soil_class in (None, "unknown"):
        soil_class = field.get("soil_class", "unknown")
    if sector_id is None and field.get("sectors"):
        order = {value: index for index, value in enumerate(("unknown", "I", "II", "III", "IV", "V", "VI", "VII", "VIII"))}
        soil_class = max([soil_class, *(row.get("soil_class", soil_class) for row in field["sectors"])], key=lambda value: order.get(value, 0))
    if soil_class in {"V", "VI", "VII", "VIII"}:
        red = True
        score -= 100
        reasons.append(f"Class {soil_class} land is usually unsuitable for crop planting. Ask a local agronomist before planting here.")
    elif soil_class in {"III", "IV"}:
        warnings.append(f"Class {soil_class} land: check slope, drainage and soil care before planting.")
    elif soil_class in {"I", "II"}:
        reasons.append(f"Class {soil_class} land can be cultivated.")
    else:
        warnings.append("Land capability class is not recorded.")
    texture = sector.get("soil_texture")
    if texture in (None, "unknown"):
        texture = field.get("soil_texture", "unknown")
    groups = {"sand": {"light"}, "sandy_loam": {"light", "medium"}, "loam": {"medium"}, "silt_loam": {"medium"}, "clay_loam": {"medium", "heavy"}, "clay": {"heavy"}}.get(texture, set())
    descriptor = crop.get("soil_texture", {})
    optimal = set(descriptor.get("optimal", []))
    absolute = set(descriptor.get("absolute", []))
    if not groups:
        warnings.append("Add soil texture to check the crop's soil requirements.")
    elif not absolute or not absolute <= {"light", "medium", "heavy", "organic"}:
        warnings.append("Soil type requirements are missing for this crop.")
    elif not groups & absolute:
        red = True
        score -= 100
        reasons.append(f"Your {texture.replace('_', ' ')} soil does not suit this crop.")
    elif groups <= optimal:
        score += 10
        reasons.append(f"Your {texture.replace('_', ' ')} soil suits this crop.")
    else:
        warnings.append("This soil type may work. Check drainage and soil condition.")
    ph = sector.get("soil_ph") if sector.get("soil_ph") is not None else field.get("soil_ph")
    bounds = crop["soil_ph"]
    if ph is None:
        warnings.append("Add a soil pH test to check this crop.")
    elif bounds["absolute_min"] is not None and bounds["absolute_max"] is not None and bounds["absolute_min"] <= bounds["absolute_max"]:
        if ph < bounds["absolute_min"] or ph > bounds["absolute_max"]:
            red = True
            reasons.append(f"Recorded soil pH {ph:g} is outside the EcoCrop range {bounds['absolute_min']:g}–{bounds['absolute_max']:g} for this crop.")
            score -= 100
        elif bounds["optimal_min"] is not None and bounds["optimal_max"] is not None and bounds["optimal_min"] <= ph <= bounds["optimal_max"]:
            reasons.append(f"Your soil pH ({ph:g}) suits this crop.")
            score += 10
        else:
            warnings.append("The soil pH may not suit this crop. Check your soil test.")
    else:
        warnings.append("Soil pH requirements are missing for this crop.")
    if history:
        latest_year = history[0]["year"]
        previous = [row for row in history if row["year"] == latest_year]
        resolved = [by_id.get(row["crop_id"]) for row in previous]
        if any(row and row["family"] == crop["family"] for row in resolved):
            warnings.append(f"A related crop grew here in {latest_year}. Check disease risk before planting the same crop family again.")
            score -= 10 * family_weight
        elif all(resolved):
            reasons.append(f"A different crop family from your {latest_year} crops.")
            score += 10 * family_weight
        else:
            warnings.append("Some past crops are not recognised. Their crop families have not been checked.")
    else:
        warnings.append("Add previous crops to assess rotation history.")
    if climate["available"]:
        check = screen_temperature(crop, climate["prediction"])
        if check["status"] == "red":
            red = True
            score -= 100
        reasons.extend(check["reasons"][:1])
        soil = climate["prediction"].get("periods", [{}])[0].get("conditions", {}).get("soil_temperature")
        if soil:
            reasons.append(f"Estimated soil temperature for the first 10 days: {soil['mean_estimate']:.1f} °C in the top model layer.")
        warnings.append("Check soil temperature at sowing depth and the seed packet’s planting needs. Air-temperature limits do not tell us when seeds will sprout.")
        warnings.append("The estimates cannot tell you whether your field will have frost.")
    else:
        warnings.append("Weather has not been checked for planting today.")
    if field["goal"] == "water" or weights.get("water", 0) > 0:
        warnings.append("Check how much irrigation this crop needs. Water savings are not estimated.")
    if field["goal"] == "harvest" or weights.get("yield", 0) > 0:
        warnings.append("These checks do not predict how much you will harvest.")
    applications = [row for row in field["fertilisers"] if (sector_id is None or not row["sector_id"] or row["sector_id"] == sector_id) and date.fromisoformat(row["date"]) >= date.today() - timedelta(days=365)]
    nitrogen = sum(row["amount"] * (1000 if row["unit"] == "t/ha" else 1) * row["nitrogen_pct"] / 100 for row in applications if row["unit"] in {"kg/ha", "t/ha"} and row["nitrogen_pct"] is not None)
    profile = field.get("farm_profile", {})
    seasonal = profile.get("cropHistory", {})
    entries = seasonal.get("shared", []) if seasonal.get("sameForAllSectors") else [entry for identifier, values in seasonal.get("bySector", {}).items() if sector_id is None or identifier == sector_id for entry in values]
    recorded = [entry for entry in entries if any(value != "none" for value in entry.get("fertilizers", []))]
    if recorded:
        warnings.append(f"Fertiliser use is recorded for {len(recorded)} seasons. A soil test is still needed to check nutrients.")
    if applications:
        reasons.append(f"{len(applications)} fertiliser application(s) recorded in the last 12 months. These records do not measure nutrients remaining in the soil.")
    elif not recorded:
        warnings.append("No recent fertiliser records. Add any applications you know about.")
    if sector_id is None and field["sectors"]:
        warnings.append("Conditions may differ across sectors. Check each sector before planting the whole field.")
    growth = crop.get("growth_days", {})
    if growth.get("max") and growth["max"] > 100:
        warnings.append("This crop may grow beyond the 100-day outlook. Check your variety’s harvest date and the weather after that.")
    active_crop = sector.get("current_crop", "").strip()
    if active_crop and active_crop.casefold() not in {"fallow", "none", "bare", "not planted", "unknown"}:
        warnings.append(f"This sector is recorded as growing {active_crop}. Check it will be clear before planting.")
    warnings.append("Local planting dates, seedbed temperature, pests and your crop variety still need checking.")
    texture_fit = bool(groups) and bool(optimal) and groups <= optimal
    ph_fit = ph is not None and bounds["optimal_min"] is not None and bounds["optimal_max"] is not None and bounds["optimal_min"] <= ph <= bounds["optimal_max"]
    family_fit = bool(history) and all(by_id.get(row["crop_id"]) for row in previous) and all(by_id[row["crop_id"]]["family"] != crop["family"] for row in previous)
    field_fit = not red and soil_class in {"I", "II"} and texture_fit and ph_fit and family_fit
    practical = None
    if resources is not None:
        from .rotation_resources import crop_resources
        practical = crop_resources(crop, field, resources)
        score += practical['ranking_adjustment']
    previous = history[:1] if not history else [row for row in history if row["year"] == history[0]["year"]]
    previous_crops = [by_id.get(row["crop_id"]) for row in previous]
    related = any(row and row["family"] == crop["family"] for row in previous_crops)
    goal_effects = [
        {"goal": "soilHealth", "label": "Healthy soil", "weight": weights.get("soilHealth", 100 if field["goal"] in {"soil", "diversity"} else 0), "status": "check" if related else "fit" if family_fit else "unknown", "text": "A related crop grew here last time. Check disease risk." if related else "A different crop family from last time. A useful change, but healthier soil is not guaranteed." if family_fit else "Past crop families need checking before we can compare rotation choices."},
        {"goal": "yield", "label": "A good harvest", "weight": weights.get("yield", 100 if field["goal"] == "harvest" else 0), "status": "check", "text": practical["equipment"]["text"] + " We cannot yet tell how much you will harvest." if practical else "Harvest size is not predicted. Equipment and growing conditions still need checking."},
        {"goal": "water", "label": "Using less water", "weight": weights.get("water", 100 if field["goal"] == "water" else 0), "status": "unknown", "text": "Will it use less water? We cannot tell yet. Check how much it needs and how much you have."},
    ]
    return {"goal_effects": goal_effects, "practical": practical, "crop": crop, "status": "red" if red else "green" if field_fit else "amber", "status_scope": "soil_and_rotation_fit", "label": "Mismatch found" if red else "Good soil & rotation fit" if field_fit else "Check before planting", "reasons": reasons, "checks_needed": warnings, "ranking_score": score, "fertiliser_context": {"application_count": len(applications), "recorded_nitrogen_kg_ha": round(nitrogen, 1) if sector_id is not None or not field["sectors"] else None, "meaning": "Applied amounts, not remaining soil nitrogen"}, "sources": [crop["source"], {"url": "https://efotg.sc.egov.usda.gov/references/Public/SD/landcap_introduction.pdf", "title": "USDA NRCS land capability classification"}, {"url": "https://ipm.ucanr.edu/home-and-landscape/rotating-plantings/", "title": "UC IPM rotation guidance"}], "economic_profitability": "not_assessed"}


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
        planning_goal = "earn_more" if stored.data.get("farm_profile", {}).get("goals", {}).get("profit", 0) > 0 or stored.data["goal"] == "profit" else "field"
        if planning_goal not in {"field", "earn_more"}:
            raise ValueError("Choose a valid planning goal.")
        crop_id = payload.get("crop_id")
        choices = [row for row in catalogue() if row["scientific_name"] in FOOD_CROPS and (not crop_id or row["id"] == crop_id)]
        if not choices:
            raise ValueError("Choose a crop from the catalogue.")
    except (ValueError, KeyError, TypeError, AttributeError, UnicodeDecodeError) as exc:
        return JsonResponse({"error": str(exc) if isinstance(exc, ValueError) else "Provide valid planning options."}, status=400)
    climate = outlook_for(stored.data)
    from .rotation_resources import resource_context
    resources = resource_context(request, stored.data)
    market_data, market_rows = price_catalogue()
    groups, used = [], set()
    for sector in selected:
        ranked = [candidate_result(crop, stored.data, sector, climate, resources) for crop in choices]
        for candidate in ranked:
            candidate["market"] = market_context(candidate["crop"], market_data, market_rows)
            candidate["goal_effects"].append({"goal": "profit", "label": "Earn more", "weight": stored.data.get("farm_profile", {}).get("goals", {}).get("profit", 100 if stored.data["goal"] == "profit" else 0), "status": "check" if candidate["market"] else "unknown", "text": "An example market price is available. A higher price per tonne does not mean a higher profit." if candidate["market"] else "No market price is listed for this crop. Earnings cannot be compared."})
        if planning_goal == "earn_more":
            weight = stored.data.get("farm_profile", {}).get("goals", {}).get("profit", 100) / 100
            maximum_price = max((row["market"]["usd_per_tonne"] for row in ranked if row["market"]), default=1)
            for candidate in ranked:
                if candidate["market"]:
                    candidate["ranking_score"] += 10 * weight * candidate["market"]["usd_per_tonne"] / maximum_price
            ranked.sort(key=financial_rank)
        else:
            ranked.sort(key=lambda row: (row["status"] == "red", -row["ranking_score"] + (5 if scope == "mix" and row["crop"]["id"] in used else 0), row["crop"]["name"]))
        count = 1 if crop_id or scope == "mix" else 4
        groups.append({"sector": sector, "candidates": ranked[:count]})
        used.add(ranked[0]["crop"]["id"])
    return JsonResponse({"planning_goal": planning_goal, "market_basis": {"is_example": market_data.get("isMockData", True), "as_of": market_data.get("updatedAt"), "note": "Example prices, not live quotes. Prices may change before harvest. The Earn more weight adds a small price-per-tonne preference within each field-fit colour. No yield, costs or future sale prices are predicted."}, "resources": resources, "field_revision": stored.revision, "goal": stored.data["goal"], "goal_weights": stored.data.get("farm_profile", {}).get("goals"), "planting_date": date.today().isoformat(), "horizon_days": 100, "outlook": climate, "soil_conditions": soil_context(climate), "groups": groups, "basis": "Saved field records and EcoCrop descriptors. Family diversification is a screening heuristic, not a validated rotation or yield model.", "limitations": ["Estimates do not replace human expertise or local agronomic advice.", "No green planting clearance is issued without a validated current forecast and crop-specific frost and water thresholds.", "Market figures are illustrative. Prices are not a prediction of profit or harvest-time selling prices."]})
