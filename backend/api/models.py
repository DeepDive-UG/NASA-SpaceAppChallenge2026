import uuid
from django.conf import settings
from django.db import models


class FieldProfile(models.Model):
    workspace_key = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    owner = models.OneToOneField(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.CASCADE)
    data = models.JSONField(default=dict)
    revision = models.PositiveIntegerField(default=1)
    updated_at = models.DateTimeField(auto_now=True)
