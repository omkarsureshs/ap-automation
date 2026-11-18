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


def test_extract_fields_does_not_leak_into_next_line_when_blank():
    text = "Invoice No:\nInvoice Date: 18/11/2026"
    result = extract_fields(text)
    assert result["invoice_no"] is None
    assert result["invoice_date"] == "18/11/2026"


def test_extract_fields_truncates_trailing_text_on_gstin_line():
    text = "GSTIN: 27AAACC1206D1ZG State Code 27 Maharashtra"
    result = extract_fields(text)
    assert result["gstin"] == "27AAACC1206D1ZG"


def test_extract_fields_does_not_capture_vendor_gstin_line_as_vendor_name():
    text = "Vendor GSTIN: 27AAACC1206D1ZG\nVendor: Acme Supplies Pvt Ltd"
    result = extract_fields(text)
    assert result["vendor_name"] == "Acme Supplies Pvt Ltd"


def test_extract_fields_strips_currency_prefix_from_amount():
    text = "Total Amount: Rs. 12,500.00"
    result = extract_fields(text)
    assert result["total_amount"] == "12,500.00"
