"""Explicit entry into a public account containing only fictional farm records."""
from django.conf import settings
from django.contrib.auth import get_user_model, login
from django.contrib.auth.models import Group
from django.db import transaction
from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_POST
from .example_field import example_data
from .models import FieldProfile, Gear

DEMO_USERNAME = 'croptips_demo'
DEMO_GROUP = 'CropTips public demo'


def ensure_demo(reset=False):
    with transaction.atomic():
        user, created = get_user_model().objects.get_or_create(username=DEMO_USERNAME)
        group, _ = Group.objects.get_or_create(name=DEMO_GROUP)
        if created:
            user.set_unusable_password()
            user.save(update_fields=['password'])
            user.groups.add(group)
        if user.is_staff or user.is_superuser or user.has_usable_password() or not user.groups.filter(pk=group.pk).exists() or not user.is_active:
            raise ValueError('The demo username is reserved by another account.')
        stored = FieldProfile.objects.filter(owner=user).first()
        if stored is None or reset:
            data, gear_names = example_data()
            data['demo_account'] = True
            if stored:
                stored.data = data
                stored.revision += 1
                stored.save()
            else:
                stored = FieldProfile.objects.create(owner=user, data=data)
            for name in gear_names:
                Gear.objects.get_or_create(owner=user, name=name, defaults={'status': 'available'})
        return user, stored


@require_GET
def demo_info(request):
    return JsonResponse({'enabled': settings.CROPTIPS_DEMO_ENABLED, 'name': 'Valley Farm', 'region': 'Fresno County, California', 'area_ha': 32, 'sectors': 3, 'username': DEMO_USERNAME})


@require_POST
def start_demo(request):
    if not settings.CROPTIPS_DEMO_ENABLED:
        return JsonResponse({'error': 'Demo access is not enabled.'}, status=404)
    try:
        user, _ = ensure_demo()
    except ValueError as error:
        return JsonResponse({'error': str(error)}, status=409)
    login(request, user, backend='django.contrib.auth.backends.ModelBackend')
    request.session['croptips_demo'] = True
    request.session.set_expiry(8 * 3600)
    return JsonResponse({'username': user.username, 'redirect': '/myField'})
