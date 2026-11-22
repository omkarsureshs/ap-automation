# Sample invoices for the demo

Three ready-made test PDFs, generated so the real OCR pipeline reads them cleanly (verified against
`invoices/ocr.py` + `invoices/extraction.py` directly, not just assumed). Use them with
[docs/TESTING_GUIDE.md](../TESTING_GUIDE.md) on a freshly wiped database (only the 4 demo logins and
the one approval rule exist — no vendors, invoices, POs or payments).

## 1. `test-invoice-northwind.pdf` — the happy path

| Field | Value |
|---|---|
| Invoice No. | INV-TEST-1001 |
| Date | 20/11/2026 |
| GSTIN | `29NWTRA1234P1ZL` (valid checksum) |
| Vendor | Northwind Traders |
| Amount | ₹24,500.00 |

**Before uploading**, create a vendor (as `admin@demo.com`, on `/vendors`) with the exact GSTIN above —
name/email/bank details can be anything. Then upload this file as `requester@demo.com`. It should land
as **Validated** straight away (no PO needed for that status; link a PO first if you want to show the
full match → approve → pay chain).

## 2. `test-invoice-stellar.pdf` — for PO matching / tolerance

| Field | Value |
|---|---|
| Invoice No. | INV-TEST-1002 |
| Date | 18/11/2026 |
| GSTIN | `27STLHW5678Q1Z7` (valid checksum) |
| Vendor | Stellar Hardware Co |
| Amount | ₹67,800.00 |

Create a matching vendor (same GSTIN), then a purchase order for that vendor on `/purchase-orders`
**before** uploading, so you can upload with the PO linked (via the API/curl, per scenario 6 in the
testing guide — the upload form doesn't expose a PO picker):

- PO total **₹68,000** (0.3% off) → within 1% tolerance → matched, goes to Pending Approval.
- PO total **₹71,000** (~4.7% off) → over tolerance → mismatched, goes to Needs Review.

## 3. `test-invoice-incomplete.pdf` — for the exceptions queue

| Field | Value |
|---|---|
| Invoice No. | INV-TEST-1003 |
| Date | 19/11/2026 |
| GSTIN | *(not present)* |
| Vendor | *(not present)* |
| Amount | ₹12,340.00 |

No vendor setup needed — upload it as-is. It lands in **Needs Review** with two real "Missing mandatory
field" exceptions (GSTIN, vendor name), genuinely produced by the validation engine, not staged. Good
for showing the exceptions queue, and (as AP Admin) the "Fix & revalidate" correction flow — type in a
GSTIN/vendor name and watch it re-validate live.
