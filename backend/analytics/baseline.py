"""Training-only seasonal reference distributions."""

import numpy as np
import pandas as pd


class SeasonalBaseline:
    def fit(self, metadata: pd.DataFrame, targets: np.ndarray):
        data = metadata[["latitude", "longitude", "reference_month", "window_days"]].copy()
        data["target"] = np.asarray(targets)
        self.locations_ = data[["latitude", "longitude"]].drop_duplicates().to_numpy()
        self.tables_ = {}
        keys = ["latitude", "longitude", "reference_month", "window_days"]
        for key, group in data.groupby(keys):
            values = group["target"].to_numpy()
            self.tables_[key] = [float(np.mean(values)), *np.quantile(values, [0.1, 0.5, 0.9]).tolist(), float(np.std(values)), len(values)]
        self.fallback_ = {}
        for key, group in data.groupby(["reference_month", "window_days"]):
            values = group["target"].to_numpy()
            self.fallback_[key] = [float(np.mean(values)), *np.quantile(values, [0.1, 0.5, 0.9]).tolist(), float(np.std(values)), len(values)]
        return self

    def predict(self, metadata: pd.DataFrame) -> np.ndarray:
        result = []
        for row in metadata.itertuples(index=False):
            distances = (self.locations_[:, 0] - row.latitude) ** 2 + ((self.locations_[:, 1] - row.longitude) * np.cos(np.deg2rad(row.latitude))) ** 2
            latitude, longitude = self.locations_[int(np.argmin(distances))]
            key = (latitude, longitude, row.reference_month, row.window_days)
            fallback = self.fallback_.get((row.reference_month, row.window_days))
            if fallback is None:
                raise ValueError("Seasonal reference does not cover this month and window")
            result.append(self.tables_.get(key, fallback))
        return np.asarray(result, dtype=float)
