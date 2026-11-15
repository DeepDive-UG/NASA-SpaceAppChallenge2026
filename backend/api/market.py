"""Illustrative market prices and standard commodity unit conversions."""

import json
import math
from pathlib import Path

MARKET_PATH = Path(__file__).resolve().parents[2] / 'frontend/public/data/crop-market-values.json'
CONVERSION_SOURCE = 'https://www.ams.usda.gov/sites/default/files/media/Book2.pdf'
POUND_KG = 0.45359237
BUSHEL_POUNDS = {'CORN': 56, 'WHEAT': 60, 'BARLEY': 48, 'OATS': 32, 'SOYBEANS': 60, 'SORGHUM': 56}
ALIASES = {'Maize (corn)': 'CORN', 'Wheat': 'WHEAT', 'Barley': 'BARLEY', 'Oats': 'OATS', 'Rice': 'RICE'}


def price_catalogue():
    try:
        data = json.loads(MARKET_PATH.read_text())
        records = {row['commodityCode']: row for row in data['records']}
        return data, records
    except (OSError, ValueError, KeyError, TypeError):
        return {'isMockData': True, 'records': []}, {}


def market_context(crop, data, records):
    row = records.get(ALIASES.get(crop['name']))
    if not row:
        return None
    price = row.get('price')
    if isinstance(price, bool) or not isinstance(price, (int, float)) or not math.isfinite(price) or price <= 0:
        return None
    unit = row.get('unit')
    kilograms = BUSHEL_POUNDS.get(row['commodityCode'], 0) * POUND_KG if unit == 'USD/bushel' else 100 * POUND_KG if unit == 'USD/hundredweight' else POUND_KG if unit == 'USD/pound' else 0
    if not kilograms:
        return None
    per_tonne = price * 1000 / kilograms
    result = {'price': price, 'unit': unit, 'usd_per_tonne': round(per_tonne, 2), 'as_of': row.get('asOf'), 'region': row.get('region'), 'is_example': data.get('isMockData', True), 'source': 'frontend/public/data/crop-market-values.json', 'conversion_source': CONVERSION_SOURCE}
    return result



def financial_rank(candidate):
    # Market prices cannot promote a worse agronomic status.
    status = {'green': 0, 'amber': 1, 'red': 2}[candidate['status']]
    return (status, -candidate['ranking_score'], candidate['crop']['name'])
