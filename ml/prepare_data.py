"""Aggregate downloaded NASA products onto sampled MERRA-2 grid cells."""

from pathlib import Path
import argparse
import hashlib
import json
import re
import numpy as np
import pandas as pd
import xarray as xr
from shapely.geometry import shape
from shapely import contains_xy


def source_files(folder: Path, pattern: str) -> dict[str, Path]:
    selected = {}
    for path in sorted(folder.glob("*.nc4")):
        if path.name.endswith(".part.nc4"):
            continue
        match = re.search(pattern, path.name)
        if match:
            selected[match.group(1)] = path
    return selected


def masked_means(values: np.ndarray, masks: list[np.ndarray]) -> np.ndarray:
    result = []
    for mask in masks:
        subset = values[mask]
        finite = subset[np.isfinite(subset)]
        result.append(float(finite.mean()) if len(finite) else np.nan)
    return np.asarray(result)


def main(data_root: Path, work: Path, verify_only: bool = False):
    work.mkdir(parents=True, exist_ok=True)
    required = ["smap-download-summary.json", "merra2_hourly-summary.json", "imerg_final_daily-summary.json", "imerg_late_daily-summary.json"]
    for filename in ([] if verify_only else required):
        path = data_root / filename
        if not path.exists():
            raise RuntimeError(f"Download is not complete: {filename}")
        summary = json.loads(path.read_text())
        if summary["failed"] or summary["successful"] != summary["planned"]:
            raise RuntimeError(f"Download contains failures: {filename}")
    merra = source_files(data_root / "merra2_hourly", r"\.(\d{8})\.nc4$")
    smap = source_files(data_root / "smap_daily", r"_(\d{8})T")
    final = source_files(data_root / "imerg_final_daily", r"3IMERG\.(\d{8})-")
    late = source_files(data_root / "imerg_late_daily", r"3IMERG\.(\d{8})-")
    precipitation = {**late, **final}
    common = sorted(set(merra) & set(smap) & set(precipitation))
    if not verify_only and len(common) < 1500:
        raise RuntimeError("Fewer than 1,500 common observation days")
    if verify_only:
        common = common[:3]
    boundary = json.loads((data_root / "ml/california-boundary.geojson").read_text())
    california = shape(boundary["geometry"])
    with xr.open_dataset(merra[common[0]]) as ds:
        merra_latitude = ds.lat.values
        merra_longitude = ds.lon.values
    longitude, latitude = np.meshgrid(merra_longitude, merra_latitude)
    inside = contains_xy(california, longitude, latitude)
    inside &= (latitude - 0.25 >= 32.53) & (latitude + 0.25 <= 42.01)
    inside &= (longitude - 0.3125 >= -124.48) & (longitude + 0.3125 <= -114.13)
    with xr.open_dataset(smap[common[0]]) as ds:
        soil_latitude = ds.cell_lat.values
        soil_longitude = ds.cell_lon.values
    with xr.open_dataset(smap[common[0]], group="Geophysical_Data") as ds:
        initial_rootzone = ds.sm_rootzone.values
    with xr.open_dataset(precipitation[common[0]]) as ds:
        rain_longitude, rain_latitude = np.meshgrid(ds.lon.values, ds.lat.values)
    candidates = []
    for y, x in zip(*np.where(inside)):
        lat, lon = latitude[y, x], longitude[y, x]
        soil_mask = (np.abs(soil_latitude - lat) <= 0.25) & (np.abs(soil_longitude - lon) <= 0.3125)
        rain_mask = (np.abs(rain_latitude - lat) <= 0.25) & (np.abs(rain_longitude - lon) <= 0.3125)
        if np.isfinite(initial_rootzone[soil_mask]).any() and rain_mask.any():
            candidates.append((y, x, soil_mask, rain_mask))
    rng = np.random.default_rng(42)
    chosen = np.sort(rng.choice(len(candidates), min(48, len(candidates)), replace=False))
    cells = [candidates[index] for index in chosen]
    if len(cells) < 24:
        raise RuntimeError("Insufficient valid California grid cells")
    held_out = set(rng.choice(len(cells), max(6, len(cells) // 4), replace=False).tolist())
    locations = [{"cell": i, "latitude": float(latitude[y, x]), "longitude": float(longitude[y, x]), "merra_y": int(y), "merra_x": int(x), "spatial_split": "unseen" if i in held_out else "known", "smap_pixel_count": int(soil_mask.sum()), "imerg_pixel_count": int(rain_mask.sum())} for i, (y, x, soil_mask, rain_mask) in enumerate(cells)]
    (work / "locations.json").write_text(json.dumps(locations, indent=2))
    soil_masks = [item[2] for item in cells]
    rain_masks = [item[3] for item in cells]
    ys, xs = np.asarray([item[0] for item in cells]), np.asarray([item[1] for item in cells])
    rows, sources = [], []
    for count, day in enumerate(common, 1):
        with xr.open_dataset(merra[day]) as ds:
            if ds.sizes.get("time") != 24:
                raise ValueError("MERRA-2 daily file does not contain 24 hourly values")
            times = pd.DatetimeIndex(ds.time.values)
            expected_day = pd.to_datetime(day, format="%Y%m%d")
            if not (times.normalize() == expected_day).all():
                raise ValueError("MERRA-2 timestamps do not match the file date")
            air = ds.T2M.transpose("time", "lat", "lon").values[:, ys, xs] - 273.15
            wind = np.hypot(ds.U10M.transpose("time", "lat", "lon").values[:, ys, xs], ds.V10M.transpose("time", "lat", "lon").values[:, ys, xs])
            air_valid = np.isfinite(air).all(axis=0)
            mean_air = np.where(air_valid, air.mean(axis=0), np.nan)
            min_air = np.where(air_valid, air.min(axis=0), np.nan)
            max_air = np.where(air_valid, air.max(axis=0), np.nan)
            mean_wind = wind.mean(axis=0)
        with xr.open_dataset(smap[day], group="Geophysical_Data") as ds:
            rootzone = masked_means(ds.sm_rootzone.values, soil_masks)
            surface = masked_means(ds.sm_surface.values, soil_masks)
            soil_temperature = masked_means(ds.soil_temp_layer1.values, soil_masks)
        with xr.open_dataset(precipitation[day]) as ds:
            if ds.precipitation.attrs.get("units") not in ("mm/day", "mm d-1"):
                raise ValueError("Unexpected IMERG precipitation units")
            rainfall = masked_means(ds.precipitation.isel(time=0).transpose("lat", "lon").values, rain_masks)
        for i, location in enumerate(locations):
            rows.append({"date": expected_day, "cell": i, "latitude": location["latitude"], "longitude": location["longitude"], "spatial_split": location["spatial_split"], "temperature_mean_c": mean_air[i], "temperature_min_c": min_air[i], "temperature_max_c": max_air[i], "precipitation_mm": rainfall[i], "rootzone_moisture": rootzone[i], "surface_moisture": surface[i], "soil_temperature_k": soil_temperature[i], "wind_speed_m_s": mean_wind[i], "imerg_product": "Final" if day in final else "Late"})
        for product, path in (("MERRA-2", merra[day]), ("SMAP", smap[day]), ("IMERG Final" if day in final else "IMERG Late", precipitation[day])):
            sources.append({"date": day, "product": product, "file": path.name, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
        if count % 200 == 0:
            print(f"Aggregated {count}/{len(common)} common days", flush=True)
    daily = pd.DataFrame(rows)
    if verify_only:
        if not np.isfinite(daily[["temperature_mean_c", "precipitation_mm", "rootzone_moisture"]].to_numpy()).all():
            raise ValueError("Source validation contains missing observations")
        print(f"Verified spatial and temporal aggregation: {len(daily)} cell-day records", flush=True)
        return
    daily.to_csv(work / "daily.csv.gz", index=False)
    manifest = {"first_date": common[0], "last_date": common[-1], "days": len(common), "locations": locations, "rows": len(daily), "source_collection_ids": {"SMAP_SPL4SMGP": "C3480440870-NSIDC_CPRD", "MERRA2_M2T1NXSLV": "C1276812863-GES_DISC", "IMERG_Final": "C2723754864-GES_DISC", "IMERG_Late": "C2723754859-GES_DISC"}, "source_versions": {"SMAP_SPL4SMGP": "008", "MERRA2_M2T1NXSLV": "5.12.4", "IMERG_Final_GPM_3IMERGDF": "07", "IMERG_Late_GPM_3IMERGDL": "07"}, "spatial_aggregation": "MERRA-2 native grid; unweighted mean of available SMAP and IMERG pixel centers inside each 0.5 x 0.625 degree cell. No upsampling. Whole source-cell extents fit inside the downloaded bounding box.", "time_alignment": "MERRA-2 and IMERG use UTC calendar days; SMAP is one 13:30 UTC snapshot, not a daily average.", "duplicate_resolution": "Highest SMAP processing-version filename per date; IMERG Final takes precedence over Late.", "temperature_extremes": "Extremes over 24 hourly means at regional 2 m air temperature; not instantaneous or ground frost measurements.", "landfire_used": False, "reference_boundary": boundary["properties"], "sources": sources}
    (work / "data_manifest.json").write_text(json.dumps(manifest, indent=2))
    print(f"Prepared {len(daily)} daily observations from {len(common)} days", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-root", type=Path, required=True)
    parser.add_argument("--work", type=Path, required=True)
    parser.add_argument("--verify-only", action="store_true")
    arguments = parser.parse_args()
    main(arguments.data_root, arguments.work, arguments.verify_only)
