# Create your views here.
import datetime
from django.shortcuts import render, redirect
from django.http import JsonResponse
from django.utils import timezone
from .models import Pharmacy, SearchHistory, UserLoginHistory
from .forms import RegisterForm
from django.db.models import F
from django.contrib.auth.models import User
# from django.contrib.auth.signals import user_logged_in
from django.contrib.auth.decorators import login_required
from django.contrib.auth import login, logout, authenticate



@login_required
def map_view(request):
    search_history = request.session.get("search_history", [])
    return render(request, "user_auth/dashboard.html", {"user": request.user, "search_history": search_history})

def get_client_ip(request):
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip


# Before 
# @login_required
# def dashboard_view(request):
#     user = User.objects.get(username=request.user.username)
#     last_login = user.last_login
    
#     # Ensure search history persists across sessions
#     if "search_history" not in request.session:
#         request.session["search_history"] = []
        
#     search_history = request.session["search_history"]
    
#     return render(request, "user_auth/dashboard.html", {
#         "user": request.user,
#         "last_login": last_login,
#         "search_history": search_history,
#     })
#After
@login_required
def dashboard_view(request):
    user = request.user

    # Retrieve from database
    login_history = UserLoginHistory.objects.filter(user=user).order_by('-login_timestamp')[:10]
    search_history = SearchHistory.objects.filter(user=user).order_by('-timestamp')[:10]

    # Retrieve last login from session
    last_login = request.session.get("last_login", "First login")

    return render(request, "user_auth/dashboard.html", {
        "user": user,
        "last_login": last_login,
        "login_history": login_history,
        "search_history": search_history,
    })



@login_required
def search_pharmacy(request):
    query = request.GET.get("query", "").strip()
    if query:
        # Store in database
        SearchHistory.objects.create(user=request.user, query=query)
        # Store in session
        if "search_history" not in request.session:
            request.session["search_history"] = []
        request.session["search_history"].append({"query": query, "timestamp": str(timezone.now())})
        request.session.modified = True  # Save session changes

    pharmacies = Pharmacy.objects.filter(name__icontains=query)
    data = [{"name": p.name, "lat": p.latitude, "lon": p.longitude, "address": p.address} for p in pharmacies]
    
    return JsonResponse({"pharmacies": data})


@login_required
def clear_search_history(request):
    # Clear all search history for the current user
    SearchHistory.objects.filter(user=request.user).delete()
    return redirect("dashboard")

@login_required
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


def register_view(request):
    if request.method == "POST":
        form = RegisterForm(request.POST)
        if form.is_valid():
            user = form.save(commit=False)
            user.set_password(form.cleaned_data["password"])
            user.save()
            return redirect("login")
    else:
        form = RegisterForm()
    return render(request, "user_auth/register.html", {"form": form})

def login_view(request):
    if request.method == "POST":
        username = request.POST["username"]
        password = request.POST["password"]
        user = authenticate(request, username=username, password=password)

        if user is not None:
            # Store login in DB
            login_entry = UserLoginHistory.objects.create(
                user=user,
                login_timestamp=timezone.now(),
                ip_address=get_client_ip(request),
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
    logout(request)
    return redirect("login")


