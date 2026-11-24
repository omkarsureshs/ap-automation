import csv
import io
from decimal import Decimal, InvalidOperation

from procurement.models import GoodsReceiptNote, PurchaseOrder
from vendors.models import Vendor

# Matches PurchaseOrder.total_amount / GoodsReceiptNote.received_amount:
# DecimalField(max_digits=14, decimal_places=2) allows values up to 10^12.
_MAX_AMOUNT = Decimal("999999999999.99")


def _cell(row, key):
    # csv.DictReader fills a missing trailing cell with None, not "".
    return (row.get(key) or "").strip()


def _parse_positive_amount(raw_value):
    # Accept thousands-separator commas (e.g. "68,000.00") since that's how
    # amounts are written everywhere else in this project's own documentation.
    try:
        amount = Decimal(raw_value.replace(",", ""))
    except (InvalidOperation, TypeError, AttributeError):
        return None
    if not amount.is_finite() or amount <= 0 or amount > _MAX_AMOUNT:
        return None
    return amount


def import_purchase_orders_csv(file) -> dict:
    reader = csv.DictReader(io.TextIOWrapper(file.file, encoding="utf-8-sig"))
    created = 0
    errors = []

    for row_number, row in enumerate(reader, start=1):
        po_number = _cell(row, "po_number")
        vendor_gstin = _cell(row, "vendor_gstin")
        amount = _parse_positive_amount(_cell(row, "total_amount"))

        if not po_number:
            errors.append({"row": row_number, "message": "Missing po_number"})
            continue
        if PurchaseOrder.objects.filter(po_number=po_number).exists():
            errors.append({"row": row_number, "message": f"PO number {po_number!r} already exists"})
            continue
        if amount is None:
            errors.append({"row": row_number, "message": "Invalid total_amount: must be a positive number"})
            continue
        vendor = Vendor.objects.filter(gstin=vendor_gstin).first()
        if vendor is None:
            errors.append({"row": row_number, "message": f"Unknown vendor GSTIN {vendor_gstin!r}"})
            continue

        PurchaseOrder.objects.create(po_number=po_number, vendor=vendor, total_amount=amount)
        created += 1

    return {"created": created, "errors": errors}


def import_grns_csv(file) -> dict:
    reader = csv.DictReader(io.TextIOWrapper(file.file, encoding="utf-8-sig"))
    created = 0
    errors = []

    for row_number, row in enumerate(reader, start=1):
        grn_number = _cell(row, "grn_number")
        po_number = _cell(row, "po_number")
        amount = _parse_positive_amount(_cell(row, "received_amount"))

        if not grn_number:
            errors.append({"row": row_number, "message": "Missing grn_number"})
            continue
        if GoodsReceiptNote.objects.filter(grn_number=grn_number).exists():
            errors.append({"row": row_number, "message": f"GRN number {grn_number!r} already exists"})
            continue
        if amount is None:
            errors.append({"row": row_number, "message": "Invalid received_amount: must be a positive number"})
            continue
        purchase_order = PurchaseOrder.objects.filter(po_number=po_number).first()
        if purchase_order is None:
            errors.append({"row": row_number, "message": f"Unknown PO number {po_number!r}"})
            continue

        GoodsReceiptNote.objects.create(
            grn_number=grn_number, purchase_order=purchase_order, received_amount=amount
        )
        created += 1

    return {"created": created, "errors": errors}
