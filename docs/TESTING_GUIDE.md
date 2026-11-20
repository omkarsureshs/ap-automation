# Manual Testing Guide

A step-by-step QA script. You do not need to read any code. Each scenario has a Goal, Steps, Expected result, and an "If it differs" note.

Wording note: where the exact on-screen text is not fixed by the code, this guide says "a message like ...". Judge by meaning, not exact words. Page paths for Dashboard, Payments and Reports (`/dashboard`, `/payments`, `/reports`) come from the Day 3 plan; if your build uses different paths, use the navigation bar.

## 0. Prerequisites

- Postgres running, Tesseract and Poppler installed (`tesseract --version` works).
- A fresh sample invoice: a PDF/PNG/JPG tax invoice containing an invoice number, date, GSTIN, total and vendor name. A GSTIN in it must match a vendor in the system (the seeded vendors from `seed_demo`, or one you create in scenario 8).
- A junk file: any text file renamed to `junk.pdf`.
- Optional: `curl` for the API checks.

### Start commands (two terminals)

```bash
cd backend && .venv/Scripts/activate && python manage.py migrate && python manage.py seed_demo && python manage.py runserver
cd frontend && npm run dev
```

Open http://localhost:5173. Keep the backend terminal visible: emails print there (console email backend).

### Demo accounts (password `Demo@12345`)

| Email | Role |
|---|---|
| requester@demo.com | Requester |
| approver@demo.com | Approver |
| admin@demo.com | AP Admin |
| vendor@demo.com | Vendor |

Tip: use a separate private window per role so you stay logged in as several people.

---

## 1. Login: wrong password and expired session

**Goal:** bad credentials give a clear error; an expired session sends you back to login.

**Steps**
1. Go to `/login`. Enter `requester@demo.com` and password `wrong`. Click the login button.
2. Log in properly with `Demo@12345`.
3. To expire the session quickly: open browser DevTools > Application > Local Storage > `http://localhost:5173`, edit the `access` and `refresh` values to `x`. Click any nav link or reload a data page.

**Expected**
1. A red error message about invalid email/password. You stay on `/login`. No crash, no technical text.
2. You land on the app (Invoices page).
3. You are sent to `/login` with a notice that your session expired (a banner or message like "Your session has expired. Log in again.").

**If it differs:** a blank page or raw JSON means the typed error handling regressed; note the page and the browser console error.

## 2. Role access

**Goal:** each role can only do what it should. Forbidden actions show a clear message, not a crash.

What each role may do (enforced by the server):

| Action | Requester | Approver | AP Admin | Vendor |
|---|---|---|---|---|
| Upload / list invoices | yes | no | yes | no |
| View vendors, POs | yes | yes | yes | yes |
| Create/edit vendors, POs, GRNs, CSV import | no | no | yes | no |
| See and decide approval steps | only steps for own role (none unless a rule names requester) | yes | yes (including escalated steps) | no |
| View dashboard, reports, payment history | no | yes | yes | no |
| Request a new payment | no | no | yes | no |
| See bank account numbers in full | no (masked) | no (masked) | yes | no (masked) |

**Steps**
1. Log in as `vendor@demo.com`. Open `/upload` and try to upload or load the list.
2. Log in as `approver@demo.com`. Open `/upload`.
3. Log in as `requester@demo.com`. Open `/vendors`, try "Add vendor".
4. As `requester@demo.com`, open `/vendors` and look at a vendor's bank account number.
5. As `admin@demo.com`, open `/vendors` and look at the same number.

**Expected**
1-2. An access message like "You don't have access to do this." (or the server text "You do not have permission to perform this action."). Page does not crash.
3. The add action is refused with the same style of message.
4. The number is masked (only the last few characters visible).
5. The full number is visible.

**If it differs:** if a non-admin sees the full number or can create a vendor, that is a security bug; stop and report.

## 3. Upload a valid invoice

**Goal:** a good invoice is read and validated.

**Steps**
1. Log in as `requester@demo.com`. Go to `/upload`.
2. Choose your sample invoice file and click upload. Wait (OCR takes a few seconds; the upload is synchronous).
3. Find the new row in the invoice register.

