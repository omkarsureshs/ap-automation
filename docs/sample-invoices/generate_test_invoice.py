#!/usr/bin/env python
"""Generate a fresh test invoice PDF with a unique invoice number, for repeated manual testing.

The validation engine treats a repeated invoice number + vendor name as a duplicate and blocks it
(by design). Re-uploading the same sample PDF for a second test run will always hit that block. This
script mints a new PDF with a fresh invoice number each time, so there is always a clean one to upload.

Usage:
    python generate_test_invoice.py --vendor "Acme Supplies Pvt Ltd" --gstin 27AAACC1206D1ZG --amount "12,500.00"
    python generate_test_invoice.py --vendor "Stellar Hardware Co" --gstin 27STLHW5678Q1Z7 --amount "68,000.00" --out my-test.pdf

Requires Pillow (already a backend dependency): pip install Pillow
"""
import argparse
from datetime import datetime

from PIL import Image, ImageDraw, ImageFont


_FONT_CANDIDATES = (
    r"C:\Windows\Fonts\arial.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
)


def _load_font(size):
    for path in _FONT_CANDIDATES:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    # Last resort — low OCR accuracy, but keeps the script runnable anywhere.
    return ImageFont.load_default()


def build_invoice_pdf(vendor, gstin, amount, invoice_no, invoice_date, out_path):
    # A real TTF font at a large size is what makes this reliably OCR-able — PIL's
    # built-in bitmap font is small enough that Tesseract misreads characters
    # (confirmed by hand: "Invoice No" became "Invoice Na", GSTIN gained a stray space).
    img = Image.new("RGB", (1400, 900), "white")
    draw = ImageDraw.Draw(img)
    font = _load_font(36)
    lines = [
        "INVOICE",
        "",
        f"Invoice No: {invoice_no}",
        f"Invoice Date: {invoice_date}",
        f"GSTIN: {gstin}",
        f"Vendor: {vendor}",
        f"Total Amount: {amount}",
    ]
    y = 60
    for line in lines:
        draw.text((60, y), line, fill="black", font=font)
        y += 90
    img.save(out_path)
    return out_path


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--vendor", required=True, help='e.g. "Acme Supplies Pvt Ltd"')
    parser.add_argument("--gstin", required=True, help="Must match a vendor already on file (or one you're about to add)")
    parser.add_argument("--amount", required=True, help='e.g. "12,500.00"')
    parser.add_argument("--invoice-no", default=None, help="Omit to auto-generate a fresh, never-used one")
    parser.add_argument("--invoice-date", default=datetime.now().strftime("%d/%m/%Y"))
    parser.add_argument("--out", default=None, help="Output path (default: test-invoice-<invoice-no>.pdf)")
    args = parser.parse_args()

    invoice_no = args.invoice_no or f"INV-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
    out_path = args.out or f"test-invoice-{invoice_no}.pdf"
    build_invoice_pdf(args.vendor, args.gstin, args.amount, invoice_no, args.invoice_date, out_path)
    print(f"Wrote {out_path} — invoice no {invoice_no} (fresh, never used before).")


if __name__ == "__main__":
    main()
