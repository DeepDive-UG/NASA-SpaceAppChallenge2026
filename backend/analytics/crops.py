"""Source-attributed crop descriptors and deterministic temperature screening."""

import csv
import math
from functools import lru_cache
from pathlib import Path

DATA = Path(__file__).resolve().parents[2] / "data" / "EcoCrop_DB.csv"
FOOD_CROPS = {"Abelmoschus esculentus": "Okra", "Allium cepa": "Onion", "Avena sativa": "Oats", "Brassica oleracea var. italica": "Broccoli", "Cicer arietinum": "Chickpea", "Cucumis sativus": "Cucumber", "Daucus carota": "Carrot", "Helianthus annuus": "Sunflower", "Hordeum vulgare": "Barley", "Lactuca sativa": "Lettuce", "Lycopersicon esculentum": "Tomato", "Oryza sativa": "Rice", "Phaseolus vulgaris": "Common bean", "Pisum sativum": "Peas", "Raphanus sativus": "Radish", "Secale cereale": "Rye", "Solanum tuberosum": "Potato", "Spinacia oleracea": "Spinach", "Triticum aestivum": "Wheat", "Zea mays": "Maize (corn)"}


def number(value):
    try:
        result = float(value)
        return result if math.isfinite(result) else None
    except (TypeError, ValueError):
        return None


@lru_cache(maxsize=4)
def _catalogue(path, modified):
    records = []
    with Path(path).open(encoding="cp1252", newline="") as source:
        reader = csv.DictReader(source)
        for row in reader:
            records.append({
                "id": row["EcoPortCode"], "scientific_name": row["ScientificName"], "name": FOOD_CROPS.get(row["ScientificName"], row["ScientificName"]),
                "common_names": row.get("COMNAME", ""),
                "family": row.get("FAMNAME", "").split(":")[-1],
                "category": row.get("CAT", ""),
                "temperature_c": {"optimal_min": number(row.get("TOPMN")), "optimal_max": number(row.get("TOPMX")), "absolute_min": number(row.get("TMIN")), "absolute_max": number(row.get("TMAX"))},
                "annual_rainfall_mm": {"optimal_min": number(row.get("ROPMN")), "optimal_max": number(row.get("ROPMX"))},
                "soil_ph": {"optimal_min": number(row.get("PHOPMN")), "optimal_max": number(row.get("PHOPMX")), "absolute_min": number(row.get("PHMIN")), "absolute_max": number(row.get("PHMAX"))},
                "growth_days": {"min": number(row.get("GMIN")), "max": number(row.get("GMAX"))},
                "source": {"file": "data/EcoCrop_DB.csv", "line": reader.line_num},
            })
    return records


def catalogue():
    return _catalogue(str(DATA), DATA.stat().st_mtime_ns)


def search_crops(query, limit=20):
    query = query.strip().casefold()
    if len(query) < 2:
        return []
    records = [record for record in catalogue() if query in (record["scientific_name"] + " " + record["common_names"] + " " + record["family"]).casefold()]
    return sorted(records, key=lambda row: (not any(query == name.strip().casefold() for name in row["common_names"].split(",")), not row["scientific_name"].casefold().startswith(query), row["scientific_name"]))[:limit]


def screen_temperature(crop, outlook):
    result = {"crop_id": crop["id"], "status": "amber", "label": "More information needed", "reasons": [], "source": crop["source"], "scope": "temperature_screen_only", "economic_profitability": "not_assessed"}
    if not outlook:
        result["reasons"].append("A current 100-day outlook is needed before temperature suitability can be assessed.")
        return result
    conditions = outlook.get("whole_period", {}).get("conditions", {})
    temperature = conditions.get("temperature_mean", {})
    estimate = number(temperature.get("mean_estimate"))
    limits = crop["temperature_c"]
    if estimate is None or temperature.get("units") != "degC":
        result["reasons"].append("A valid mean air-temperature estimate in degrees Celsius is missing.")
        return result
    if any(limits[key] is None for key in ("optimal_min", "optimal_max", "absolute_min", "absolute_max")):
        result["reasons"].append("This crop has incomplete temperature descriptors in EcoCrop.")
        return result
    if not limits["absolute_min"] <= limits["optimal_min"] <= limits["optimal_max"] <= limits["absolute_max"]:
        result["reasons"].append("The crop temperature descriptors need source review.")
        return result
    if estimate < limits["absolute_min"] or estimate > limits["absolute_max"]:
        result.update(status="red", label="Temperature mismatch")
        result["reasons"].append("The estimated 100-day average temperature is outside this crop's absolute ecological temperature range.")
    elif not limits["optimal_min"] <= estimate <= limits["optimal_max"]:
        result["reasons"].append("The estimated average temperature is outside this crop's optimal temperature range.")
    else:
        result["reasons"].append("The estimated average temperature fits this crop's optimal range.")
    if outlook.get("status") == "experimental_historical_outlook":
        result["reasons"].append("This is an experimental historical outlook, not a validated operational weather forecast.")
    result["reasons"].extend([
        "Temperature descriptors do not establish seedling frost survival. Crop stage and local frost thresholds must be checked separately.",
        "Field history, fertilisation, water access and the selected farming goal still need to be assessed.",
        "Annual rainfall descriptors must not be compared directly with 100-day rainfall totals.",
    ])
    return result
