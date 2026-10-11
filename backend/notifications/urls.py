from django.urls import path

from .views import NotificationListView, ReadAllView

urlpatterns = [
    path('', NotificationListView.as_view(), name='notification-list'),
    path('read-all/', ReadAllView.as_view(), name='notification-read-all'),
]
