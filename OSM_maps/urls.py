from django.urls import path
from .views import *

urlpatterns = [
    path("", login_view, name="login"),
    path("register/", register_view, name="register"),
    path("logout/", logout_view, name="logout"),
    path("dashboard/", dashboard_view, name="dashboard"),
    path('api/pharmacies/', get_pharmacies, name='get_pharmacies'),
    path("clear-history/", clear_search_history, name="clear_search_history"),
    path("search/", search_pharmacy, name="search_pharmacy"),
    # path("pharmacies/", get_pharmacies, name="get_pharmacies"),
]
