from django.urls import path

from .views import UserAnalyticsView

urlpatterns = [
    path('analytics/me/', UserAnalyticsView.as_view(), name='analytics-me'),
]
