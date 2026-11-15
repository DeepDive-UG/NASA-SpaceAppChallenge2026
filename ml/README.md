# Environmental outlook training

The package estimates regional conditions over 100 days after the last complete observation day. It produces ten 10-day windows and a separately trained whole-period window. The current experiment uses historical NASA observations and calendar features; it does not ingest a weather or seasonal forecast.

## Data boundaries

Downloaded rasters, credentials, intermediate daily tables and validation observation examples remain outside this repository. `backend/analytics/artifacts/` contains the serialized models and their manifest. `ml/reports/` contains evaluation and source provenance only.

Sources:

- SMAP SPL4SMGP v008: surface/root-zone moisture and top-layer soil temperature; one 13:30 UTC snapshot per day.
- MERRA-2 M2T1NXSLV v5.12.4: hourly mean 2 m air temperature and 10 m wind components.
- GPM IMERG v07: daily precipitation, Final where available and explicitly recorded Late values for recent dates.
- US Census 2025 California boundary: spatial domain selection, not a predictive variable.

SMAP and IMERG are aggregated using available pixel centers inside sampled MERRA-2 cells. The effective temperature grid is approximately 0.5 degrees latitude by 0.625 degrees longitude. These are regional estimates, not field sensors. Current LANDFIRE EVC/EVT maps are excluded from historical features because later map releases cannot be treated as observations available in earlier years.

## Reproduce

Run commands from the repository root. Replace the external paths when using another machine.

```bash
python3 -m venv .venv
.venv/bin/pip install -r ml/requirements.txt
.venv/bin/python ml/prepare_data.py \
  --data-root /home/martinez/CropTips-data/california \
  --work /home/martinez/CropTips-data/california/ml100-work
.venv/bin/python ml/train.py \
  --work /home/martinez/CropTips-data/california/ml100-work
.venv/bin/python ml/validate_artifacts.py \
  --examples /home/martinez/CropTips-data/california/ml100-work/validation
PYTHONPATH=backend .venv/bin/python -m unittest discover -s backend/analytics/tests -v
```

The complete staged workflow can also be run with one command. Models are copied into the repository only after artifact validation succeeds:

```bash
.venv/bin/python ml/run_pipeline.py \
  --data-root /home/martinez/CropTips-data/california \
  --work /home/martinez/CropTips-data/california/ml100-work
```

The external download summaries must confirm success before preparation starts. Source file hashes are captured in `ml/reports/data_provenance.json` after training. Original file availability and retrieval instructions remain in the external data folder; the model manifest never includes an Earthdata token.

## Models

For each target, HistGradientBoostingRegressor estimates the conditional mean and quantiles 0.1, 0.5 and 0.9. Forecast lead and window length are features, allowing direct predictions for every supported window without recursive forecast inputs.

Targets are mean air temperature, minimum and maximum hourly mean air temperature, precipitation accumulation, mean root-zone soil moisture, mean sampled top-model-layer soil temperature, and mean surface soil moisture. Soil temperature labels convert Kelvin to Celsius; input features retain Kelvin. The whole-period model inputs explicitly identify a 100-day window; whole-period extrema and quantiles are not calculated by combining shorter-window quantiles.

A seasonal reference groups training targets by location, target-start month and window length. Per target/window, validation MAE selects either gradient boosting or this reference. Validation residuals may expand the quantile intervals. Overlapping windows are correlated, and empirical interval coverage must be inspected on held-out data; no distribution-free coverage guarantee is claimed.

Training uses dates whose entire 100-day label interval ends before 2024. Validation issues start in 2024 and their full labels end before 2025. Test issues start in 2025. Twenty-five percent of sampled locations are held out from both training and validation. The source record still contains only a small number of annual cycles.

## Runtime

Install `backend/requirements-analytics.txt` into the Django runtime. The service caches loaded models once per process:

```python
from analytics.service import get_outlook

result = get_outlook(observations, planting_date="2026-06-01")
```

`observations` must contain one regional cell's 30 consecutive complete UTC days through the day immediately before planting. Required fields and units are defined in `analytics/schema.py`. The predictor rejects stale histories, missing days and inconsistent units. It does not fetch current observations automatically.

## Interpretation

The output is an experimental historical outlook. Retrospective source publication latency is not reconstructed. Minimum hourly mean air temperature does not resolve instantaneous ground frost. Anomaly labels describe position relative to the short training reference, not a standard 30-year climate normal. The current package must not be presented as a validated 100-day operational weather forecast or a planting-safety guarantee.

An operational release requires timely meteorological forecast inputs, seasonal outlooks and independent event-focused validation. Crop-specific temperature and water requirements belong in a separate, sourced suitability layer. USGS water measurements can later support water-availability assessments after hydrologically appropriate station matching; they are not included in these models.


## Soil extension (v2)

`soil_temperature.joblib` predicts the mean of the available 13:30 UTC daily samples of SMAP `soil_temp_layer1`. This is not a daily temperature mean, night-time minimum or a thermometer measurement at sowing depth. The SMAP v008 specification gives the first heat-model layer a thickness of 0.0988 m; this must not be confused with the 0–5 cm surface moisture layer. NASA describes soil temperature as a research output, outside the validated soil-moisture accuracy requirement. Source: https://ntrs.nasa.gov/api/citations/20250006429/downloads/SMAP_L4_SM_PSD_v1-7_for_L4SM_Version_8.pdf (sections 1.5, 4.5 and Appendix A).

`surface_soil_moisture.joblib` predicts 0–5 cm water content, complementing the existing 0–100 cm root-zone estimate. Both use one available sample per day. Neither is a measured seedbed condition or an irrigation allocation.

To train only these targets while preserving verified existing artifacts, seed the output directory with the existing artifacts and reports, then run:

```bash
backend/.venv/bin/python ml/train.py --work /path/to/ml100-work --artifacts /path/to/staged/artifacts --reports /path/to/staged/reports --examples /path/to/staged/validation --targets soil_temperature surface_soil_moisture
backend/.venv/bin/python ml/finalize.py --artifacts /path/to/staged/artifacts --reports /path/to/staged/reports
backend/.venv/bin/python ml/validate_artifacts.py --artifacts /path/to/staged/artifacts --examples /path/to/staged/validation
```

The same chronological and spatial holdouts, four gradient boosting regressors per target (mean and three quantiles), validation-only method selection and interval expansion are retained. Test results remain reported even when worse than the seasonal reference; models are not selected using test outcomes. Regional soil estimates do not establish crop-specific germination safety.

Other existing observations include daily mean wind speed. This cannot establish damaging gusts or safe spraying windows. Current LANDFIRE vegetation maps lack a matching historical series and must not be added as retrospective observations without resolving temporal leakage. Deeper SMAP temperature layers, evapotranspiration and other fields require additional source extraction; they are absent from the current prepared daily table.
