from django.urls import path

from invoices.views import (
    InvoiceCorrectionView,
    InvoiceDeleteView,
    InvoiceLinkPurchaseOrderView,
    InvoiceUploadView,
)

urlpatterns = [
    path("", InvoiceUploadView.as_view(), name="invoice-list-create"),
    path("<int:pk>/correct/", InvoiceCorrectionView.as_view(), name="invoice-correct"),
    path("<int:pk>/link-po/", InvoiceLinkPurchaseOrderView.as_view(), name="invoice-link-po"),
    path("<int:pk>/", InvoiceDeleteView.as_view(), name="invoice-delete"),
]
