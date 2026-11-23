# Sample Invoices

This directory contains three test PDFs generated so that the OCR pipeline reads them cleanly
(verified against `invoices/ocr.py` and `invoices/extraction.py` directly, rather than assumed). They
are intended for use on a freshly wiped database (only the four demo logins and the one approval rule
present — no vendors, invoices, purchase orders, or payments).

## 1. `test-invoice-northwind.pdf` — Happy Path

| Field | Value |
|---|---|
| Invoice No. | INV-TEST-1001 |
| Date | 20/11/2026 |
| GSTIN | `29NWTRA1234P1ZL` (valid checksum) |
| Vendor | Northwind Traders |
| Amount | ₹24,500.00 |

A vendor must be created (as `admin@demo.com`, on `/vendors`) with the exact GSTIN shown above before
this file is uploaded as `requester@demo.com`; name, email, and bank details may be arbitrary. The
invoice is expected to reach **Validated** status immediately (no purchase order is required for this
status; a purchase order should be linked first to demonstrate the full match → approve → pay chain).

## 2. `test-invoice-stellar.pdf` — PO Matching and Tolerance

| Field | Value |
|---|---|
| Invoice No. | INV-TEST-1002 |
| Date | 18/11/2026 |
| GSTIN | `27STLHW5678Q1Z7` (valid checksum) |
| Vendor | Stellar Hardware Co |
| Amount | ₹67,800.00 |

A matching vendor (same GSTIN) and a corresponding purchase order on `/purchase-orders` must be
created before this file is uploaded, so that the upload can include the linked PO (via the API/curl,
per scenario 6 in the testing guide — the upload form does not expose a PO picker):

- A PO total of **₹68,000** (0.3% variance) falls within the 1% tolerance, resulting in a match and
  routing to Pending Approval.
- A PO total of **₹71,000** (approximately 4.7% variance) exceeds tolerance, resulting in a mismatch
  and routing to Needs Review.

## 3. `test-invoice-incomplete.pdf` — Exceptions Queue

| Field | Value |
|---|---|
| Invoice No. | INV-TEST-1003 |
| Date | 19/11/2026 |
| GSTIN | *(not present)* |
| Vendor | *(not present)* |
| Amount | ₹12,340.00 |

No vendor setup is required; this file can be uploaded as-is. It is expected to land in **Needs
Review** with two "Missing mandatory field" exceptions (GSTIN, vendor name), produced by the
validation engine rather than staged. This file is suited to demonstrating the exceptions queue and,
as AP Admin, the "Fix & revalidate" correction flow, in which a GSTIN and vendor name are entered and
the invoice is revalidated live.
