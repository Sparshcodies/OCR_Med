# Create your views here.
from django.shortcuts import render
from django.http import JsonResponse
from .models import Pharmacy

def map_view(request):
    return render(request, 'OSM_maps/map.html')

def get_pharmacies(request):
    pharmacies = Pharmacy.objects.all()
    data = [
        {
            "name": pharmacy.name,
            "lat": pharmacy.latitude,
            "lon": pharmacy.longitude,
            "address": pharmacy.address
        }
        for pharmacy in pharmacies
    ]
    return JsonResponse({"pharmacies": data})