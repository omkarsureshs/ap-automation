from django.urls import path

from invoices.views import InvoiceUploadView

urlpatterns = [
    path("", InvoiceUploadView.as_view(), name="invoice-list-create"),
]
