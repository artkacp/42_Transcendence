from rest_framework.response import Response
from rest_framework.views import APIView

from .services import get_user_analytics


class UserAnalyticsView(APIView):
    def get(self, request):
        data = get_user_analytics(request.user.id)
        return Response(data)
