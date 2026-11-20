from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from invoices.models import Invoice, InvoiceException
from payments.models import Payment
from workflow.models import ApprovalRule, ApprovalStep

BUCKETS = ["0-7 days", "8-30 days", "31-60 days", "60+ days"]


@pytest.fixture
def user(django_user_model):
    return django_user_model.objects.create_user(email="u@x.com", password="pw12345!", role="approver")


def mk(user, age_days=1, **kw):
    kw.setdefault("file", "invoices/x.pdf")
    inv = Invoice.objects.create(uploaded_by=user, **kw)
    Invoice.objects.filter(pk=inv.pk).update(created_at=timezone.now() - timedelta(days=age_days))
    inv.refresh_from_db()
    return inv


def rule():
    return ApprovalRule.objects.create(min_amount=0, max_amount=10**6, approver_roles=["approver"], escalation_hours=24)


def test_requires_auth(client, db):
    assert client.get("/api/dashboard/summary/").status_code == 401


def test_requester_cannot_see_summary(auth_client_requester):
    # Dashboard/report data spans vendor GSTINs, approver decisions and payment
    # history — more than the invoice list itself exposes to this role.
    assert auth_client_requester.get("/api/dashboard/summary/").status_code == 403


def test_requester_cannot_see_reports(auth_client_requester):
    assert auth_client_requester.get("/api/dashboard/reports/gst-tax/").status_code == 403


def test_approver_can_see_summary_and_reports(auth_client_approver):
    assert auth_client_approver.get("/api/dashboard/summary/").status_code == 200
    assert auth_client_approver.get("/api/dashboard/reports/gst-tax/").status_code == 200


def test_summary_zero_data(auth_client_ap_admin):
    data = auth_client_ap_admin.get("/api/dashboard/summary/").json()
    assert [b["bucket"] for b in data["invoice_aging"]] == BUCKETS
    assert all(b["count"] == 0 and b["total_amount"] == "0.00" for b in data["invoice_aging"])
    assert data["pending_approvals"] == 0
    assert data["avg_turnaround_hours"] is None
    assert data["ocr_accuracy_percent"] is None
    assert data["vendor_analytics"] == []
    assert data["payment_tracking"] == {"processing": 0, "completed": 0, "failed": 0, "total_paid_amount": "0.00"}


def test_summary_with_data(auth_client_ap_admin, user):
    mk(user, 3, extracted_total_amount="1,000.50", status="validated", raw_ocr_text="t",
       extracted_vendor_name="Acme")
    bad = mk(user, 20, extracted_total_amount="garbage", status="needs_review", raw_ocr_text="t",
             extracted_vendor_name="Acme")
    InvoiceException.objects.create(invoice=bad, reason="r")
    mk(user, 90, extracted_total_amount="200", status="uploaded")
    mk(user, 90, extracted_total_amount="999", status="rejected")  # excluded from aging
    p = mk(user, 10, extracted_total_amount="500", status="paid", raw_ocr_text="t", extracted_vendor_name="Beta")
    Payment.objects.create(invoice=p, amount=Decimal("500"), status="completed", requested_by=user,
                           completed_at=p.created_at + timedelta(hours=10))
    ApprovalStep.objects.create(invoice=bad, rule=rule(), approver_role="approver")

    d = auth_client_ap_admin.get("/api/dashboard/summary/").json()
    aging = {b["bucket"]: b for b in d["invoice_aging"]}
    assert aging["0-7 days"] == {"bucket": "0-7 days", "count": 1, "total_amount": "1000.50"}
    assert aging["8-30 days"]["count"] == 1 and aging["8-30 days"]["total_amount"] == "0.00"
    assert aging["60+ days"] == {"bucket": "60+ days", "count": 1, "total_amount": "200.00"}
    assert d["pending_approvals"] == 1
    assert d["avg_turnaround_hours"] == 10.0
    # 3 OCR'd: validated(clean) + paid(clean) count; needs_review doesn't -> 2/3
    assert d["ocr_accuracy_percent"] == 66.67
    assert d["vendor_analytics"][0] == {"vendor_name": "Acme", "invoice_count": 2, "total_amount": "1000.50"}
    assert d["payment_tracking"]["completed"] == 1 and d["payment_tracking"]["total_paid_amount"] == "500.00"


