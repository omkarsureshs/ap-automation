from decimal import Decimal, InvalidOperation

from invoices.gstin import is_valid_gstin
from invoices.models import Invoice
from vendors.models import Vendor

MANDATORY_FIELDS = (
    "extracted_invoice_no",
    "extracted_invoice_date",
    "extracted_gstin",
    "extracted_total_amount",
    "extracted_vendor_name",
)


def validate_invoice(invoice: Invoice) -> list[str]:
    reasons = []

    for field in MANDATORY_FIELDS:
        if getattr(invoice, field) is None:
            reasons.append(f"Missing mandatory field: {field}")

    if invoice.extracted_invoice_no and invoice.extracted_vendor_name:
        is_duplicate = (
            Invoice.objects.filter(
                extracted_invoice_no=invoice.extracted_invoice_no,
                extracted_vendor_name=invoice.extracted_vendor_name,
                status=Invoice.STATUS_VALIDATED,
            )
            .exclude(pk=invoice.pk)
            .exists()
        )
        if is_duplicate:
            reasons.append("Duplicate invoice: matching invoice_no and vendor already validated")

    if invoice.extracted_gstin and not is_valid_gstin(invoice.extracted_gstin):
        reasons.append("Invalid GSTIN checksum")
    elif invoice.extracted_gstin:
        vendor = Vendor.objects.filter(gstin=invoice.extracted_gstin).first()
        if vendor is None:
            reasons.append("Vendor not found in master")
        elif not vendor.is_active:
            reasons.append("Vendor is inactive")

    if invoice.extracted_total_amount:
        try:
            amount = Decimal(invoice.extracted_total_amount.replace(",", ""))
            if amount <= 0:
                reasons.append("Invalid amount format: must be positive")
        except InvalidOperation:
            reasons.append("Invalid amount format")

    return reasons
