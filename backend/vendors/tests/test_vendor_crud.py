import pytest

from vendors.models import Vendor


@pytest.fixture
def vendor(db):
    return Vendor.objects.create(
        name="Acme Supplies",
        gstin="27AAACC1206D1ZG",
        email="billing@acme.test",
        bank_account_number="1234567890",
        bank_ifsc="HDFC0001234",
    )


def test_ap_admin_sees_full_bank_account_number(auth_client_ap_admin, vendor):
    resp = auth_client_ap_admin.get(f"/api/vendors/{vendor.id}/")
    assert resp.status_code == 200
    assert resp.json()["bank_account_number"] == "1234567890"


def test_requester_sees_masked_bank_account_number(auth_client_requester, vendor):
    resp = auth_client_requester.get(f"/api/vendors/{vendor.id}/")
    assert resp.status_code == 200
    assert resp.json()["bank_account_number"] == "****7890"


def test_requester_cannot_create_vendor(auth_client_requester):
    resp = auth_client_requester.post("/api/vendors/", {
        "name": "New Vendor", "gstin": "29AABCU9603R1ZM", "email": "x@x.test",
        "bank_account_number": "111222333", "bank_ifsc": "ICIC0001234",
    })
    assert resp.status_code == 403


def test_ap_admin_can_create_vendor(auth_client_ap_admin):
    resp = auth_client_ap_admin.post("/api/vendors/", {
        "name": "New Vendor", "gstin": "29AABCU9603R1ZM", "email": "x@x.test",
        "bank_account_number": "111222333", "bank_ifsc": "ICIC0001234",
    })
    assert resp.status_code == 201
    assert Vendor.objects.filter(gstin="29AABCU9603R1ZM").exists()


def test_ap_admin_can_deactivate_vendor(auth_client_ap_admin, vendor):
    resp = auth_client_ap_admin.patch(f"/api/vendors/{vendor.id}/", {"is_active": False}, format="json")
    assert resp.status_code == 200
    vendor.refresh_from_db()
    assert vendor.is_active is False


def test_ap_admin_can_delete_vendor_with_no_purchase_orders(auth_client_ap_admin, vendor):
    resp = auth_client_ap_admin.delete(f"/api/vendors/{vendor.id}/")
    assert resp.status_code == 204
    assert not Vendor.objects.filter(id=vendor.id).exists()


def test_deleting_vendor_with_purchase_orders_is_refused(auth_client_ap_admin, vendor):
    from procurement.models import PurchaseOrder

    PurchaseOrder.objects.create(po_number="PO-DEL-1", vendor=vendor, total_amount="100.00")
    resp = auth_client_ap_admin.delete(f"/api/vendors/{vendor.id}/")
    assert resp.status_code == 400
    assert Vendor.objects.filter(id=vendor.id).exists()


def test_requester_cannot_delete_vendor(auth_client_requester, vendor):
    resp = auth_client_requester.delete(f"/api/vendors/{vendor.id}/")
    assert resp.status_code == 403
    assert Vendor.objects.filter(id=vendor.id).exists()
