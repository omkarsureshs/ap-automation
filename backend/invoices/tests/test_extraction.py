from invoices.extraction import extract_fields

SAMPLE_TEXT = """
INVOICE
Invoice No: INV-2026-0042
Invoice Date: 18/11/2026
GSTIN: 27AAACC1206D1Z0
Vendor: Acme Supplies Pvt Ltd
Total Amount: 12,500.00
"""


def test_extract_fields_finds_all_fields():
    result = extract_fields(SAMPLE_TEXT)
    assert result["invoice_no"] == "INV-2026-0042"
    assert result["gstin"] == "27AAACC1206D1Z0"
    assert result["total_amount"] == "12,500.00"


def test_extract_fields_returns_none_for_missing_field():
    result = extract_fields("no useful fields here")
    assert result["invoice_no"] is None
