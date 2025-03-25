# Create your views here.
from django.shortcuts import render, redirect
from django.http import JsonResponse
from .models import Pharmacy
from .forms import RegisterForm
from django.contrib.auth.decorators import login_required
from django.contrib.auth import login, logout, authenticate


@login_required
def map_view(request):
    return render(request, "user_auth/dashboard.html", {"user": request.user})

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
            login(request, user)
            return redirect("dashboard")  # Redirect to map view after successful login
        else:
            return render(request, "user_auth/login.html", {"error": "Invalid credentials"})
    return render(request, "user_auth/login.html")

def logout_view(request):
    logout(request)
    return redirect("login")
