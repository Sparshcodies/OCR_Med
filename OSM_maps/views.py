import datetime
from django.shortcuts import render, redirect
from django.http import JsonResponse
from django.utils import timezone
from .models import Pharmacy, SearchHistory, UserLoginHistory
from .forms import RegisterForm
from django.db.models import F
from django.contrib.auth.models import User
from django.contrib.auth.decorators import login_required
from django.contrib.auth import login, logout, authenticate



@login_required
def map_view(request):
    search_history = request.session.get("search_history", [])
    return render(request, "user_auth/map.html", {"user": request.user, "search_history": search_history})

@login_required
def dashboard_view(request):
    """Display user dashboard with login and search history."""
    user = request.user

    # Retrieve from database
    login_history = UserLoginHistory.objects.filter(user=user).order_by("-login_timestamp")[:10]
    search_history = SearchHistory.objects.filter(user=user).order_by("-timestamp")[:10]

    # Retrieve last login from session
    last_login = request.session.get("last_login")

    return render(
        request,
        "user_auth/map.html",
        {
            "user": user,
            "last_login": last_login,
            "search_history": search_history,
        }
    )


@login_required
def search_pharmacy(request):
    """Handle pharmacy search and store user query in search history."""
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
    """Clear all search history for the current user."""
    SearchHistory.objects.filter(user=request.user).delete()
    return redirect("dashboard")


@login_required
def get_pharmacies(request):
    """Return a list of all pharmacies."""
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
