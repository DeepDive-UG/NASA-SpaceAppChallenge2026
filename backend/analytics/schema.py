"""Feature, target, and horizon definitions."""

SCHEMA_VERSION = "1.0.0"
LOOKBACK_DAYS = 30
WINDOWS = [(start, start + 9) for start in range(1, 101, 10)] + [(1, 100)]
OBSERVATIONS = [
    "temperature_mean_c", "temperature_min_c", "temperature_max_c",
    "precipitation_mm", "rootzone_moisture", "surface_moisture",
    "soil_temperature_k", "wind_speed_m_s",
]
TARGETS = {
    "temperature_mean": {"column": "temperature_mean_c", "aggregation": "mean", "units": "degC"},
    "temperature_min": {"column": "temperature_min_c", "aggregation": "min", "units": "degC"},
    "temperature_max": {"column": "temperature_max_c", "aggregation": "max", "units": "degC"},
    "precipitation": {"column": "precipitation_mm", "aggregation": "sum", "units": "mm"},
    "soil_moisture": {"column": "rootzone_moisture", "aggregation": "mean", "units": "m3 m-3"},
}
STATIC_FEATURES = ["latitude", "longitude", "issue_sin", "issue_cos", "target_sin", "target_cos", "lead_start", "lead_end", "window_days"]
FEATURES = STATIC_FEATURES + [f"{column}_{suffix}" for column in OBSERVATIONS for suffix in ("current", "lag1", "lag7", "lag14", "lag29", "mean7", "mean14", "mean30", "change7")]
