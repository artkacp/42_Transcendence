from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .platform import get_platform_analytics, parse_filter_params
from .services import get_user_analytics


class UserAnalyticsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(get_user_analytics(request.user.id))


class PlatformAnalyticsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        params = parse_filter_params(request.query_params)
        return Response(get_platform_analytics(params))
