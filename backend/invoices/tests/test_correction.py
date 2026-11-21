import pytest

from invoices.models import Invoice, InvoiceException


def _needs_review_invoice(django_user_model, **extracted):
    user = django_user_model.objects.create_user(
        email="uploader-correct@x.com", password="pw12345!", role="requester"
    )
    defaults = {
        "extracted_invoice_no": "CON2627U10699",
        "extracted_invoice_date": None,
        "extracted_gstin": "27AAACC1206D1ZG",
        "extracted_total_amount": "3,149.70",
        "extracted_vendor_name": None,
    }
    defaults.update(extracted)
    invoice = Invoice.objects.create(
        file="invoices/correction-test.pdf",
        uploaded_by=user,
        status=Invoice.STATUS_NEEDS_REVIEW,
        raw_ocr_text="Invoice Date 117/11/2026",
        **defaults,
    )
    InvoiceException.objects.create(invoice=invoice, reason="Missing mandatory field: extracted_invoice_date")
    InvoiceException.objects.create(invoice=invoice, reason="Missing mandatory field: extracted_vendor_name")
    return invoice


@pytest.mark.django_db
def test_ap_admin_can_correct_a_misread_field_and_it_revalidates(
    auth_client_ap_admin, django_user_model, known_vendor_for_sample_invoice
):
    invoice = _needs_review_invoice(
        django_user_model,
        extracted_invoice_no="INV-2026-0099",
        extracted_gstin="27AAACC1206D1ZG",
        extracted_vendor_name="Acme Supplies Pvt Ltd",
    )
    resp = auth_client_ap_admin.patch(
        f"/api/invoices/{invoice.id}/correct/", {"extracted_invoice_date": "17/11/2026"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "validated"
    assert body["exceptions"] == []
    invoice.refresh_from_db()
    assert invoice.extracted_invoice_date == "17/11/2026"


@pytest.mark.django_db
def test_correction_that_still_fails_validation_stays_needs_review(
    auth_client_ap_admin, django_user_model
):
    invoice = _needs_review_invoice(django_user_model)
    resp = auth_client_ap_admin.patch(
        f"/api/invoices/{invoice.id}/correct/", {"extracted_invoice_date": "17/11/2026"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "needs_review"
    reasons = [e["reason"] for e in body["exceptions"]]
    assert "Missing mandatory field: extracted_vendor_name" in reasons
    assert "Missing mandatory field: extracted_invoice_date" not in reasons


@pytest.mark.django_db
def test_non_ap_admin_cannot_correct_invoice(auth_client_requester, django_user_model):
    invoice = _needs_review_invoice(django_user_model)
    resp = auth_client_requester.patch(
        f"/api/invoices/{invoice.id}/correct/", {"extracted_invoice_date": "17/11/2026"}
    )
    assert resp.status_code == 403


@pytest.mark.django_db
def test_cannot_correct_an_invoice_past_needs_review(auth_client_ap_admin, django_user_model):
    invoice = _needs_review_invoice(django_user_model)
    invoice.status = Invoice.STATUS_APPROVED
    invoice.save()
    resp = auth_client_ap_admin.patch(
        f"/api/invoices/{invoice.id}/correct/", {"extracted_invoice_date": "17/11/2026"}
    )
    assert resp.status_code == 400
