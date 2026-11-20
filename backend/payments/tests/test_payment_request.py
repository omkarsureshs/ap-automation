import pytest

from invoices.models import Invoice
from payments.models import Payment


@pytest.fixture
def uploader(django_user_model):
    return django_user_model.objects.create_user(email="pay-uploader@x.com", password="pw12345!", role="requester")


def _invoice(uploader, status):
    return Invoice.objects.create(
        file="invoices/pay-test.pdf",
        uploaded_by=uploader,
        extracted_total_amount="1500.00",
        status=status,
    )


@pytest.fixture
def approved_invoice(db, uploader):
    return _invoice(uploader, Invoice.STATUS_APPROVED)


@pytest.fixture
def pending_approval_invoice(db, uploader):
    return _invoice(uploader, Invoice.STATUS_PENDING_APPROVAL)


def test_ap_admin_can_request_payment_for_approved_invoice(auth_client_ap_admin, approved_invoice):
    resp = auth_client_ap_admin.post("/api/payments/", {"invoice": approved_invoice.id})
    assert resp.status_code == 201
    body = resp.json()
    assert body["status"] == "completed"
    assert body["gateway_reference"]
    assert Payment.objects.filter(invoice=approved_invoice).exists()


def test_requester_cannot_request_payment(auth_client_requester, approved_invoice):
    resp = auth_client_requester.post("/api/payments/", {"invoice": approved_invoice.id})
    assert resp.status_code == 403


def test_cannot_request_payment_for_non_approved_invoice(auth_client_ap_admin, pending_approval_invoice):
    resp = auth_client_ap_admin.post("/api/payments/", {"invoice": pending_approval_invoice.id})
    assert resp.status_code == 400
    assert not Payment.objects.filter(invoice=pending_approval_invoice).exists()


def test_cannot_request_payment_twice_for_the_same_invoice(auth_client_ap_admin, approved_invoice):
    first = auth_client_ap_admin.post("/api/payments/", {"invoice": approved_invoice.id})
    assert first.status_code == 201
    second = auth_client_ap_admin.post("/api/payments/", {"invoice": approved_invoice.id})
    assert second.status_code == 409
    assert Payment.objects.filter(invoice=approved_invoice).count() == 1


def test_successful_payment_marks_invoice_paid(auth_client_ap_admin, approved_invoice):
    auth_client_ap_admin.post("/api/payments/", {"invoice": approved_invoice.id})
    approved_invoice.refresh_from_db()
    assert approved_invoice.status == Invoice.STATUS_PAID


def test_ap_admin_can_list_payments(auth_client_ap_admin, approved_invoice):
    auth_client_ap_admin.post("/api/payments/", {"invoice": approved_invoice.id})
    resp = auth_client_ap_admin.get("/api/payments/")
    assert resp.status_code == 200
    assert len(resp.json()) == 1