**Expected:** a new row appears. Status is **Validated** (no PO linked, so it stops there) or **Needs Review** with listed reasons if any check failed (for example "Vendor not found in master"). No server error.

**If it differs:** if every upload says "OCR failed", Tesseract/Poppler are not found; set `TESSERACT_CMD` / `POPPLER_PATH`.

## 4. Upload a junk file

**Goal:** bad files are rejected or recorded, never crash.

**Steps**
1. As requester, upload `junk.pdf` (a text file renamed).
2. Try uploading a `.txt` file and an empty file.

**Expected**
1. Rejected with a field error like "File content does not match a PDF or image format."
2. Rejected: "File must be a PDF or image (.pdf, .png, .jpg, .jpeg)." and "File must not be empty."
A genuine image that has no readable text is accepted but becomes **Needs Review** with an exception row (missing fields or "OCR failed: ...").

**If it differs:** a renamed `.exe` being accepted is a regression of a bug fixed earlier (see CHALLENGES_AND_SOLUTIONS.md, item b).

## 5. Invoice with no PO

**Goal:** understand what happens without a purchase order.

**Steps:** upload your valid sample invoice with no PO selected (as in scenario 3).

**Expected:** status **Validated**, match status "unmatched", no approval steps created, nothing for approvers to do. This is current behaviour: matching and approval only start for PO-linked invoices. It is a known gap, not a crash.

## 6. Invoice linked to a PO: within and over tolerance

**Goal:** the 1% amount tolerance works.

The upload form on the page may not offer a PO picker. Use curl (replace values). First get a token:

```bash
curl -s -X POST http://localhost:8000/api/auth/login/ -H "Content-Type: application/json" \
  -d '{"email":"requester@demo.com","password":"Demo@12345"}'
```

Copy the `access` value, then find a PO id (`curl -s -H "Authorization: Bearer ACCESS" http://localhost:8000/api/procurement/purchase-orders/`). Then upload:

```bash
curl -s -X POST http://localhost:8000/api/invoices/ -H "Authorization: Bearer ACCESS" \
  -F "file=@/path/to/invoice.pdf" -F "purchase_order=PO_ID"
```

**Cases** (invoice total taken from your sample, say 10,000.00):
- A. PO total 10,050 (0.5% off) -> within tolerance.
- B. PO total 10,500 (about 5% off) -> over tolerance.
Create/edit POs as admin on the Purchase Orders page (the vendor must be the one whose GSTIN is on the invoice).

**Expected**
- A. `match_status` = `matched`, status **Pending Approval**, approval steps exist (if an approval rule covers the amount).
- B. `match_status` = `mismatched`, status **Needs Review**, an exception like "Invoice amount ... does not match PO amount ... within tolerance".
- If no approval rule covers the amount: status **Needs Review** with "No approval rule covers amount ...".

**If it differs:** check that the PO's vendor GSTIN equals the invoice GSTIN; a mismatch is reported as its own exception.

## 7. (reserved) Exceptions queue

Open `/upload`; each Needs Review invoice lists its exception reasons. Confirm a reason is human-readable and not cut off mid-sentence in a way that hides the cause (long reasons are truncated to 255 characters).

## 8. Create a vendor, duplicate GSTIN

**Goal:** field-level errors.

**Steps**
1. As `admin@demo.com`, open `/vendors`. Add a vendor with a valid GSTIN (15 characters, valid checksum), email and bank details. Save.
2. Add another vendor with the same GSTIN.

**Expected**
1. The vendor appears; bank number shown in full to the admin.
2. An error under the GSTIN field (a message like "vendor with this gstin already exists."). The first vendor is untouched.

## 9. PO/GRN CSV import with a bad row

**Goal:** the import reports row-level errors instead of failing wholesale.

**Steps**
1. As admin, on `/purchase-orders`, import the PO CSV below (save as `pos.csv`). Replace `GSTIN_OF_A_REAL_VENDOR` with an existing vendor's GSTIN.

```
po_number,vendor_gstin,total_amount
PO-9001,GSTIN_OF_A_REAL_VENDOR,10000.00
PO-9002,GSTIN_OF_A_REAL_VENDOR,abc
PO-9003,00AAAAA0000A0Z0,5000.00
,GSTIN_OF_A_REAL_VENDOR,100.00
PO-9001,GSTIN_OF_A_REAL_VENDOR,10000.00
```

