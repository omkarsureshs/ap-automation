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

A matching vendor (same GSTIN) must be created first. A purchase order is then created by importing a
CSV file on `/purchase-orders` (the "Import CSV" button) — this is the only way to create a purchase
order; there is no manual entry form. The CSV must have exactly these three column headers:

```
po_number,vendor_gstin,total_amount
```

A ready-to-use file with a matching PO is provided at
[`sample-purchase-orders.csv`](sample-purchase-orders.csv):

```
po_number,vendor_gstin,total_amount
PO-DEMO-001,27STLHW5678Q1Z7,"68,000.00"
```

The upload form itself has no PO picker, so the file can simply be uploaded as-is as
`requester@demo.com` — it reaches **Validated** with no purchase order attached. An AP Admin then uses
the **"Link to purchase order"** action on the Invoices page to attach the PO, which re-runs matching
immediately.

The same link can also be made at upload time instead, via the API, with the PO's id from the response
above (here, `1`, assuming a fresh database):

```bash
curl -X POST http://localhost:8000/api/invoices/ \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -F "file=@docs/sample-invoices/test-invoice-stellar.pdf" \
  -F "purchase_order=1"
```

`ACCESS_TOKEN` is the `access` value returned by `POST /api/auth/login/` for `requester@demo.com`.

- A PO total of **₹68,000** (0.3% variance from the invoice's ₹67,800) falls within the 1% tolerance,
  resulting in a match and routing to Pending Approval.
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

## 4. Spare invoices for repeated testing

The validation engine blocks a repeated invoice number + vendor name as a duplicate (by design — it
stops the same bill being paid twice), so re-uploading one of the three files above a second time will
always be refused. Two spare, pre-generated invoices are provided for quick repeated runs without that
collision:

| File | Vendor (already seeded by `seed_demo`) | GSTIN | Amount |
|---|---|---|---|
| `test-invoice-spare-a.pdf` | Globex Industrial Traders | `29AABCG4521K1ZK` | ₹15,999.00 |
| `test-invoice-spare-b.pdf` | Stellar Hardware Co | `27STLHW5678Q1Z7` | ₹40,000.00 |

Both vendors already exist once `seed_demo` (not `--users-only`) has been run, or after they have been
created manually by GSTIN as in the sections above.

### Generating more

[`generate_test_invoice.py`](generate_test_invoice.py) mints a fresh invoice PDF with a guaranteed-new
invoice number (a timestamp, unless `--invoice-no` is given), so there is always a clean file to upload
without editing anything by hand:

```bash
cd docs/sample-invoices
python generate_test_invoice.py --vendor "Acme Supplies Pvt Ltd" --gstin 27AAACC1206D1ZG --amount "12,500.00"
```

Requires Pillow (already a backend dependency: `pip install -r backend/requirements.txt`, or just
`pip install Pillow`) and a real TrueType font on the machine (Windows' `arial.ttf` is used by default;
the script falls back to a lower-quality built-in font if neither is found, which Tesseract OCRs far
less reliably — verify any such fallback output against `invoices/ocr.py` before relying on it).
Avoid picking a vendor whose GSTIN's two-digit state code starts with `0` (e.g. Initech Office
Solutions, `07...`) for a freshly generated file — Tesseract has a known tendency to misread a leading
`0` as the letter `O` at this rendering size, which fails the GSTIN checksum (see
`docs/CHALLENGES_AND_SOLUTIONS.md`).
