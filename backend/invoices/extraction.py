import re

# Separator between a field's label and its value. Originally a strict
# literal ':' or '#' right after the label (to stop a label that's a
# prefix of a different phrase, e.g. "Vendor GSTIN:", from matching).
# Real invoice templates vary this punctuation (periods before the colon,
# hyphens instead of colons, no separator at all when a currency symbol
# already marks the value) and OCR often merges a multi-column layout's
# two columns onto one physical text line, so the label is frequently not
# at the start of that line. _SEP and the removed '^' line anchor below
# widen what matches; neither claims "any invoice extracts cleanly" — a
# template that identifies a field only by position (e.g. a vendor name
# shown only in the letterhead, with no label at all) still correctly
# returns None and routes the invoice to manual review, which is the
# right behavior for a read we can't make confidently rather than a
# silent guess.
_SEP = r"\.?[ \t]*[:#\-][ \t]*"
_AMOUNT_SEP = r"[ \t]*[:#\-]?[ \t]*"

_FIELD_PATTERNS = {
    "invoice_no": re.compile(
        r"\bInvoice\s*No\.?\s*" + _SEP + r"(?P<value>[A-Za-z0-9/-]+)", re.IGNORECASE
    ),
    "invoice_date": re.compile(
        r"\b(?:Invoice|Bill)\s*Date\s*" + _SEP + r"(?P<value>\d{1,2}[/-]\d{1,2}[/-]\d{2,4})",
        re.IGNORECASE,
    ),
    "gstin": re.compile(
        r"\bGSTIN\s*" + _SEP + r"(?P<value>[0-9A-Za-z]{15})", re.IGNORECASE
    ),
    "vendor_name": re.compile(
        r"\b(?:Vendor(?:\s*Name)?|Supplier(?:\s*Name)?|Seller|Billed\s*By)\s*"
        + _SEP
        + r"(?P<value>.+?)\s*$",
        re.IGNORECASE | re.MULTILINE,
    ),
    "total_amount": re.compile(
        r"\b(?:Total\s*Amount|Grand\s*Total|Amount\s*Payable|Net\s*Amount|Total)\s*"
        + _AMOUNT_SEP
        + r"(?:Rs\.?|INR|₹)?[ \t]*(?P<value>[\d,]+(?:\.\d+)?)",
        re.IGNORECASE,
    ),
}


def extract_fields(text: str) -> dict:
    fields = {}
    for name, pattern in _FIELD_PATTERNS.items():
        match = pattern.search(text)
        fields[name] = match.group("value") if match else None
    return fields