2. Import the GRN CSV (`grns.csv`):

```
grn_number,po_number,received_amount
GRN-9001,PO-9001,10000.00
GRN-9002,PO-DOES-NOT-EXIST,500.00
```

**Expected**
1. 1 created, 4 row errors: row 2 "Invalid total_amount: must be a positive number"; row 3 "Unknown vendor GSTIN ..."; row 4 "Missing po_number"; row 5 "PO number 'PO-9001' already exists". The good row is saved.
2. 1 created, 1 error: row 2 "Unknown PO number 'PO-DOES-NOT-EXIST'".
A file with a BOM, or a short row missing trailing cells, must not crash.

## 10. Approval: approve and reject

**Goal:** approvers decide invoices.

**Steps**
1. Make sure an invoice is **Pending Approval** (scenario 6A, or one from `seed_demo`).
2. Log in as `approver@demo.com`, open `/approvals`.
3. Approve one step. For a second invoice, click reject.

**Expected**
- The step leaves the list. When every step of an invoice is approved the invoice becomes **Approved**; the first rejection makes the invoice **Rejected** and closes its other pending steps.
- If the rule needs several roles, the invoice stays **Pending Approval** until the other role also approves.

## 11. Double-decide conflict

**Goal:** the same step cannot be decided twice.

**Steps**
1. Open `/approvals` as approver in two browser tabs (same step visible in both).
2. Approve it in tab 1. Without refreshing, approve it in tab 2.

**Expected:** tab 2 shows a friendly toast like "Someone else already changed this. Refresh to see the current state." (HTTP 409). It must NOT show a raw message such as "Step 42 is already approved". The row is removed/refreshed consistently.

## 12. Escalation command

**Goal:** overdue steps escalate to AP Admin.

**Steps**
1. Make a step overdue: in Django shell, set its `assigned_at` back past the rule's `escalation_hours`:
```bash
cd backend
python manage.py shell -c "from workflow.models import ApprovalStep as S; from django.utils import timezone as t; from datetime import timedelta as d; s=S.objects.filter(status='pending').first(); s.assigned_at=t.now()-d(days=30); s.save(); print(s.pk)"
```
(`assigned_at` is auto-set on create but can be overwritten on save.)
2. Run `python manage.py escalate_pending_approvals`.
3. Log in as `admin@demo.com`, open `/approvals`.

**Expected:** the old step is marked escalated and a new pending step for role `ap_admin` appears for the admin; the admin gets a notification and an email in the backend console. If you have no pending step, create one first via scenario 6A. Running the command twice does not escalate the same step again.

## 13. Notifications bell and console email

**Steps**
1. Trigger an approval assignment (scenario 6A) or escalation (12).
2. Log in as the target user. Look at the bell in the top bar. Open it, mark one read.
3. Check the backend terminal.

**Expected:** bell shows an unread count; items like "Invoice #N is waiting for your approval"; marking read reduces the count. The backend terminal prints an email (To/Subject/body) because the console email backend is used.

## 14. Payment request

**Steps**
1. As `admin@demo.com`, open `/payments`. Find an **Approved** invoice. Click Request payment.
2. Click request again for the same invoice (or call the API twice).
3. Try requesting payment for a non-approved invoice (use curl: `curl -s -X POST http://localhost:8000/api/payments/ -H "Authorization: Bearer ADMIN_ACCESS" -H "Content-Type: application/json" -d '{"invoice": INVOICE_ID}'`).
4. As requester, try to request a payment.
5. As `approver@demo.com`, open `/payments`.

