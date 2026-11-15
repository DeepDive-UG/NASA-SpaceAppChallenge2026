from django.urls import path
from .views import health, alerts, water, fires, state_map, state_legend
from rag.views import chat, status as rag_status
from .account import account, change_password, sign_out
from .field import field_profile
from .rotation import crops, rotation

urlpatterns = [
    path("field/", field_profile, name="field-profile"),
    path("crops/", crops, name="crops"),
    path("rotation/", rotation, name="rotation"),
    path("account/", account, name="account"),
    path("account/password/", change_password, name="change-password"),
    path("account/logout/", sign_out, name="sign-out"),
    path("chat/", chat, name="chat"),
    path("chat/status/", rag_status, name="chat-status"),
    path("health/", health, name="health"),
    path("environment/alerts/", alerts, name="environment-alerts"),
    path("environment/water/", water, name="environment-water"),
    path("environment/fires/", fires, name="environment-fires"),
    path("state-map/", state_map, name="state-map"),
    path("state-legend/", state_legend, name="state-legend"),
]
