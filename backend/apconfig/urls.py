from django.http import JsonResponse
from django.urls import include, path


def health_check(request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("api/health/", health_check, name="health-check"),
    path("api/auth/", include("accounts.urls")),
    path("api/invoices/", include("invoices.urls")),
]
