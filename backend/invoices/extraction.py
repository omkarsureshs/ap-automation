import re

_FIELD_PATTERNS = {
    "invoice_no": re.compile(r"\bInvoice\s*No\b\s*[:#]?\s*(?P<value>.+?)\s*$", re.IGNORECASE | re.MULTILINE),
    "invoice_date": re.compile(r"\bInvoice\s*Date\b\s*[:#]?\s*(?P<value>.+?)\s*$", re.IGNORECASE | re.MULTILINE),
    "gstin": re.compile(r"\bGSTIN\b\s*[:#]?\s*(?P<value>.+?)\s*$", re.IGNORECASE | re.MULTILINE),
    "vendor_name": re.compile(r"\bVendor\b\s*[:#]?\s*(?P<value>.+?)\s*$", re.IGNORECASE | re.MULTILINE),
    "total_amount": re.compile(r"\bTotal\s*Amount\b\s*[:#]?\s*(?P<value>.+?)\s*$", re.IGNORECASE | re.MULTILINE),
}


def extract_fields(text: str) -> dict:
    fields = {}
    for name, pattern in _FIELD_PATTERNS.items():
        match = pattern.search(text)
        fields[name] = match.group("value") if match else None
    return fields
