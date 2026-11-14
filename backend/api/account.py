import json

from django.contrib.auth import logout, update_session_auth_hash
from django.contrib.auth.forms import PasswordChangeForm
from django.http import JsonResponse
from django.utils.translation import override
from django.views.decorators.debug import sensitive_variables
from django.views.decorators.http import require_GET, require_POST


@require_GET
def account(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Sign in to manage your account"}, status=401)
    user = request.user
    return JsonResponse({"username": user.get_username(), "password_change_available": user.has_usable_password()})


@require_POST
@sensitive_variables()
def change_password(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Sign in to change your password"}, status=401)
    if len(request.body) > 8192:
        return JsonResponse({"error": "Request is too large"}, status=413)
    try:
        values = json.loads(request.body)
        if not isinstance(values, dict) or any(not isinstance(values.get(key), str) or len(values[key]) > 1024 for key in ("old_password", "new_password1", "new_password2")):
            raise ValueError
    except (ValueError, TypeError, UnicodeDecodeError):
        return JsonResponse({"error": "Provide current password and both new password fields"}, status=400)
    with override("en"):
        form = PasswordChangeForm(request.user, values)
        if not form.is_valid():
            return JsonResponse({"errors": dict(form.errors)}, status=400)
        form.save()
        update_session_auth_hash(request, form.user)
    return JsonResponse({"message": "Password changed. You remain signed in on this browser."})


@require_POST
def sign_out(request):
    logout(request)
    return JsonResponse({"message": "Signed out"})
