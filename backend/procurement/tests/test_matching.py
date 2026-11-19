import pytest

from invoices.models import Invoice
from procurement.matching import match_invoice
from procurement.models import GoodsReceiptNote, PurchaseOrder
from vendors.models import Vendor


@pytest.fixture
def uploader(django_user_model):
    return django_user_model.objects.create_user(email="uploader2@x.com", password="pw12345!", role="requester")


@pytest.fixture
def vendor(db):
    return Vendor.objects.create(
        name="Acme Supplies", gstin="27AAACC1206D1ZG", email="billing@acme.test",
        bank_account_number="1234567890", bank_ifsc="HDFC0001234",
    )


@pytest.fixture
def po(db, vendor):
    return PurchaseOrder.objects.create(po_number="PO-7001", vendor=vendor, total_amount="1000.00")


@pytest.fixture
def grn(db, po):
    return GoodsReceiptNote.objects.create(grn_number="GRN-7001", purchase_order=po, received_amount="1000.00")


def _invoice(uploader, purchase_order=None, amount="1000.00"):
    return Invoice.objects.create(
        file="invoices/test.pdf", uploaded_by=uploader,
        extracted_total_amount=amount, purchase_order=purchase_order,
    )


@pytest.fixture
def invoice_linked_to_po(db, uploader, po):
    return _invoice(uploader, purchase_order=po, amount="1005.00")


@pytest.fixture
def invoice_without_po(db, uploader):
    return _invoice(uploader, purchase_order=None)


def test_match_invoice_2way_passes_within_tolerance(po, invoice_linked_to_po):
    assert match_invoice(invoice_linked_to_po) == []


def test_match_invoice_2way_flags_amount_mismatch_beyond_tolerance(uploader, po):
    invoice = _invoice(uploader, purchase_order=po, amount="2000.00")
    reasons = match_invoice(invoice)
    assert any("amount" in r.lower() for r in reasons)


def test_match_invoice_3way_passes_when_po_grn_invoice_amounts_align(po, grn, invoice_linked_to_po):
    assert match_invoice(invoice_linked_to_po) == []


def test_match_invoice_3way_flags_grn_invoice_mismatch(uploader, po):
    GoodsReceiptNote.objects.create(grn_number="GRN-7002", purchase_order=po, received_amount="500.00")
    invoice = _invoice(uploader, purchase_order=po, amount="1000.00")
    reasons = match_invoice(invoice)
    assert any("grn" in r.lower() for r in reasons)


def test_match_invoice_with_no_purchase_order_returns_unmatched_reason(invoice_without_po):
    reasons = match_invoice(invoice_without_po)
    assert reasons == ["No purchase order linked — cannot match"]
