"""Equipment readiness and water context; neither predicts yield or water allocation."""
import json
import math
from datetime import datetime, timezone
from .models import Gear

GRAIN_CROPS = {'Triticum aestivum', 'Hordeum vulgare', 'Secale cereale', 'Avena sativa', 'Zea mays', 'Oryza sativa', 'Helianthus annuus'}


def resource_context(request, field):
    scope = {'owner': request.user} if request.user.is_authenticated else {'owner': None, 'session_key': request.session.session_key}
    gear = list(Gear.objects.filter(**scope).values('name', 'status')) if request.user.is_authenticated or request.session.session_key else []
    water = {'station_id': field.get('water_station_id'), 'status': 'not_selected', 'readings': [], 'irrigation': field.get('irrigation', 'unknown'), 'source': field.get('farm_profile', {}).get('waterSource'), 'field_supply': 'unverified'}
    station = field.get('water_station_id')
    if station:
        from .views import environmental_response, station_data
        response = environmental_response('water:' + station, lambda: station_data(station))
        payload = json.loads(response.content)
        water['status'] = 'unavailable'
        if response.status_code == 200:
            water['station_name'] = payload['data']['station']['properties'].get('monitoring_location_name')
            water['retrieved_at'] = payload['retrieved_at']
            water['status'] = 'no_recent_readings'
            for observation in payload['data']['observations']:
                item = observation['properties']
                if item.get('parameter_code') not in {'00060', '00065', '00062', '00010'}:
                    continue
                try:
                    value = float(item['value'])
                    age = (datetime.now(timezone.utc) - datetime.fromisoformat(item['time'].replace('Z', '+00:00'))).total_seconds() / 3600
                    if not math.isfinite(value) or (item.get('parameter_code') == '00060' and value < 0):
                        continue
                except (TypeError, ValueError, KeyError):
                    continue
                fresh = -0.25 <= age <= 6
                water['readings'].append({'parameter': item['parameter_code'], 'value': value, 'unit': item.get('unit_of_measure', ''), 'time': item['time'], 'fresh': fresh, 'approval': item.get('approval_status', '')})
                if fresh:
                    water['status'] = 'recent_readings'
    return {'gear': gear, 'water': water, 'meaning': 'Equipment readiness and station observations; no predicted yield gain or guaranteed irrigation supply.'}


def crop_resources(crop, field, context):
    available = {row['name'] for row in context['gear'] if row['status'] == 'available'}
    unavailable = {row['name'] for row in context['gear'] if row['status'] == 'unavailable'}
    grain = crop['scientific_name'] in GRAIN_CROPS
    matched = grain and 'Combine harvester' in available
    if matched:
        equipment = {'status': 'ready_to_check', 'text': 'You have a combine. Check it can harvest this crop.'}
    elif grain:
        equipment = {'status': 'check', 'text': 'Combine unavailable. Plan rental or contract harvesting.' if 'Combine harvester' in unavailable else 'Check access to a combine or contract harvesting.'}
    else:
        equipment = {'status': 'check', 'text': 'Check whether you need to pick by hand or use a special machine.'}
    water = context['water']
    if water['irrigation'] == 'rainfed':
        water_text = 'Rainfed field. Check rainfall before choosing this crop.'
    elif water['irrigation'] in {'drip', 'sprinkler', 'furrow', 'other'}:
        water_text = 'You use irrigation. Check you have enough water for this crop.'
    else:
        water_text = 'Water access is not confirmed. Check before planting.'
    if any(reading['parameter'] == '00060' and reading['fresh'] and reading['value'] == 0 for reading in water['readings']):
        is_well = (water.get('source') or {}).get('type', '').casefold() == 'well'
        water_text += ' A nearby river station reports zero flow; this does not measure your well.' if is_well else ' The station reports zero river flow. Check whether this station describes your water source.'
    if water['status'] in {'unavailable', 'no_recent_readings'}:
        water_text += ' The selected station has no fresh readings.'
    score = 0
    if grain and context['gear']:
        weight = field.get('farm_profile', {}).get('goals', {}).get('yield', 0) / 100
        score = (5 if matched else -5) * weight
    return {'equipment': equipment, 'water': {'status': 'check', 'text': water_text}, 'ranking_adjustment': score, 'scope': 'Practical readiness, not a yield prediction. Station readings do not establish field water allocation.'}
