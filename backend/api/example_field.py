"""Create an opt-in fictional California field without replacing existing records."""
import json
from pathlib import Path
from django.db import IntegrityError, transaction
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from .field import empty_field, profile_for, validate_field
from .models import FieldProfile
from .onboarding import normalize_profile


def example_data():
    source = json.loads((Path(__file__).parent / 'fixtures/california_farm.json').read_text())
    converted, profile = normalize_profile(source['profile'], {**empty_field(), 'name': source['name'], 'water_station_id': source.get('water_station_id'), 'fertilisers': source.get('fertilisers', [])})
    return {**validate_field(converted), 'farm_profile': profile, 'example_data': True}, source.get('gear', [])


@require_POST
def example_field(request):
    existing, workspace = profile_for(request)
    if existing:
        return JsonResponse({'error': 'This session already has a field. Existing records have been kept.'}, status=409)
    data, gear_names = example_data()
    try:
        with transaction.atomic():
            stored = FieldProfile.objects.create(workspace_key=workspace, owner=request.user if request.user.is_authenticated else None, data=data)
    except IntegrityError:
        return JsonResponse({'error': 'A field was saved in another tab. Reload to see it.'}, status=409)
    from .models import Gear
    if not request.user.is_authenticated and not request.session.session_key:
        request.session.create()
    gear_scope = {'owner': request.user} if request.user.is_authenticated else {'owner': None, 'session_key': request.session.session_key}
    for name in gear_names:
        Gear.objects.get_or_create(name=name, **gear_scope)
    return JsonResponse({'field': stored.data, 'revision': stored.revision, 'saved_at': stored.updated_at.isoformat(), 'storage': 'account' if request.user.is_authenticated else 'browser_session'}, status=201)