**Expected**
1. A payment with a `MOCK-...` reference and status Completed; the invoice becomes **Paid**.
2. Refused with HTTP 409: "A payment has already been requested for this invoice."
3. HTTP 400: "Invoice must be approved before payment can be requested (current status: ...)."
4. HTTP 403.
5. The "Ready to pay" section shows a no-access message (approvers can't request payments or see the invoice list), but "Payment history" below it loads normally — one section's error never hides the other.

## 15. Dashboard, including empty state and role access

**Steps**
1. As `admin@demo.com` or `approver@demo.com`, open `/dashboard` with seeded data.
2. As `requester@demo.com` or `vendor@demo.com`, open `/dashboard`.
3. On a fresh, empty database (new DB, `migrate` only, create an admin with `createsuperuser`), open `/dashboard` as admin.

**Expected**
1. Stat blocks and charts show numbers that agree with the invoice register (counts by status, pending approvals, aging, vendor analytics, payment tracking). The straight-through-rate tile is labelled that way, not "OCR accuracy" — its tooltip explains the denominator (every invoice OCR has finished reading, not just ones that failed OCR specifically).
2. HTTP 403 / an access-denied message — the dashboard and reports expose vendor GSTINs, approver decisions and payment history, more than these two roles can otherwise see, so it is intentionally restricted to AP Admin and Approver.
3. No error and no "NaN": averages show a dash/"no data" placeholders and charts show an empty state.

## 16. Reports and CSV download

**Steps**
1. As `admin@demo.com` or `approver@demo.com`, open `/reports`. For each of the five tabs (AP aging, Invoice status, Exceptions, Audit log, GST/tax): view the table, click Export CSV, open the file.
2. As `requester@demo.com`, open `/reports`.

**Expected**
1. Each tab shows a table; the CSV has a header row and the same rows as shown; an empty report downloads a header-only file, not an error. Open a downloaded CSV in a spreadsheet app and confirm a cell that happens to start with `=`, `+`, `-` or `@` (rare in practice, but possible in an OCR'd vendor name) displays as plain text rather than running as a formula.
2. HTTP 403, same reasoning as dashboard access above.

## 17. Custom 404 page

**Steps:** go to http://localhost:5173/does-not-exist.

**Expected:** a designed "page not found" page with a way back, not a blank screen. (If you are logged out the app may redirect to login first, log in then retry.)

## 18. Backend down banner and retry

**Steps**
1. While on a data page, stop the backend (Ctrl+C in its terminal).
2. Reload or trigger a refresh.
3. Start the backend again and click Retry.

**Expected:** a banner like "Can't reach AP Automation right now. Check your connection and try again." with a retry control; after the backend returns, retry loads the data. No white screen.

## 19. Dark mode

**Steps:** switch the operating system/browser to dark mode (or use the theme toggle if one is shown). Visit login, invoices, approvals, dashboard.

**Expected:** readable text, visible borders, charts legible; no white boxes with white text.

## 20. Phone width

**Steps:** in browser DevTools toggle device mode at 375px wide. Visit every page.

**Expected:** no horizontal page scroll (tables may scroll inside their own box), buttons tappable, navigation still reachable.

## 21. Direct API checks (curl)

```bash
curl -i http://localhost:8000/api/health/
# Expected: HTTP 200, body {"status": "ok"}

curl -i http://localhost:8000/api/docs/
# Expected: HTTP 200, an HTML page (interactive API docs). 404 means the docs feature is not installed in your build.

curl -i http://localhost:8000/api/invoices/
# Expected: HTTP 401 (no token)
```

---

## One-page checklist

| # | Scenario | Pass | Fail | Notes |
|---|---|---|---|---|
| 1 | Wrong password; expired session redirect | | | |
| 2 | Role access (vendor/approver/requester/admin, masking) | | | |
| 3 | Valid invoice uploads and validates | | | |
| 4 | Junk/renamed/empty file rejected | | | |
| 5 | No-PO invoice stays Validated | | | |
| 6 | PO within tolerance matches; over tolerance mismatches | | | |
| 8 | Vendor create; duplicate GSTIN field error | | | |
| 9 | PO/GRN CSV bad rows reported per row | | | |
| 10 | Approve; reject | | | |
| 11 | Double-decide gives friendly 409 toast | | | |
| 12 | Escalation command | | | |
| 13 | Bell + console email | | | |
| 14 | Payment; double request; non-approved; wrong role | | | |
| 15 | Dashboard populated and empty | | | |
| 16 | Five reports + CSV | | | |
| 17 | Custom 404 | | | |
| 18 | Backend-down banner and retry | | | |
| 19 | Dark mode | | | |
| 20 | Phone width | | | |
| 21 | curl: health, docs, 401 | | | |
