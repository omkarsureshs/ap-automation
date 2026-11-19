import csv
import io
from decimal import Decimal, InvalidOperation

from procurement.models import GoodsReceiptNote, PurchaseOrder
from vendors.models import Vendor


def _parse_positive_amount(raw_value):
    try:
        amount = Decimal(raw_value)
    except (InvalidOperation, TypeError):
        return None
    if amount <= 0:
        return None
    return amount


def import_purchase_orders_csv(file) -> dict:
    reader = csv.DictReader(io.TextIOWrapper(file.file, encoding="utf-8"))
    created = 0
    errors = []

    for row_number, row in enumerate(reader, start=1):
        po_number = row.get("po_number", "").strip()
        vendor_gstin = row.get("vendor_gstin", "").strip()
        amount = _parse_positive_amount(row.get("total_amount", "").strip())

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
    reader = csv.DictReader(io.TextIOWrapper(file.file, encoding="utf-8"))
    created = 0
    errors = []

    for row_number, row in enumerate(reader, start=1):
        grn_number = row.get("grn_number", "").strip()
        po_number = row.get("po_number", "").strip()
        amount = _parse_positive_amount(row.get("received_amount", "").strip())

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
