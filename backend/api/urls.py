from django.urls import path
from .views import health, alerts, water, fires, state_map, state_legend, gear_item, gear_list
from rag.views import chat, status as rag_status
from .account import account, change_password, sign_out
from .field import field_profile
from .example_field import example_field
from .demo import demo_info, start_demo
from .rotation import crops, rotation, field_outlook

urlpatterns = [
    path("demo/", demo_info, name="demo-info"),
    path("demo/start/", start_demo, name="demo-start"),
    path("field/example/", example_field, name="example-field"),
    path("field/", field_profile, name="field-profile"),
    path("field/outlook/", field_outlook, name="field-outlook"),
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
    path("gear/", gear_list, name="gear-list"),
    path("gear/<int:pk>/", gear_item, name="gear-item"),
]
