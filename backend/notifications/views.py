from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from core.pagination import NotificationPagination

from .serializers import NotificationSerializer


class NotificationListView(generics.ListAPIView):
    serializer_class = NotificationSerializer
    pagination_class = NotificationPagination

    def get_queryset(self):
        return self.request.user.notifications.order_by('-created_at')

    # DELETE /notifications/ (clear all)
    def delete(self, request):
        self.get_queryset().delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ReadAllView(APIView):
    def post(self, request):
        request.user.notifications.filter(is_read=False).update(is_read=True)
        return Response(status=status.HTTP_204_NO_CONTENT)
