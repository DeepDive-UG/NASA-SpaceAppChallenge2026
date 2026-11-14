"""Process-local model loading for the Django analytics layer."""

from functools import lru_cache
import pandas as pd
from .predict import Forecaster


@lru_cache(maxsize=1)
def get_forecaster() -> Forecaster:
    return Forecaster()


def get_outlook(observations: list[dict], planting_date: str) -> dict:
    return get_forecaster().predict(pd.DataFrame(observations), planting_date)
