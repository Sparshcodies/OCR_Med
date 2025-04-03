from django.contrib import admin
from .models import Pharmacy, Doctor, Hospital, Lab, SavedLocation

admin.site.register(Pharmacy)
admin.site.register(Doctor)
admin.site.register(Hospital)
admin.site.register(Lab)
admin.site.register(SavedLocation)