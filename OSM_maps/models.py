from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone

class Pharmacy(models.Model):
    name = models.CharField(max_length=255)
    latitude = models.FloatField()
    longitude = models.FloatField()
    address = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.name
    
class SearchHistory(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='search_history')
    query = models.CharField(max_length=255)
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.query}"
    
    class Meta:
        ordering = ['-timestamp']
        verbose_name_plural = 'Search Histories'
        
class UserLoginHistory(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='login_history')
    login_timestamp = models.DateTimeField(default=timezone.now)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    def __str__(self):
        return f"{self.user.username} - {self.login_timestamp}"
    
    class Meta:
        ordering = ['-login_timestamp']
        verbose_name_plural = 'User Login Histories'
