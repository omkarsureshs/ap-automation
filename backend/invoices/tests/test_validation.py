import pytest

from invoices.models import Invoice
from invoices.validation import validate_invoice

VALID_GSTIN = "27AAACC1206D1ZG"
BAD_CHECKSUM_GSTIN = "27AAACC1206D1Z9"


@pytest.fixture
def uploader(django_user_model):
    return django_user_model.objects.create_user(email="uploader@x.com", password="pw12345!", role="requester")


def _make_invoice(uploader, **overrides):
    defaults = dict(
        file="invoices/test.pdf",
        uploaded_by=uploader,
        extracted_invoice_no="INV-1",
        extracted_invoice_date="18/11/2026",
        extracted_gstin=VALID_GSTIN,
        extracted_total_amount="12,500.00",
        extracted_vendor_name="Acme Supplies",
    )
    defaults.update(overrides)
    return Invoice.objects.create(**defaults)


@pytest.fixture
def clean_invoice(db, uploader):
    return _make_invoice(uploader, status=Invoice.STATUS_VALIDATED)


@pytest.fixture
def invoice_missing_invoice_no(db, uploader):
    return _make_invoice(uploader, extracted_invoice_no=None)


@pytest.fixture
def duplicate_of_clean_invoice(db, uploader, clean_invoice):
    return _make_invoice(uploader, status=Invoice.STATUS_EXTRACTED)


@pytest.fixture
def invoice_with_bad_gstin_checksum(db, uploader):
    return _make_invoice(uploader, extracted_gstin=BAD_CHECKSUM_GSTIN)


@pytest.fixture
def invoice_with_malformed_amount(db, uploader):
    return _make_invoice(uploader, extracted_total_amount="not-a-number")


def test_validate_invoice_passes_clean_invoice(clean_invoice):
    assert validate_invoice(clean_invoice) == []


def test_validate_invoice_flags_missing_mandatory_field(invoice_missing_invoice_no):
    reasons = validate_invoice(invoice_missing_invoice_no)
    assert any("invoice_no" in r for r in reasons)


def test_validate_invoice_flags_duplicate(clean_invoice, duplicate_of_clean_invoice):
    reasons = validate_invoice(duplicate_of_clean_invoice)
    assert any("duplicate" in r.lower() for r in reasons)


def test_validate_invoice_flags_bad_gstin_checksum(invoice_with_bad_gstin_checksum):
    reasons = validate_invoice(invoice_with_bad_gstin_checksum)
    assert any("gstin" in r.lower() for r in reasons)


def test_validate_invoice_flags_malformed_amount(invoice_with_malformed_amount):
    reasons = validate_invoice(invoice_with_malformed_amount)
    assert any("amount" in r.lower() for r in reasons)
