from django.urls import path
from .views import *

urlpatterns = [
    path("", login_view, name="login"),
    path("register/", register_view, name="register"),
    path("logout/", logout_view, name="logout"),
    path("dashboard/", dashboard_view, name="dashboard"),
    path('api/pharmacies/', get_pharmacies, name='get_pharmacies'),
    path('api/doctors/', get_doctors, name='get_doctors'),
    path('api/hospitals/', get_hospitals, name='get_hospitals'),
    path('api/labs/', get_labs, name='get_labs'),
    path('save_location/', save_location, name='save_location'),
    path('get_saved_locations/', get_saved_locations, name='get_saved_locations'),
    path("clear-saved-locations/", clear_saved_locations, name="clear_saved_locations"),
    path("save_search_history/", save_search_history, name="save_search_history"),
    path('get_recent_searches/', get_recent_searches, name='get_recent_searches'),
    path("clear-history/", clear_search_history, name="clear_search_history"),
    path('navigation/', navigation_view, name='navigation'),
]
