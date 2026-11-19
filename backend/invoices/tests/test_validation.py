import pytest

from invoices.models import Invoice
from invoices.validation import validate_invoice
from vendors.models import Vendor

VALID_GSTIN = "27AAACC1206D1ZG"
BAD_CHECKSUM_GSTIN = "27AAACC1206D1Z9"
UNKNOWN_VENDOR_GSTIN = "29AABCU9603R1ZM"


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
def active_vendor(db):
    return Vendor.objects.create(
        name="Acme Supplies", gstin=VALID_GSTIN, email="billing@acme.test",
        bank_account_number="1234567890", bank_ifsc="HDFC0001234",
    )


@pytest.fixture
def inactive_vendor(db):
    return Vendor.objects.create(
        name="Dormant Co", gstin=VALID_GSTIN, email="billing@dormant.test",
        bank_account_number="1234567890", bank_ifsc="HDFC0001234", is_active=False,
    )


@pytest.fixture
def clean_invoice(db, uploader, active_vendor):
    return _make_invoice(uploader, status=Invoice.STATUS_VALIDATED)


@pytest.fixture
def invoice_with_all_fields(db, uploader):
    return _make_invoice(uploader)


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


def test_validate_invoice_flags_vendor_not_in_master(invoice_with_all_fields):
    reasons = validate_invoice(invoice_with_all_fields)
    assert any("vendor not found" in r.lower() for r in reasons)


def test_validate_invoice_flags_inactive_vendor(invoice_with_all_fields, inactive_vendor):
    reasons = validate_invoice(invoice_with_all_fields)
    assert any("vendor is inactive" in r.lower() for r in reasons)


def test_validate_invoice_passes_for_active_known_vendor(invoice_with_all_fields, active_vendor):
    reasons = validate_invoice(invoice_with_all_fields)
    assert not any("vendor" in r.lower() for r in reasons)
