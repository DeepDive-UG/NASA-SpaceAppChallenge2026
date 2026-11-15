"""Normalize onboarding records into the shared field representation."""
from datetime import date
from analytics.crops import catalogue


def normalize_profile(raw, existing):
    from .field import choice, numeric, text
    if not isinstance(raw, dict):
        raise ValueError('Provide a farm profile.')
    location = raw.get('farmLocation', {})
    if raw.get('consent') is not True:
        raise ValueError('Location consent is required.')
    latitude = numeric(location.get('lat'), 'Latitude', 32.53, 42.01)
    longitude = numeric(location.get('lon'), 'Longitude', -124.48, -114.13)
    soil_classes = {'unknown', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'}
    soil = choice(raw.get('defaultSoilClass'), soil_classes, 'Soil class')
    original = raw.get('originalArea', {})
    unit = choice(original.get('unit'), {'acres', 'hectares', 'm²'}, 'Area unit')
    amount = numeric(original.get('value'), 'Field size', 0.001, 1e10)
    area = amount * {'acres': 0.4046856422, 'hectares': 1, 'm²': 0.0001}[unit]
    goals = {key: numeric(raw.get('goals', {}).get(key, 0) if key == 'profit' else raw.get('goals', {}).get(key), 'Goal weight', 0, 100) for key in ('yield', 'soilHealth', 'water', 'profit')}
    if abs(sum(goals.values()) - 100) > 0.001:
        raise ValueError('Farm goals must total 100%.')
    sectors = raw.get('sectors', [])
    if not isinstance(sectors, list) or not 1 <= len(sectors) <= 50:
        raise ValueError('Add between 1 and 50 sectors.')
    normalized_sectors = []
    for sector in sectors:
        normalized_sectors.append({'id': text(sector.get('id'), 'Sector ID', True, 64), 'name': text(sector.get('name'), 'Sector name', True, 80), 'direction': choice(sector.get('direction', 'Other'), {'N','NE','E','SE','S','SW','W','NW','Center','Other'}, 'Direction'), 'soilClass': choice(sector.get('soilClass', soil), soil_classes, 'Sector soil class'), 'areaHa': numeric(sector.get('areaHa'), 'Sector area', 0.001, area), 'currentCrop': text(sector.get('currentCrop', ''), 'Current crop', False, 120), 'notes': text(sector.get('notes', ''), 'Sector notes', False, 1000)})
    history = raw.get('cropHistory', {})
    unknown = history.get('unknown') is True
    shared = history.get('sameForAllSectors') is not False
    rows = []
    def seasons(values, sector_id):
        if not isinstance(values, list) or not values or len(values) > 200:
            raise ValueError('Provide at most 200 seasons per area.')
        result = []
        for season in values:
            year = numeric(season.get('year'), 'Crop year', 1900, date.today().year)
            if year != int(year):
                raise ValueError('Crop year must be a whole year.')
            crop = text(season.get('crop'), 'Crop', True, 120)
            other = text(season.get('otherCrop', ''), 'Other crop', crop == 'Other', 120)
            fertilizers = season.get('fertilizers', [])
            if not isinstance(fertilizers, list) or not fertilizers or any(value not in {'N','P','K','NPK','manure','compost','lime','none','other'} for value in fertilizers):
                raise ValueError('Select fertilizers or none for each season.')
            if 'none' in fertilizers and len(fertilizers) > 1:
                raise ValueError('None cannot be combined with a fertilizer.')
            item = {'id': text(season.get('id'), 'Season ID', True, 64), 'year': int(year), 'crop': crop, 'otherCrop': other, 'fertilizers': fertilizers, 'amountKgHa': numeric(season.get('amountKgHa'), 'Fertilizer amount', 0, 100000, True), 'yield': text(str(season.get('yield') if season.get('yield') is not None else ''), 'Yield', False, 100)}
            result.append(item)
            name = other if crop == 'Other' else crop
            aliases = {'corn': 'Zea mays', 'potatoes': 'Solanum tuberosum', 'soybeans': 'Glycine max'}
            matched = next((row for row in catalogue() if row['scientific_name'] == aliases.get(name.lower()) or name.lower() in {row['name'].lower(), row['scientific_name'].lower()} or name.lower() in [alias.strip().lower() for alias in row['common_names'].split(',')]), None)
            rows.append({'id': f'{sector_id or "shared"}:{item["id"]}', 'crop_id': matched['id'] if matched else '', 'crop_name': name, 'year': int(year), 'sector_id': sector_id, 'notes': ''})
        return result
    shared_rows = seasons(history.get('shared', []), None) if not unknown and shared else []
    by_sector = {sector['id']: seasons(history.get('bySector', {}).get(sector['id'], []), sector['id']) for sector in normalized_sectors} if not unknown and not shared else {}
    water = raw.get('waterSource', {})
    water = {key: text(water.get(key, ''), 'Water source', key == 'name', 500) for key in ('name', 'description', 'type', 'address')} | {key: numeric(raw.get('waterSource', {}).get(key), 'Water coordinates', -90 if key == 'lat' else -180, 90 if key == 'lat' else 180, True) for key in ('lat', 'lon')}
    if (water['lat'] is None) != (water['lon'] is None) or (water['lat'] is None and not water['address']):
        raise ValueError('Provide water-source coordinates or an address.')
    profile = {'consent': True, 'farmLocation': {'lat': latitude, 'lon': longitude}, 'defaultSoilClass': soil, 'totalAreaHa': area, 'originalArea': {'value': amount, 'unit': unit}, 'sectorTemplate': text(raw.get('sectorTemplate', ''), 'Sector template', False, 80), 'sectors': normalized_sectors, 'cropHistory': {'unknown': unknown, 'sameForAllSectors': shared, 'shared': shared_rows, 'bySector': by_sector}, 'goals': goals, 'waterSource': water, 'onboardingCompleted': True}
    old_sectors = {sector['id']: sector for sector in existing.get('sectors', [])}
    field = {**existing, 'name': existing.get('name') or 'My field', 'area_ha': area, 'latitude': latitude, 'longitude': longitude, 'soil_class': soil, 'goal': {'soilHealth': 'soil', 'water': 'water', 'yield': 'harvest', 'profit': 'profit'}[max(goals, key=goals.get)], 'sectors': [{**old_sectors.get(sector['id'], {}), 'id': sector['id'], 'name': sector['name'], 'area_ha': sector['areaHa'], 'soil_class': sector['soilClass'], 'direction': sector['direction'], 'current_crop': sector['currentCrop'], 'notes': sector['notes']} for sector in normalized_sectors], 'crop_history': rows}
    soil_test = raw.get('soilTest')
    if soil_test is not None:
        field['soil_ph'] = numeric(soil_test.get('ph'), 'Soil pH', 0, 14, True)
        field['soil_texture'] = choice(soil_test.get('texture', 'unknown'), {'unknown','sand','sandy_loam','loam','silt_loam','clay_loam','clay'}, 'Soil texture')
        field['irrigation'] = choice(soil_test.get('irrigation', 'unknown'), {'unknown','rainfed','drip','sprinkler','furrow','other'}, 'Irrigation')
    return field, profile
