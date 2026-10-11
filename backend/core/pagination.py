from rest_framework.pagination import PageNumberPagination


class FixedPagePagination(PageNumberPagination):
    page_size = 6
