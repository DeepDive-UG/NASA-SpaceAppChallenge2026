import uuid
from django.conf import settings
from django.db import models


class FieldProfile(models.Model):
    workspace_key = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    owner = models.OneToOneField(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.CASCADE)
    data = models.JSONField(default=dict)
    revision = models.PositiveIntegerField(default=1)
    updated_at = models.DateTimeField(auto_now=True)


class Gear(models.Model):
    STATUS_CHOICES = [("available", "Available"), ("unavailable", "Unavailable")]

    # Zalogowany użytkownik: owner. Gość: owner=None + klucz sesji Django (jak przy zapisie pola).
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.CASCADE, related_name="gear",
    )
    session_key = models.CharField(max_length=40, blank=True, db_index=True)
    name = models.CharField(max_length=60)
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default="available")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.name} ({self.status})"