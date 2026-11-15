# Regional 100-day outlook

`service.get_outlook()` loads the versioned artifacts once per process and returns ten 10-day windows plus an independently estimated whole-period window. No training data are required to load a model. Inference still requires 30 consecutive days of current environmental inputs.

```python
from analytics.service import get_outlook

outlook = get_outlook(observations, planting_date="2026-06-01")
```

Each observation contains:

| Field | Unit |
|---|---|
| date | UTC calendar date |
| latitude, longitude | WGS84 degrees, regional cell center |
| temperature_mean_c, temperature_min_c, temperature_max_c | degrees Celsius |
| precipitation_mm | daily accumulated millimetres |
| rootzone_moisture, surface_moisture | m3/m3 |
| soil_temperature_k | Kelvin |
| wind_speed_m_s | metres per second |

The final observation date must immediately precede the requested planting date. Missing dates and inconsistent units are rejected. The module does not download current observations.

For each target, `mean_estimate` is the conditional mean estimate of that target statistic. For `temperature_min`, it is an estimate of the minimum temperature over the stated window, not the mean temperature. The 80% interval refers to uncertainty in that statistic. It does not describe the range of daily weather values. Quantile crossing is corrected by rearrangement; temperature minima, means and maxima are constrained to a consistent order.

The whole-period statistics and quantiles are directly estimated for the 100-day interval. They are not computed by combining shorter-window quantiles. Independently estimated point values can differ from an aggregation of the ten shorter-window point estimates.

`reference_difference` and `reference_position` compare the model estimate with a short training-only seasonal reference. They are not formal climate-normal anomalies and are not calibrated event probabilities.

The artifacts are historical experimental models. Retrospective data latency is not reconstructed; no external weather forecast is currently an input. Temperature extrema are derived from hourly mean regional 2 m air temperature. They cannot establish whether a particular field will experience ground frost. Operational planting advice requires timely forecast inputs and additional validation.

Training and evaluation details: [../../ml/README.md](../../ml/README.md). Source provenance and held-out metrics are recorded in `ml/reports/` after a successful training run. Crop suitability, crop-rotation rules, RAG explanations and USGS water-availability monitoring are separate components.


The v2 output adds `soil_temperature` in °C and `surface_soil_moisture` in m³/m³. Soil temperature describes the mean of one daily SMAP sample of the first heat-model layer (0.0988 m thick), not the daily mean or night minimum. Surface moisture covers 0–5 cm; existing root-zone moisture covers 0–100 cm. Each condition includes measurement metadata when available. Input `soil_temperature_k` remains Kelvin. See `ml/reports/metrics.json` for held-out errors and interval coverage; low coverage must not be hidden. Soil and air temperature are separate quantities, and air-temperature crop descriptors must not be used as seed-germination soil thresholds.
