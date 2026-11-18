import re

# Each pattern requires a literal ':' or '#' right after the label (so a
# label that's actually a prefix of another phrase, e.g. "Vendor GSTIN:",
# can't match), and a field-shaped value bounded to a single line — never
# "rest of line"/"rest of text" — so a noisy OCR line can't overflow the
# model's CharField max_length or let a blank field swallow the next line.
_FIELD_PATTERNS = {
    "invoice_no": re.compile(
        r"^\s*Invoice\s*No\s*[:#][ \t]*(?P<value>[A-Za-z0-9/-]+)", re.IGNORECASE | re.MULTILINE
    ),
    "invoice_date": re.compile(
        r"^\s*Invoice\s*Date\s*[:#][ \t]*(?P<value>\d{1,2}[/-]\d{1,2}[/-]\d{2,4})",
        re.IGNORECASE | re.MULTILINE,
    ),
    "gstin": re.compile(
        r"^\s*GSTIN\s*[:#][ \t]*(?P<value>[0-9A-Za-z]{15})", re.IGNORECASE | re.MULTILINE
    ),
    "vendor_name": re.compile(
        r"^\s*Vendor(?:\s*Name)?\s*[:#][ \t]*(?P<value>.+?)\s*$", re.IGNORECASE | re.MULTILINE
    ),
    "total_amount": re.compile(
        r"^\s*Total\s*Amount\s*[:#][ \t]*(?:Rs\.?|INR|₹)?[ \t]*(?P<value>[\d,]+(?:\.\d+)?)",
        re.IGNORECASE | re.MULTILINE,
    ),
}


def extract_fields(text: str) -> dict:
    fields = {}
    for name, pattern in _FIELD_PATTERNS.items():
        match = pattern.search(text)
        fields[name] = match.group("value") if match else None
    return fields
