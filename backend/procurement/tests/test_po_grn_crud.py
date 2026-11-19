import pytest

from procurement.models import GoodsReceiptNote, PurchaseOrder
from vendors.models import Vendor


@pytest.fixture
def vendor(db):
    return Vendor.objects.create(
        name="Acme Supplies", gstin="27AAACC1206D1ZG", email="billing@acme.test",
        bank_account_number="1234567890", bank_ifsc="HDFC0001234",
    )


def test_ap_admin_can_create_purchase_order(auth_client_ap_admin, vendor):
    resp = auth_client_ap_admin.post("/api/procurement/purchase-orders/", {
        "po_number": "PO-1001", "vendor": vendor.id, "total_amount": "5000.00",
    })
    assert resp.status_code == 201
    assert PurchaseOrder.objects.filter(po_number="PO-1001").exists()


def test_requester_cannot_create_purchase_order(auth_client_requester, vendor):
    resp = auth_client_requester.post("/api/procurement/purchase-orders/", {
        "po_number": "PO-1002", "vendor": vendor.id, "total_amount": "5000.00",
    })
    assert resp.status_code == 403


def test_grn_requires_existing_purchase_order(auth_client_ap_admin):
    resp = auth_client_ap_admin.post("/api/procurement/grns/", {
        "grn_number": "GRN-1", "purchase_order": 999999, "received_amount": "100.00",
    })
    assert resp.status_code == 400


def test_ap_admin_can_create_grn_for_existing_po(auth_client_ap_admin, vendor):
    po = PurchaseOrder.objects.create(po_number="PO-2001", vendor=vendor, total_amount="5000.00")
    resp = auth_client_ap_admin.post("/api/procurement/grns/", {
        "grn_number": "GRN-2001", "purchase_order": po.id, "received_amount": "5000.00",
    })
    assert resp.status_code == 201
    assert GoodsReceiptNote.objects.filter(grn_number="GRN-2001").exists()
