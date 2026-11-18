from rest_framework import generics

from accounts.permissions import HasRole
from invoices.models import Invoice
from invoices.ocr import OcrError, run_ocr
from invoices.serializers import InvoiceSerializer


class InvoiceUploadView(generics.ListCreateAPIView):
    queryset = Invoice.objects.all()
    serializer_class = InvoiceSerializer
    permission_classes = [HasRole("requester", "ap_admin")]

    def perform_create(self, serializer):
        invoice = serializer.save()
        try:
            invoice.raw_ocr_text = run_ocr(invoice.file.path)
            invoice.status = Invoice.STATUS_EXTRACTED
        except OcrError:
            invoice.status = Invoice.STATUS_NEEDS_REVIEW
        invoice.save()
