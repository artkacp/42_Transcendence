from rest_framework.pagination import PageNumberPagination


class FixedPagePagination(PageNumberPagination):
    page_size = 6


class NotificationPagination(PageNumberPagination):
    page_size = 30
