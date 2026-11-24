import pytest

from invoices.models import Invoice
from procurement.models import PurchaseOrder
from workflow.models import ApprovalRule


def _validated_invoice_without_po(django_user_model, vendor, **extracted):
    user = django_user_model.objects.create_user(
        email="uploader-linkpo@x.com", password="pw12345!", role="requester"
    )
    defaults = {
        "extracted_invoice_no": "LINKPO-1001",
        "extracted_invoice_date": "18/11/2026",
        "extracted_gstin": vendor.gstin,
        "extracted_total_amount": "67,800.00",
        "extracted_vendor_name": vendor.name,
    }
    defaults.update(extracted)
    return Invoice.objects.create(
        file="invoices/link-po-test.pdf",
        uploaded_by=user,
        status=Invoice.STATUS_VALIDATED,
        raw_ocr_text="...",
        **defaults,
    )


@pytest.mark.django_db
def test_ap_admin_can_link_a_purchase_order_and_it_matches_into_approval(
    auth_client_ap_admin, django_user_model, known_vendor_for_sample_invoice
):
    ApprovalRule.objects.create(
        min_amount="0.00", max_amount="100000.00", approver_roles=["approver"], escalation_hours=24
    )
    po = PurchaseOrder.objects.create(
        po_number="PO-LINK-001", vendor=known_vendor_for_sample_invoice, total_amount="68000.00"
    )
    invoice = _validated_invoice_without_po(django_user_model, known_vendor_for_sample_invoice)

    resp = auth_client_ap_admin.patch(f"/api/invoices/{invoice.id}/link-po/", {"purchase_order": po.id})

    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "pending_approval"
    assert body["match_status"] == "matched"
    assert body["purchase_order"] == po.id


@pytest.mark.django_db
def test_linking_a_purchase_order_beyond_tolerance_lands_in_needs_review(
    auth_client_ap_admin, django_user_model, known_vendor_for_sample_invoice
):
    po = PurchaseOrder.objects.create(
        po_number="PO-LINK-002", vendor=known_vendor_for_sample_invoice, total_amount="100000.00"
    )
    invoice = _validated_invoice_without_po(django_user_model, known_vendor_for_sample_invoice)

    resp = auth_client_ap_admin.patch(f"/api/invoices/{invoice.id}/link-po/", {"purchase_order": po.id})

    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "needs_review"
    assert body["match_status"] == "mismatched"
    assert any("does not match PO amount" in e["reason"] for e in body["exceptions"])


@pytest.mark.django_db
def test_cannot_link_a_purchase_order_to_an_invoice_that_already_has_one(
    auth_client_ap_admin, django_user_model, known_vendor_for_sample_invoice
):
    po = PurchaseOrder.objects.create(
        po_number="PO-LINK-003", vendor=known_vendor_for_sample_invoice, total_amount="68000.00"
    )
    other_po = PurchaseOrder.objects.create(
        po_number="PO-LINK-004", vendor=known_vendor_for_sample_invoice, total_amount="68000.00"
    )
    invoice = _validated_invoice_without_po(django_user_model, known_vendor_for_sample_invoice)
    invoice.purchase_order = po
    invoice.save()

    resp = auth_client_ap_admin.patch(f"/api/invoices/{invoice.id}/link-po/", {"purchase_order": other_po.id})

    assert resp.status_code == 400


@pytest.mark.django_db
def test_cannot_link_a_purchase_order_past_needs_review(
    auth_client_ap_admin, django_user_model, known_vendor_for_sample_invoice
):
    po = PurchaseOrder.objects.create(
        po_number="PO-LINK-005", vendor=known_vendor_for_sample_invoice, total_amount="68000.00"
    )
    invoice = _validated_invoice_without_po(django_user_model, known_vendor_for_sample_invoice)
    invoice.status = Invoice.STATUS_APPROVED
    invoice.save()

    resp = auth_client_ap_admin.patch(f"/api/invoices/{invoice.id}/link-po/", {"purchase_order": po.id})

    assert resp.status_code == 400


@pytest.mark.django_db
def test_non_ap_admin_cannot_link_a_purchase_order(
    auth_client_requester, django_user_model, known_vendor_for_sample_invoice
):
    po = PurchaseOrder.objects.create(
        po_number="PO-LINK-006", vendor=known_vendor_for_sample_invoice, total_amount="68000.00"
    )
    invoice = _validated_invoice_without_po(django_user_model, known_vendor_for_sample_invoice)

    resp = auth_client_requester.patch(f"/api/invoices/{invoice.id}/link-po/", {"purchase_order": po.id})

    assert resp.status_code == 403
