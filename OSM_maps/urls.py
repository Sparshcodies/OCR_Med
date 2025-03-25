from django.urls import path
from .views import map_view, get_pharmacies

urlpatterns = [
    path('', map_view, name='map'),
    path('api/pharmacies/', get_pharmacies, name='get_pharmacies'),
]
