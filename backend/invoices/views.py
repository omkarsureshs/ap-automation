from rest_framework import generics
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from accounts.permissions import HasRole
from invoices.extraction import extract_fields
from invoices.models import Invoice, InvoiceException
from invoices.ocr import OcrError, run_ocr
from invoices.serializers import InvoiceCorrectionSerializer, InvoiceSerializer
from invoices.validation import validate_invoice
from procurement.matching import match_invoice
from workflow.services import start_approval


def _validate_and_match(invoice):
    """Run validation, then PO matching and approval start if validation passed.

    Shared by the initial upload (after OCR) and the AP Admin correction flow
    (after a human fixes a field OCR misread), so both paths reach the same
    status/match_status/exceptions outcome for the same field values.
    """
    reasons = validate_invoice(invoice)
    if reasons:
        InvoiceException.objects.bulk_create(
            [InvoiceException(invoice=invoice, reason=reason) for reason in reasons]
        )
        invoice.status = Invoice.STATUS_NEEDS_REVIEW
        return

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

            _validate_and_match(invoice)
        except OcrError as exc:
            reason = f"OCR failed: {exc}"[:255]
            InvoiceException.objects.create(invoice=invoice, reason=reason)
            invoice.status = Invoice.STATUS_NEEDS_REVIEW
        invoice.save()


_DELETABLE_STATUSES = (Invoice.STATUS_UPLOADED, Invoice.STATUS_EXTRACTED, Invoice.STATUS_NEEDS_REVIEW)


class InvoiceDeleteView(generics.DestroyAPIView):
    """AP Admin withdraws a mistakenly uploaded invoice.

    Only before it has entered the approval chain: once validated/approved/
    paid it's a financial record, not a draft, so deletion is blocked (use
    the audit trail / reject flow instead, same as a real AP system).
    """

    queryset = Invoice.objects.all()
    permission_classes = [HasRole("ap_admin")]

    def perform_destroy(self, instance):
        if instance.status not in _DELETABLE_STATUSES:
            raise ValidationError(
                {"detail": f"Only invoices not yet validated can be deleted (current status: {instance.status})."}
            )
        instance.delete()


class InvoiceCorrectionView(generics.UpdateAPIView):
    """AP Admin fixes a field OCR misread (e.g. a garbled date) and re-validates.

    Only invoices parked in Needs Review are eligible: once an invoice has
    moved on to approval/payment, its extracted fields are no longer in play.
    """

    queryset = Invoice.objects.all()
    serializer_class = InvoiceCorrectionSerializer
    permission_classes = [HasRole("ap_admin")]
    http_method_names = ["patch"]

    def update(self, request, *args, **kwargs):
        invoice = self.get_object()
        if invoice.status != Invoice.STATUS_NEEDS_REVIEW:
            raise ValidationError(
                {"status": [f"Only invoices in needs_review can be corrected (current status: {invoice.status})."]}
            )
        serializer = self.get_serializer(invoice, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        invoice = serializer.save()
        invoice.exceptions.all().delete()
        invoice.match_status = Invoice.MATCH_STATUS_UNMATCHED
        _validate_and_match(invoice)
        invoice.save()
        return Response(InvoiceSerializer(invoice).data)
