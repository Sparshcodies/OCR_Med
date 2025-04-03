import datetime
from math import radians, cos, sin, sqrt, atan2
from django.shortcuts import render, redirect
from django.http import JsonResponse
from django.utils import timezone
from .models import Pharmacy, Hospital, Doctor, Lab,  UserLoginHistory, SavedLocation, SavedHistory
from .forms import RegisterForm
from django.db.models import F,Q
from django.contrib.auth.models import User
from django.contrib.auth.decorators import login_required
from django.contrib.auth import login, logout, authenticate

def register_view(request):
    if request.method == "POST":
        form = RegisterForm(request.POST)
        if form.is_valid():
            user = form.save(commit=False)
            user.set_password(form.cleaned_data["password"])
            user.save()
            return redirect("login")  # Redirect to login after successful registration
    else:
        form = RegisterForm()
    
    return render(request, "user_auth/register.html", {"form": form})

def login_view(request):
    error_message = None  # To store error messages

    if request.method == "POST":
        username = request.POST["username"]
        password = request.POST["password"]
        
        # Authenticate user
        user = authenticate(request, username=username, password=password)

        # Check if user exists
        if user is not None:
            # Store login in DB
            login_entry = UserLoginHistory.objects.create(
                user=user,
                login_timestamp=timezone.now(),
            )

            # Store last login in session
            request.session["last_login"] = str(login_entry.login_timestamp)
            request.session.modified = True

            login(request, user)
            return redirect("dashboard")
        else:
            return render(request, "user_auth/login.html", {"error": "Invalid credentials"})

    return render(request, "user_auth/login.html")

def logout_view(request):
    """Logout the user and redirect to login."""
    logout(request)
    return redirect("login")

def navigation_view(request):
    return render(request,"user_auth/navigation.html")

@login_required
def dashboard_view(request):
    """Display user dashboard with login and search history."""
    user = request.user

    # Retrieve from database
    login_history = UserLoginHistory.objects.filter(user=user).order_by("-login_timestamp")[:10]
    search_history = SavedHistory.objects.filter(user=user).order_by("-timestamp")[:10]
    saved_locations = SavedLocation.objects.filter(user=user).order_by("-saved_at")

    # Retrieve last login from session
    last_login = request.session.get("last_login")

    return render(
        request,
        "user_auth/map.html",
        {
            "user": user,
            "last_login": last_login,
            "search_history": search_history,
            "saved_locations": saved_locations,
            "login_history": login_history,
        }
    )

@login_required
def get_pharmacies(request):
    return get_filtered_locations(request, Pharmacy)

@login_required
def get_hospitals(request):
    return get_filtered_locations(request, Hospital)

@login_required
def get_doctors(request):
    return get_filtered_locations(request, Doctor)

@login_required
def get_labs(request):
    return get_filtered_locations(request, Lab)

@login_required
def save_location(request):
    """Save a location to the user's saved locations list."""
    if request.method == "POST":
        name = request.POST.get("name", "").strip()
        location_type = request.POST.get("location_type", "").strip()
        lat = request.POST.get("lat")
        lon = request.POST.get("lon")
        address = request.POST.get("address", "").strip()

        if name and lat and lon:
            SavedLocation.objects.create(user=request.user, location_type=location_type, name=name, latitude=lat, longitude=lon, address=address)
            return JsonResponse({"status": "success", "message": "Location saved successfully."})
    
    return JsonResponse({"status": "error", "message": "Invalid data."})

@login_required
def get_saved_locations(request):
    """Retrieve the saved locations of the logged-in user."""
    saved_locations = SavedLocation.objects.filter(user=request.user)
    data = [
        {
            "name": loc.name,
            "location_type": loc.location_type,
            "lat": loc.latitude,
            "lon": loc.longitude,
            "address": loc.address,
            "saved_at": loc.saved_at.strftime("%Y-%m-%d %H:%M:%S")
        }
        for loc in saved_locations
    ]
    return JsonResponse({"saved_locations": data})

@login_required
def clear_saved_locations(request):
    """Clear all saved locations for the current user."""
    SavedLocation.objects.filter(user=request.user).delete()
    return redirect("dashboard")

@login_required
def save_search_history(request):
    if request.method == "POST":
        name = request.POST.get("name", "").strip()
        lat = request.POST.get("lat")
        lon = request.POST.get("lon")
        address = request.POST.get("address", "").strip()
        if name and lat and lon:
            # print("Received Data:", name, lat, lon, address)  # Debugging line
            SavedHistory.objects.create(user=request.user, name=name, address=address, latitude=lat, longitude=lon)
            return JsonResponse({"status": "success", "message": "Search history saved successfully."})
    return JsonResponse({"status": "error", "message": "Invalid data."})

@login_required
def get_recent_searches(request):
    """Retrieve the recent searches of the logged-in user."""
    recent_searches = SavedHistory.objects.filter(user=request.user).order_by("-timestamp")[:10]
    data = [
        {
            "name": search.name,
            "lat": search.latitude,
            "lon": search.longitude,
            "address": search.address,
            "saved_at": search.timestamp.strftime("%Y-%m-%d %H:%M:%S")
        }
        for search in recent_searches
    ]
    return JsonResponse({"recent_searches": data})

def clear_search_history(request):
    if request.method == "POST":
        SavedHistory.objects.all().delete()  # Adjust based on user-specific data
        return JsonResponse({"status": "success", "message": "Search history cleared."})
    return JsonResponse({"status": "error", "message": "Invalid request"}, status=400)

def haversine(lat1, lon1, lat2, lon2):
    """Calculate the great-circle distance between two points on the Earth."""
    R = 6371000  # Radius of Earth in meters
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat / 2)**2 + cos(lat1) * cos(lat2) * sin(dlon / 2)**2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return R * c  # Distance in meters

@login_required
def get_filtered_locations(request, model):
    """Generic function to get locations within 5000m radius."""
    try:
        lat = float(request.GET.get("lat"))
        lon = float(request.GET.get("lon"))
    except (TypeError, ValueError):
        return JsonResponse({"status": "error", "message": "Invalid latitude/longitude"})

    locations = model.objects.all()
    filtered_data = [
        {
            "name": loc.name,
            "lat": loc.latitude,
            "lon": loc.longitude,
            "address": loc.address
        }
        for loc in locations
        if haversine(lat, lon, loc.latitude, loc.longitude) <= 5000
    ]
    
    return JsonResponse({f"{model.__name__.lower()}s": filtered_data})
