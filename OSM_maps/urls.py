from django.urls import path
from .views import map_view, get_pharmacies, register_view, login_view, logout_view

urlpatterns = [
    path("", login_view, name="login"),
    path("register/", register_view, name="register"),
    path("logout/", logout_view, name="logout"),
    path("dashboard/", map_view, name="dashboard"),
    path('api/pharmacies/', get_pharmacies, name='get_pharmacies'),
]
