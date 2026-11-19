import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from procurement.csv_import import import_grns_csv, import_purchase_orders_csv
from procurement.models import GoodsReceiptNote, PurchaseOrder
from vendors.models import Vendor


@pytest.fixture
def vendor(db):
    return Vendor.objects.create(
        name="Acme Supplies", gstin="27AAACC1206D1ZG", email="billing@acme.test",
        bank_account_number="1234567890", bank_ifsc="HDFC0001234",
    )


def _csv_file(name, content):
    return SimpleUploadedFile(name, content.encode(), content_type="text/csv")


def test_import_purchase_orders_csv_creates_rows_and_reports_errors(db, vendor):
    csv_content = (
        "po_number,vendor_gstin,total_amount\n"
        "PO-3001,27AAACC1206D1ZG,1000.00\n"
        "PO-3002,27AAACC1206D1ZG,not-a-number\n"
        "PO-3003,99UNKNOWN0000A1Z5,500.00\n"
    )
    result = import_purchase_orders_csv(_csv_file("pos.csv", csv_content))
    assert result["created"] == 1
    assert len(result["errors"]) == 2
    assert PurchaseOrder.objects.filter(po_number="PO-3001").exists()
    assert not PurchaseOrder.objects.filter(po_number="PO-3002").exists()
    assert not PurchaseOrder.objects.filter(po_number="PO-3003").exists()


def test_import_purchase_orders_csv_rejects_duplicate_po_number(db, vendor):
    PurchaseOrder.objects.create(po_number="PO-4001", vendor=vendor, total_amount="200.00")
    csv_content = "po_number,vendor_gstin,total_amount\nPO-4001,27AAACC1206D1ZG,200.00\n"
    result = import_purchase_orders_csv(_csv_file("pos.csv", csv_content))
    assert result["created"] == 0
    assert len(result["errors"]) == 1
    assert "already" in result["errors"][0]["message"].lower()


def test_import_grns_csv_rejects_unknown_po_number(db):
    csv_content = "grn_number,po_number,received_amount\nGRN-5001,PO-UNKNOWN,100.00\n"
    result = import_grns_csv(_csv_file("grns.csv", csv_content))
    assert result["created"] == 0
    assert len(result["errors"]) == 1
    assert not GoodsReceiptNote.objects.filter(grn_number="GRN-5001").exists()


def test_import_grns_csv_creates_valid_rows(db, vendor):
    po = PurchaseOrder.objects.create(po_number="PO-6001", vendor=vendor, total_amount="300.00")
    csv_content = f"grn_number,po_number,received_amount\nGRN-6001,{po.po_number},300.00\n"
    result = import_grns_csv(_csv_file("grns.csv", csv_content))
    assert result["created"] == 1
    assert result["errors"] == []
    assert GoodsReceiptNote.objects.filter(grn_number="GRN-6001").exists()
