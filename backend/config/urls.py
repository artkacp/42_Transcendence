"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from api.urls import public_urlpatterns

urlpatterns = [
    path('', include('django_prometheus.urls')),
    path('admin/', admin.site.urls),
    path('api/auth/', include('accounts.auth_urls')),
    path('api/users/', include('accounts.urls')),
    path('api/notifications/', include('notifications.urls')),
    path('api/', include('pets.urls')),
    path('api/', include('inquiries.urls')),
    path('api/', include('analytics.urls')),
    path('api/', include('api.urls')),
    # Third-party API: X-API-Key only, separate from the JWT app API above.
    path('api/public/v1/', include(public_urlpatterns)),
    # Serves uploaded files (avatars, photos) in dev only; empty when DEBUG is off.
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
