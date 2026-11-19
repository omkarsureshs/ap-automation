from rest_framework import generics

from accounts.permissions import HasRole
from invoices.extraction import extract_fields
from invoices.models import Invoice, InvoiceException
from invoices.ocr import OcrError, run_ocr
from invoices.serializers import InvoiceSerializer
from invoices.validation import validate_invoice
from procurement.matching import match_invoice
from workflow.services import start_approval


class InvoiceUploadView(generics.ListCreateAPIView):
    queryset = Invoice.objects.all()
    serializer_class = InvoiceSerializer
    permission_classes = [HasRole("requester", "ap_admin")]

    def perform_create(self, serializer):
        invoice = serializer.save()
        try:
            invoice.raw_ocr_text = run_ocr(invoice.file.path)
            invoice.status = Invoice.STATUS_EXTRACTED
            fields = extract_fields(invoice.raw_ocr_text)
            invoice.extracted_invoice_no = fields["invoice_no"]
            invoice.extracted_invoice_date = fields["invoice_date"]
            invoice.extracted_gstin = fields["gstin"]
            invoice.extracted_total_amount = fields["total_amount"]
            invoice.extracted_vendor_name = fields["vendor_name"]

            reasons = validate_invoice(invoice)
            if reasons:
                InvoiceException.objects.bulk_create(
                    [InvoiceException(invoice=invoice, reason=reason) for reason in reasons]
                )
                invoice.status = Invoice.STATUS_NEEDS_REVIEW
            else:
                invoice.status = Invoice.STATUS_VALIDATED
                if invoice.purchase_order is not None:
                    match_reasons = match_invoice(invoice)
                    if match_reasons:
                        InvoiceException.objects.bulk_create(
                            [InvoiceException(invoice=invoice, reason=reason) for reason in match_reasons]
                        )
                        invoice.match_status = Invoice.MATCH_STATUS_MISMATCHED
                        invoice.status = Invoice.STATUS_NEEDS_REVIEW
                    else:
                        invoice.match_status = Invoice.MATCH_STATUS_MATCHED
                        try:
                            start_approval(invoice)
                            invoice.status = Invoice.STATUS_PENDING_APPROVAL
                        except ValueError as exc:
                            InvoiceException.objects.create(invoice=invoice, reason=str(exc)[:255])
                            invoice.status = Invoice.STATUS_NEEDS_REVIEW
        except OcrError as exc:
            reason = f"OCR failed: {exc}"[:255]
            InvoiceException.objects.create(invoice=invoice, reason=reason)
            invoice.status = Invoice.STATUS_NEEDS_REVIEW
        invoice.save()
