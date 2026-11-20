from django.urls import path

from dashboard.views import ReportView, SummaryView

urlpatterns = [
    path("summary/", SummaryView.as_view(), name="dashboard-summary"),
    path("reports/<str:kind>/", ReportView.as_view(), name="dashboard-report"),
]
