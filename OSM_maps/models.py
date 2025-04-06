from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone

class Pharmacy(models.Model):
    name = models.CharField(max_length=255)
    latitude = models.FloatField()
    longitude = models.FloatField()
    address = models.TextField(blank=True, null=True)
    opening_hours = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        help_text="OSM‑style opening hours, e.g. '09:00-18:00'"
    )

    def __str__(self):
        return self.name
    
class Hospital(models.Model):
    name = models.CharField(max_length=255)
    latitude = models.FloatField()
    longitude = models.FloatField()
    address = models.TextField(blank=True, null=True)
    opening_hours = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        help_text="OSM‑style opening hours, e.g. '09:00-18:00'"
    )

    def __str__(self):
        return self.name
    
class Doctor(models.Model):
    name = models.CharField(max_length=255)
    latitude = models.FloatField()
    longitude = models.FloatField()
    address = models.TextField(blank=True, null=True)
    opening_hours = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        help_text="OSM‑style opening hours, e.g. '09:00-18:00'"
    )

    def __str__(self):
        return self.name
    
class Lab(models.Model):
    name = models.CharField(max_length=255)
    latitude = models.FloatField()
    longitude = models.FloatField()
    address = models.TextField(blank=True, null=True)
    opening_hours = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        help_text="OSM‑style opening hours, e.g. '09:00-18:00'"
    )

    def __str__(self):
        return self.name
        
class UserLoginHistory(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='login_history')
    login_timestamp = models.DateTimeField(default=timezone.now)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    def __str__(self):
        return f"{self.user.username} - {self.login_timestamp}"
    
    class Meta:
        ordering = ['-login_timestamp']
        verbose_name_plural = 'User Login Histories'
        
class SavedLocation(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='saved_locations')
    name = models.CharField(max_length=255)
    location_type = models.CharField(max_length=255)
    latitude = models.FloatField()
    longitude = models.FloatField()
    address = models.TextField(blank=True, null=True)
    saved_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.name}"

    class Meta:
        ordering = ['-saved_at']
        
class SavedHistory(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='saved_histories')
    name = models.CharField(max_length=255)
    latitude = models.FloatField()
    longitude = models.FloatField()
    address = models.TextField(blank=True, null=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.name}"
    
    class Meta:
        ordering = ['-timestamp']
        verbose_name_plural = 'Saved Histories'
