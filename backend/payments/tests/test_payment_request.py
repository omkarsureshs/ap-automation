import pytest

from invoices.models import Invoice
from payments.gateways import PaymentResult
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


def test_completed_payment_emails_a_payment_advice_to_the_vendor(auth_client_ap_admin, uploader, mailoutbox):
    from procurement.models import PurchaseOrder
    from vendors.models import Vendor

    vendor = Vendor.objects.create(
        name="Acme Supplies", gstin="27AAACC1206D1ZG", email="billing@acme.test",
        bank_account_number="1234567890", bank_ifsc="HDFC0001234",
    )
    po = PurchaseOrder.objects.create(po_number="PO-ADVICE-1", vendor=vendor, total_amount="1500.00")
    invoice = Invoice.objects.create(
        file="invoices/advice-test.pdf", uploaded_by=uploader, extracted_total_amount="1500.00",
        extracted_invoice_no="INV-ADVICE-1", status=Invoice.STATUS_APPROVED, purchase_order=po,
    )

    resp = auth_client_ap_admin.post("/api/payments/", {"invoice": invoice.id})
    assert resp.status_code == 201
    assert resp.json()["status"] == "completed"

    advice_emails = [m for m in mailoutbox if m.to == ["billing@acme.test"]]
    assert len(advice_emails) == 1
    assert "INV-ADVICE-1" in advice_emails[0].subject
    assert "1500.00" in advice_emails[0].body


def test_payment_advice_not_sent_when_invoice_has_no_po_linked(auth_client_ap_admin, approved_invoice, mailoutbox):
    resp = auth_client_ap_admin.post("/api/payments/", {"invoice": approved_invoice.id})
    assert resp.status_code == 201
    assert resp.json()["status"] == "completed"
    assert mailoutbox == []


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


def test_approver_can_list_but_not_request_payment(auth_client_approver, approved_invoice):
    assert auth_client_approver.get("/api/payments/").status_code == 200
    assert auth_client_approver.post("/api/payments/", {"invoice": approved_invoice.id}).status_code == 403


def test_a_failed_payment_can_be_retried(auth_client_ap_admin, approved_invoice, monkeypatch):
    monkeypatch.setattr(
        "payments.views.get_gateway",
        lambda: type("FailingGateway", (), {
            "initiate_payment": lambda self, amount, reference: PaymentResult(
                status="failed", gateway_reference="MOCK-FAIL", failure_reason="Simulated bank rejection"
            )
        })(),
    )
    first = auth_client_ap_admin.post("/api/payments/", {"invoice": approved_invoice.id})
    assert first.status_code == 201
    assert first.json()["status"] == "failed"
    approved_invoice.refresh_from_db()
    assert approved_invoice.status == Invoice.STATUS_APPROVED  # unchanged — payment never completed

    monkeypatch.undo()  # restore the real (always-succeeds) mock gateway
    second = auth_client_ap_admin.post("/api/payments/", {"invoice": approved_invoice.id})
    assert second.status_code == 201
    assert second.json()["status"] == "completed"
    assert Payment.objects.filter(invoice=approved_invoice).count() == 1  # old failed row replaced, not stacked


def test_request_payment_with_non_numeric_invoice_id_returns_400(auth_client_ap_admin):
    resp = auth_client_ap_admin.post("/api/payments/", {"invoice": "not-an-id"})
    assert resp.status_code == 400


def test_request_payment_rejects_non_positive_amount(auth_client_ap_admin, uploader):
    invoice = _invoice(uploader, Invoice.STATUS_APPROVED)
    invoice.extracted_total_amount = "0.00"
    invoice.save()
    resp = auth_client_ap_admin.post("/api/payments/", {"invoice": invoice.id})
    assert resp.status_code == 400
    assert not Payment.objects.filter(invoice=invoice).exists()
