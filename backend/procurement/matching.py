from decimal import Decimal, InvalidOperation

from django.db.models import Sum

from invoices.models import Invoice

AMOUNT_TOLERANCE_PERCENT = Decimal("1")


def _within_tolerance(a: Decimal, b: Decimal) -> bool:
    if b == 0:
        return a == 0
    diff_percent = abs(a - b) / b * 100
    return diff_percent <= AMOUNT_TOLERANCE_PERCENT


def match_invoice(invoice: Invoice) -> list[str]:
    if invoice.purchase_order is None:
        return ["No purchase order linked — cannot match"]

    reasons = []
    po = invoice.purchase_order
    po_amount = Decimal(str(po.total_amount))

    try:
        invoice_amount = Decimal(invoice.extracted_total_amount.replace(",", ""))
    except (InvalidOperation, AttributeError):
        return ["Invoice amount is not a valid number — cannot match"]

    if invoice.extracted_gstin and invoice.extracted_gstin != po.vendor.gstin:
        reasons.append(
            f"Invoice vendor GSTIN {invoice.extracted_gstin} does not match PO vendor GSTIN {po.vendor.gstin}"
        )

    if not _within_tolerance(invoice_amount, po_amount):
        reasons.append(
            f"Invoice amount {invoice_amount} does not match PO amount {po_amount} within tolerance"
        )

    grn_total = po.grns.aggregate(total=Sum("received_amount"))["total"]
    if grn_total is not None:
        grn_amount = Decimal(str(grn_total))
        if not _within_tolerance(grn_amount, po_amount):
            reasons.append(
                f"Total GRN received amount {grn_amount} does not match PO amount {po_amount} within tolerance"
            )
        if not _within_tolerance(invoice_amount, grn_amount):
            reasons.append(
                f"Invoice amount {invoice_amount} does not match total GRN received amount {grn_amount} within tolerance"
            )

    return reasons
