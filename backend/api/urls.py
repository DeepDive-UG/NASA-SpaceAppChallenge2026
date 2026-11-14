from django.urls import path
from .views import health, alerts, water, fires

urlpatterns = [
    path("health/", health, name="health"),
    path("environment/alerts/", alerts, name="environment-alerts"),
    path("environment/water/", water, name="environment-water"),
    path("environment/fires/", fires, name="environment-fires"),
]
