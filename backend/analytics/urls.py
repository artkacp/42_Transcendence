from django.urls import path

from .views import PlatformAnalyticsView, UserAnalyticsView

urlpatterns = [
    path('analytics/me/', UserAnalyticsView.as_view(), name='analytics-me'),
    path('analytics/platform/', PlatformAnalyticsView.as_view(), name='analytics-platform'),
]
