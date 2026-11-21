from django.urls import path

from invoices.views import InvoiceCorrectionView, InvoiceUploadView

urlpatterns = [
    path("", InvoiceUploadView.as_view(), name="invoice-list-create"),
    path("<int:pk>/correct/", InvoiceCorrectionView.as_view(), name="invoice-correct"),
]