def test_reports_unknown_kind_404(auth_client_ap_admin):
    assert auth_client_ap_admin.get("/api/dashboard/reports/nope/").status_code == 404


def test_report_ap_aging_excludes_paid(auth_client_ap_admin, user):
    mk(user, 5, extracted_invoice_no="A1", extracted_vendor_name="Acme", extracted_total_amount="10", status="validated")
    mk(user, 5, extracted_invoice_no="P1", status="paid")
    rows = auth_client_ap_admin.get("/api/dashboard/reports/ap-aging/").json()
    assert rows == [{"invoice_no": "A1", "vendor_name": "Acme", "amount": "10", "age_days": 5, "status": "validated"}]


def test_report_invoice_status(auth_client_ap_admin, user):
    mk(user, status="paid")
    mk(user, status="paid")
    mk(user, status="uploaded")
    rows = auth_client_ap_admin.get("/api/dashboard/reports/invoice-status/").json()
    assert {r["status"]: r["count"] for r in rows} == {"paid": 2, "uploaded": 1}


def test_report_exceptions(auth_client_ap_admin, user):
    inv = mk(user, extracted_invoice_no="E1")
    InvoiceException.objects.create(invoice=inv, reason="GSTIN invalid")
    rows = auth_client_ap_admin.get("/api/dashboard/reports/exceptions/").json()
    assert rows[0]["invoice_no"] == "E1" and rows[0]["reason"] == "GSTIN invalid" and rows[0]["created_at"]


def test_report_audit_log_union_newest_first(auth_client_ap_admin, user):
    inv = mk(user, 5, extracted_invoice_no="L1", status="paid")
    InvoiceException.objects.create(invoice=inv, reason="oops")
    now = timezone.now()
    ApprovalStep.objects.create(invoice=inv, rule=rule(), approver_role="approver", status="approved",
                                decided_at=now - timedelta(hours=2), decided_by=user)
    Payment.objects.create(invoice=inv, amount=1, status="completed", requested_by=user,
                           completed_at=now + timedelta(hours=1))
    rows = auth_client_ap_admin.get("/api/dashboard/reports/audit-log/").json()
    assert [r["event"] for r in rows] == ["payment_completed", "exception_raised", "approval_approved"]
    assert [r["actor"] for r in rows] == ["u@x.com", "system", "u@x.com"]
    assert set(rows[0]) == {"timestamp", "actor", "event", "detail"}


def test_report_gst_tax_excludes_nulls(auth_client_ap_admin, user):
    mk(user, extracted_invoice_no="G1", extracted_gstin="27AAACC1206D1ZG", extracted_total_amount="1,200")
    mk(user, extracted_invoice_no="G2", extracted_gstin="27AAACC1206D1ZG")
    mk(user, extracted_invoice_no="G3", extracted_total_amount="5")
    rows = auth_client_ap_admin.get("/api/dashboard/reports/gst-tax/").json()
    assert rows == [{"invoice_no": "G1", "vendor_gstin": "27AAACC1206D1ZG", "taxable_amount": "1200"}]


@pytest.mark.parametrize("kind,header", [
    ("ap-aging", "invoice_no,vendor_name,amount,age_days,status"),
    ("invoice-status", "status,count"),
    ("exceptions", "invoice_no,reason,created_at"),
    ("audit-log", "timestamp,actor,event,detail"),
    ("gst-tax", "invoice_no,vendor_gstin,taxable_amount"),
])
def test_csv_export_header(auth_client_ap_admin, kind, header):
    resp = auth_client_ap_admin.get(f"/api/dashboard/reports/{kind}/?format=csv")
    assert resp.status_code == 200
    assert resp["Content-Type"].startswith("text/csv")
    assert "attachment" in resp["Content-Disposition"]
    assert resp.content.decode().splitlines()[0] == header
