"""Causal daily feature generation shared by training and inference."""

import numpy as np
import pandas as pd
from .schema import FEATURES, LOOKBACK_DAYS, OBSERVATIONS, WINDOWS


def feature_table(history: pd.DataFrame) -> pd.DataFrame:
    required = {"date", "latitude", "longitude", *OBSERVATIONS}
    missing = required.difference(history.columns)
    if missing:
        raise ValueError(f"Missing observation columns: {sorted(missing)}")
    data = history.copy()
    data["date"] = pd.to_datetime(data["date"], utc=True).dt.tz_convert(None)
    if not data["date"].eq(data["date"].dt.normalize()).all():
        raise ValueError("Observation dates must be UTC calendar dates at midnight")
    data = data.sort_values("date")
    if data["date"].duplicated().any():
        raise ValueError("Observation dates must be unique for one location")
    if data["latitude"].nunique() != 1 or data["longitude"].nunique() != 1:
        raise ValueError("History must contain exactly one geographic location")
    data = data.set_index("date").asfreq("D")
    output = pd.DataFrame(index=data.index)
    output["latitude"] = data["latitude"]
    output["longitude"] = data["longitude"]
    output["issue_sin"] = np.sin(2 * np.pi * data.index.dayofyear / 365.2425)
    output["issue_cos"] = np.cos(2 * np.pi * data.index.dayofyear / 365.2425)
    for column in OBSERVATIONS:
        values = data[column]
        for lag in (0, 1, 7, 14, 29):
            suffix = "current" if lag == 0 else f"lag{lag}"
            output[f"{column}_{suffix}"] = values.shift(lag)
        for days in (7, 14, 30):
            output[f"{column}_mean{days}"] = values.rolling(days, min_periods=days).mean()
        output[f"{column}_change7"] = values - values.shift(7)
    return output


def add_window(features: pd.DataFrame, start: int, end: int) -> pd.DataFrame:
    if (start, end) not in WINDOWS:
        raise ValueError("Unsupported forecast window")
    result = features.copy()
    target_dates = result.index + pd.Timedelta(days=(start + end) / 2)
    result["target_sin"] = np.sin(2 * np.pi * target_dates.dayofyear / 365.2425)
    result["target_cos"] = np.cos(2 * np.pi * target_dates.dayofyear / 365.2425)
    result["lead_start"] = start
    result["lead_end"] = end
    result["window_days"] = end - start + 1
    return result[FEATURES]


def inference_features(history: pd.DataFrame) -> tuple[pd.Timestamp, pd.DataFrame]:
    required = {"date", "latitude", "longitude", *OBSERVATIONS}
    missing = required.difference(history.columns)
    if missing:
        raise ValueError(f"Missing observation columns: {sorted(missing)}")
    if len(history) < LOOKBACK_DAYS:
        raise ValueError(f"At least {LOOKBACK_DAYS} daily observations are required")
    recent = history.copy()
    recent["date"] = pd.to_datetime(recent["date"], utc=True).dt.tz_convert(None)
    recent = recent.sort_values("date").tail(LOOKBACK_DAYS)
    dates = recent["date"]
    if dates.duplicated().any() or not dates.diff().dropna().eq(pd.Timedelta(days=1)).all():
        raise ValueError("The last 30 UTC days must be consecutive and unique")
    values = recent[OBSERVATIONS].to_numpy(dtype=float)
    if not np.isfinite(values).all():
        raise ValueError("Recent observations contain missing or non-finite values")
    if not recent["latitude"].between(32.53, 42.01).all() or not recent["longitude"].between(-124.48, -114.13).all():
        raise ValueError("Location is outside the supported California bounding box")
    if (recent["precipitation_mm"] < 0).any() or (recent["wind_speed_m_s"] < 0).any():
        raise ValueError("Precipitation and wind speed cannot be negative")
    for column in ("rootzone_moisture", "surface_moisture"):
        if not recent[column].between(0, 1).all():
            raise ValueError("Volumetric moisture must use m3/m3 units in [0, 1]")
    if not recent["soil_temperature_k"].between(150, 380).all():
        raise ValueError("Soil temperature must use Kelvin")
    if not recent["temperature_mean_c"].between(-90, 65).all():
        raise ValueError("Air temperature must use Celsius")
    if (recent["temperature_min_c"] > recent["temperature_mean_c"]).any() or (recent["temperature_mean_c"] > recent["temperature_max_c"]).any():
        raise ValueError("Daily minimum, mean, and maximum temperature are inconsistent")
    base = feature_table(recent).tail(1)
    frames = [add_window(base, start, end) for start, end in WINDOWS]
    result = pd.concat(frames, ignore_index=True)
    if not np.isfinite(result.to_numpy(dtype=float)).all():
        raise ValueError("Feature generation produced invalid values")
    return dates.iloc[-1], result


def future_target(values: pd.Series, start: int, end: int, aggregation: str) -> pd.Series:
    shifted = pd.concat([values.shift(-lead) for lead in range(start, end + 1)], axis=1)
    complete = shifted.notna().all(axis=1)
    if aggregation == "mean":
        result = shifted.mean(axis=1)
    elif aggregation == "min":
        result = shifted.min(axis=1)
    elif aggregation == "max":
        result = shifted.max(axis=1)
    elif aggregation == "sum":
        result = shifted.sum(axis=1)
    else:
        raise ValueError("Unsupported target aggregation")
    return result.where(complete)
