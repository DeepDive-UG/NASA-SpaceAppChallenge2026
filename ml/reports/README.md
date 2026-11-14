# Held-out evaluation

Source period: 20211114–20261001; 1783 days, 48 regional locations.

The test period starts in 2025. Model/window selection and interval expansion use validation data only. Full 100-day labels are purged at temporal split boundaries. A quarter of sampled locations is held out from training and validation.

| Split | Rows | First issue | Last issue | Last label | Locations |
|---|---:|---|---|---|---:|
| train | 36432 | 2021-12-16 | 2023-09-16 | 2023-12-25 | 36 |
| validation | 15048 | 2024-01-07 | 2024-09-22 | 2024-12-31 | 36 |
| test | 40128 | 2025-01-07 | 2026-06-17 | 2026-09-25 | 48 |

## Known locations

Errors retain target units: degC, mm, or m3/m3. Improvement is relative to the training-only seasonal reference; negative values indicate degradation. Coverage is empirical for the nominal 80% interval.

| Target | Lead days | MAE | Reference MAE | Improvement | Coverage | Interval width |
|---|---|---:|---:|---:|---:|---:|
| temperature_mean | 1-10 | 2.4063 | 2.4164 | 0.4% | 74.7% | 6.9001 |
| temperature_mean | 91-100 | 2.3591 | 2.3591 | 0.0% | 78.3% | 7.6519 |
| temperature_mean | 1-100 | 1.8413 | 1.8413 | 0.0% | 63.7% | 4.1880 |
| temperature_min | 1-10 | 2.6323 | 2.5214 | -4.4% | 75.3% | 7.5612 |
| temperature_min | 91-100 | 2.7161 | 2.4905 | -9.1% | 75.7% | 7.8101 |
| temperature_min | 1-100 | 2.0933 | 2.2616 | 7.4% | 72.4% | 6.8058 |
| temperature_max | 1-10 | 2.9587 | 3.1069 | 4.8% | 78.1% | 8.9069 |
| temperature_max | 91-100 | 2.8869 | 2.8125 | -2.6% | 86.1% | 10.4982 |
| temperature_max | 1-100 | 2.0854 | 2.0854 | 0.0% | 77.3% | 6.8078 |
| precipitation | 1-10 | 13.9532 | 13.9532 | 0.0% | 68.3% | 40.2332 |
| precipitation | 91-100 | 11.1502 | 11.1502 | 0.0% | 74.3% | 30.3792 |
| precipitation | 1-100 | 53.2835 | 53.2835 | 0.0% | 78.3% | 148.1353 |
| soil_moisture | 1-10 | 0.0107 | 0.0256 | 58.3% | 88.7% | 0.0638 |
| soil_moisture | 91-100 | 0.0201 | 0.0201 | 0.0% | 82.7% | 0.0681 |
| soil_moisture | 1-100 | 0.0180 | 0.0180 | 0.0% | 77.7% | 0.0591 |

## Unseen locations

Errors retain target units: degC, mm, or m3/m3. Improvement is relative to the training-only seasonal reference; negative values indicate degradation. Coverage is empirical for the nominal 80% interval.

| Target | Lead days | MAE | Reference MAE | Improvement | Coverage | Interval width |
|---|---|---:|---:|---:|---:|---:|
| temperature_mean | 1-10 | 2.6783 | 3.2827 | 18.4% | 67.9% | 7.0951 |
| temperature_mean | 91-100 | 3.3181 | 3.3181 | 0.0% | 62.8% | 7.6460 |
| temperature_mean | 1-100 | 2.7729 | 2.7729 | 0.0% | 49.3% | 4.3005 |
| temperature_min | 1-10 | 2.7045 | 3.3021 | 18.1% | 73.5% | 7.5474 |
| temperature_min | 91-100 | 2.9835 | 3.2354 | 7.8% | 69.7% | 7.6978 |
| temperature_min | 1-100 | 2.5297 | 3.2279 | 21.6% | 72.6% | 6.8615 |
| temperature_max | 1-10 | 3.3004 | 4.2362 | 22.1% | 73.5% | 9.2234 |
| temperature_max | 91-100 | 3.2571 | 4.0618 | 19.8% | 83.9% | 10.9294 |
| temperature_max | 1-100 | 3.9090 | 3.9090 | 0.0% | 48.1% | 6.7155 |
| precipitation | 1-10 | 15.4767 | 15.4767 | 0.0% | 68.5% | 41.5195 |
| precipitation | 91-100 | 12.2326 | 12.2326 | 0.0% | 74.1% | 31.3477 |
| precipitation | 1-100 | 57.3690 | 57.3690 | 0.0% | 77.0% | 149.8588 |
| soil_moisture | 1-10 | 0.0117 | 0.0330 | 64.5% | 90.8% | 0.0648 |
| soil_moisture | 91-100 | 0.0287 | 0.0287 | 0.0% | 56.7% | 0.0747 |
| soil_moisture | 1-100 | 0.0259 | 0.0259 | 0.0% | 58.4% | 0.0663 |

## Validation selection

| Target | Gradient boosting windows | Seasonal reference windows |
|---|---:|---:|
| temperature_mean | 6 | 5 |
| temperature_min | 5 | 6 |
| temperature_max | 6 | 5 |
| precipitation | 1 | 10 |
| soil_moisture | 4 | 7 |

## Limits

These are retrospective regional outlook experiments without external weather or seasonal forecast inputs. Publication latency was not reconstructed. The small number of annual cycles, overlapping forecast windows, product changes and limited spatial holdout prevent claims of operational 100-day forecast skill. Temperature extremes represent extrema of hourly mean air temperature, not ground frost. Source rasters and observation examples remain outside the repository. Full per-window metrics, pinball losses, cold-subset errors and provenance are in the accompanying JSON files.
