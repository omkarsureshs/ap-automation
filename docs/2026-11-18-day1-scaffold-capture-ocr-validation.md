# Day 1: Scaffold, Auth, Capture, OCR, Extraction, Validation — Implementation Plan

**Goal:** Stand up the Django+DRF+Postgres backend and React+TS+Tailwind frontend scaffold, JWT auth with 4 roles, invoice upload capture, real Tesseract OCR, regex field extraction, and a validation engine that routes bad invoices to an exceptions queue — the full Day 1 slice from the design doc, end to end and demoable.

**Architecture:** Django project `backend/` with two apps: `accounts` (custom User + role + JWT) and `invoices` (Invoice model, upload, OCR, extraction, validation, exceptions). A separate `frontend/` Vite React TS app with Tailwind + shadcn/ui, talking to the DRF API over JWT. Postgres via docker-compose for local dev. OCR and extraction are plain service modules (no Celery/async queue — synchronous on upload, per the 3-day time budget), called directly from the upload view; a later day can move this to a background task without changing the module boundary.

**Tech Stack:** Django 5 + djangorestframework + djangorestframework-simplejwt + psycopg + pytesseract + pdf2image + Pillow; pytest-django; React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui; Postgres 16 in Docker.

**Spec:** `docs/2026-11-18-ap-automation-design.md` (architecture, OCR/extraction/validation sections, build sequence #1).

## Global Constraints

- Stack is non-negotiable: ReactJS, Django, PostgreSQL (spec Constraints).
- OCR must run fully offline, no paid APIs, no external credentials required at demo time (spec Constraints).
- 4 roles on the user profile: `Requester`, `Approver`, `AP Admin`, `Vendor`; JWT auth via `djangorestframework-simplejwt`, no SSO.
- OCR: `pytesseract`/`pdf2image`, preprocessing = grayscale + binarization, `--psm 6` for block text (spec Architecture).
- Field extraction: regex + positional heuristics only, anchored with word boundaries — no LLM, no cloud vision API (spec Architecture). Named capture groups (`(?P<field>...)`), `re.compile` with bounded/non-greedy patterns to avoid catastrophic backtracking.
- Validation is a separate layer from extraction: mandatory field checks, duplicate detection, GST/GSTIN checksum validation, amount format validation; failures go to an exceptions/manual-review queue, never silently through (spec Architecture).
- GSTIN: 15 chars — 2-digit state code + 10-char PAN + 1 entity code + default `'Z'` + 1 checksum digit, modulo-36 check-digit algorithm.
- Frontend stack: React + TypeScript + Tailwind + shadcn/ui (copy-in, not an installed library).
- Testing: pytest-django unit tests on validation engine and (later) matching/approval; no frontend test suite.

## Review Focus

- Upload of a non-PDF/non-image file (e.g. `.exe` renamed `.pdf`, or a zero-byte file) — must be rejected with a clear error, not crash the OCR pipeline.
- A scanned invoice where OCR extracts garbled/low-confidence text for a mandatory field (e.g. invoice number unreadable) — must route to the exceptions queue with a reason, not silently save a blank or wrong value.
- Duplicate invoice upload (same invoice number + vendor name already in the system) — must be flagged as a duplicate exception, not create a second accepted invoice.
- A GSTIN that is the right length but has an invalid checksum digit — must fail validation specifically on checksum, not pass because the format regex alone matched.
- Login with a role that has no business owning the action it's used for yet (e.g. a `Vendor`-role token calling the invoice upload endpoint meant for `Requester`) — must be rejected by the permission class now, even though workflow/approval logic lands Day 2, so role enforcement isn't bolted on later as an afterthought.

---

## File Structure

```
backend/
  manage.py
  apconfig/settings.py, urls.py, wsgi.py
  accounts/models.py        # User (role field)
  accounts/serializers.py    # RegisterSerializer, UserSerializer
  accounts/views.py          # RegisterView; JWT views wired in apconfig/urls.py
  accounts/permissions.py    # HasRole
  accounts/tests/test_auth.py
  invoices/models.py          # Invoice, InvoiceException
  invoices/ocr.py             # run_ocr(file_path) -> str
  invoices/extraction.py      # extract_fields(text) -> dict
  invoices/validation.py      # validate_invoice(invoice) -> list[str] (exception reasons)
  invoices/gstin.py           # is_valid_gstin(value) -> bool
  invoices/serializers.py     # InvoiceUploadSerializer, InvoiceSerializer
  invoices/views.py           # InvoiceUploadView
  invoices/tests/test_ocr.py, test_extraction.py, test_validation.py, test_gstin.py, test_upload.py
  requirements.txt
docker-compose.yml             # postgres service
frontend/
  package.json, vite.config.ts, tailwind.config.js
  src/main.tsx, src/App.tsx
  src/lib/api.ts               # axios/fetch client with JWT attach+refresh
  src/pages/LoginPage.tsx
  src/pages/UploadPage.tsx
README.md
```

---

### Task 1: Repo scaffold — backend + frontend + Postgres

**Files:**
- Create: `backend/manage.py`, `backend/apconfig/settings.py`, `backend/apconfig/urls.py`, `backend/apconfig/wsgi.py`, `backend/requirements.txt`
- Create: `docker-compose.yml`
- Create: `frontend/` (Vite React-TS scaffold) with Tailwind configured
- Create: `README.md` (how to run both halves locally)
- Test: `backend/apconfig/tests/test_health.py`

**Interfaces:**
- Produces: `GET /api/health/` → `{"status": "ok"}`, 200. Postgres reachable at `localhost:5432` via `docker-compose up -d`. Frontend dev server runs `npm run dev` from `frontend/`.

- [ ] **Step 1: Write the failing test**

```python
# backend/apconfig/tests/test_health.py
def test_health_check(client):
    resp = client.get("/api/health/")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest backend/apconfig/tests/test_health.py -v`
Expected: FAIL (app/urls don't exist yet, or import error)

- [ ] **Step 3: Scaffold the Django project and health endpoint**

`django-admin startproject apconfig backend` layout (adjust so `manage.py` sits at `backend/`), add `rest_framework` to `INSTALLED_APPS`, configure `DATABASES` from env vars (`POSTGRES_HOST`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, default to the docker-compose values), add a plain function view for `/api/health/` returning the fixed JSON above. Pin `Django`, `djangorestframework`, `djangorestframework-simplejwt`, `psycopg[binary]`, `pytesseract`, `pdf2image`, `Pillow`, `pytest-django` in `requirements.txt`.

- [ ] **Step 4: Write `docker-compose.yml` with a single `postgres:16` service**

Env vars matching `settings.py`'s defaults; a named volume for data persistence.

- [ ] **Step 5: Scaffold the frontend**

`npm create vite@latest frontend -- --template react-ts`, install and configure Tailwind CSS per its Vite guide, add shadcn/ui init (`npx shadcn@latest init`) with default theme. Leave `App.tsx` as the Vite default — later tasks replace it.

- [ ] **Step 6: Run test to verify it passes**

Run: `docker-compose up -d && cd backend && pytest apconfig/tests/test_health.py -v`
Expected: PASS

- [ ] **Step 7: Write `README.md` with setup/run steps for both halves**

- [ ] **Step 8: Commit**

```bash
git add backend frontend docker-compose.yml README.md .gitignore
git commit -m "chore: scaffold Django backend, React frontend, Postgres compose"
```

---

### Task 2: Custom User model, roles, JWT auth

**Files:**
- Create: `backend/accounts/models.py`, `backend/accounts/serializers.py`, `backend/accounts/views.py`, `backend/accounts/permissions.py`, `backend/accounts/urls.py`
- Modify: `backend/apconfig/settings.py` (`AUTH_USER_MODEL`, `INSTALLED_APPS`, `REST_FRAMEWORK` default auth classes, `SIMPLE_JWT` settings), `backend/apconfig/urls.py` (mount `accounts.urls`, JWT token views)
- Test: `backend/accounts/tests/test_auth.py`

**Interfaces:**
- Produces: `User` model with `role` field, choices `("requester", "Requester")`, `("approver", "Approver")`, `("ap_admin", "AP Admin")`, `("vendor", "Vendor")`. `POST /api/auth/register/` (email, password, role) → 201 + user id. `POST /api/auth/login/` (email, password) → `{"access": ..., "refresh": ...}`. `POST /api/auth/refresh/` → `{"access": ...}`. `accounts.permissions.HasRole(*roles)` — a DRF permission class factory/class usable as `permission_classes = [HasRole("requester", "ap_admin")]`, checking `request.user.role`.
- Consumes: Task 1's project skeleton.

- [ ] **Step 1: Write the failing tests**

```python
# backend/accounts/tests/test_auth.py
def test_register_creates_user_with_role(client):
    resp = client.post("/api/auth/register/", {"email": "r@x.com", "password": "pw12345!", "role": "requester"})
    assert resp.status_code == 201

def test_login_returns_access_and_refresh_tokens(client, django_user_model):
    django_user_model.objects.create_user(email="a@x.com", password="pw12345!", role="approver")
    resp = client.post("/api/auth/login/", {"email": "a@x.com", "password": "pw12345!"})
    assert resp.status_code == 200
    assert "access" in resp.json() and "refresh" in resp.json()

def test_has_role_permission_rejects_wrong_role(client, django_user_model):
    django_user_model.objects.create_user(email="v@x.com", password="pw12345!", role="vendor")
    login = client.post("/api/auth/login/", {"email": "v@x.com", "password": "pw12345!"}).json()
    resp = client.get("/api/invoices/", HTTP_AUTHORIZATION=f"Bearer {login['access']}")
    assert resp.status_code == 403
```

(The third test anticipates Task 3's `/api/invoices/` list endpoint restricted to non-`vendor` roles; mark it `xfail` if Task 3 isn't implemented yet, un-xfail once it is.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest backend/accounts/tests/test_auth.py -v`
Expected: FAIL (no `User`/`role`, no endpoints)

- [ ] **Step 3: Implement `User` model with `email` as `USERNAME_FIELD` and `role` field in `backend/accounts/models.py`**

Use Django's `AbstractUser`-derived or a minimal custom manager; `role` is a `CharField` with the 4 choices above, no default (must be supplied at creation).

- [ ] **Step 4: Implement `RegisterSerializer`/`RegisterView` and wire `TokenObtainPairView`/`TokenRefreshView` under `/api/auth/`**

`login` uses simplejwt's `TokenObtainPairView` pointed at `email`/`password`. Set `AUTH_USER_MODEL = "accounts.User"` in settings before the first migration.

- [ ] **Step 5: Implement `HasRole` in `backend/accounts/permissions.py`**

- [ ] **Step 6: Run tests to verify they pass**

Run: `python manage.py makemigrations accounts && python manage.py migrate && pytest backend/accounts/tests/test_auth.py -v`
Expected: PASS (third test `xfail` until Task 3 lands its endpoint, then flip to a real pass)

- [ ] **Step 7: Commit**

```bash
git add backend/accounts backend/apconfig
git commit -m "feat: custom User model with roles, JWT auth, HasRole permission"
```

---

### Task 3: Invoice model + upload capture endpoint

**Files:**
- Create: `backend/invoices/models.py`, `backend/invoices/serializers.py`, `backend/invoices/views.py`, `backend/invoices/urls.py`
- Modify: `backend/apconfig/settings.py` (`INSTALLED_APPS`, `MEDIA_ROOT`/`MEDIA_URL`), `backend/apconfig/urls.py` (mount `invoices.urls`)
- Test: `backend/invoices/tests/test_upload.py`

**Interfaces:**
- Produces: `Invoice` model — `file` (FileField), `source` (`"manual"`/`"email"`, default `"manual"`), `status` (`"uploaded"`/`"extracted"`/`"needs_review"`/`"validated"`, default `"uploaded"`), `uploaded_by` (FK to `User`), `raw_ocr_text` (nullable TextField), `created_at`. `POST /api/invoices/` (multipart, field `file`) → 201 + serialized invoice, restricted to `HasRole("requester", "ap_admin")`. `GET /api/invoices/` → list, same role restriction (this satisfies Task 2's `xfail` test).
- Consumes: Task 2's `User`, `HasRole`.

- [ ] **Step 1: Write the failing tests**

```python
# backend/invoices/tests/test_upload.py
def test_upload_pdf_creates_invoice(auth_client_requester, pdf_file):
    resp = auth_client_requester.post("/api/invoices/", {"file": pdf_file}, format="multipart")
    assert resp.status_code == 201
    assert resp.json()["status"] == "uploaded"

def test_upload_rejects_non_pdf_image_file(auth_client_requester, txt_file):
    resp = auth_client_requester.post("/api/invoices/", {"file": txt_file}, format="multipart")
    assert resp.status_code == 400

def test_vendor_role_cannot_list_invoices(auth_client_vendor):
    resp = auth_client_vendor.get("/api/invoices/")
    assert resp.status_code == 403
```

(`auth_client_requester`/`auth_client_vendor` are pytest fixtures: create the user, log in, return a DRF `APIClient` with the `Authorization` header set — add to `backend/conftest.py`.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest backend/invoices/tests/test_upload.py -v`
Expected: FAIL (no `Invoice` model/endpoint)

- [ ] **Step 3: Implement `Invoice` model in `backend/invoices/models.py`**

- [ ] **Step 4: Implement `InvoiceUploadSerializer` validating file extension (`.pdf`, `.png`, `.jpg`, `.jpeg`) and non-zero size, and `InvoiceUploadView` (DRF `ListCreateAPIView`) with `permission_classes = [HasRole("requester", "ap_admin")]`**

- [ ] **Step 5: Run tests to verify they pass, then un-xfail Task 2's third test**

Run: `python manage.py makemigrations invoices && python manage.py migrate && pytest backend/invoices backend/accounts -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/invoices backend/apconfig
git commit -m "feat: Invoice model and role-restricted upload endpoint"
```

---

### Task 4: OCR pipeline

**Files:**
- Create: `backend/invoices/ocr.py`
- Modify: `backend/invoices/views.py` (call OCR synchronously after save, store result, set `status="extracted"` or keep `"uploaded"` on OCR failure)
- Test: `backend/invoices/tests/test_ocr.py`

**Interfaces:**
- Produces: `run_ocr(file_path: str) -> str` — returns extracted raw text; raises `OcrError` (defined in this module) on an unreadable/corrupt file.
- Consumes: Task 3's `Invoice.file` path.

- [ ] **Step 1: Write the failing tests**

```python
# backend/invoices/tests/test_ocr.py
def test_run_ocr_extracts_text_from_sample_image(sample_invoice_image_path):
    text = run_ocr(sample_invoice_image_path)
    assert "INVOICE" in text.upper()

def test_run_ocr_raises_on_corrupt_file(tmp_path):
    bad = tmp_path / "bad.pdf"
    bad.write_bytes(b"not a real pdf")
    with pytest.raises(OcrError):
        run_ocr(str(bad))
```

(`sample_invoice_image_path` fixture: generate a small PNG with Pillow drawing the word "INVOICE" in text, saved to a temp path — no external sample file needed.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest backend/invoices/tests/test_ocr.py -v`
Expected: FAIL (`run_ocr` not defined)

- [ ] **Step 3: Implement `run_ocr` in `backend/invoices/ocr.py`**

For `.pdf`, convert to images with `pdf2image.convert_from_path`; for image files, open directly with Pillow. Preprocess each page: convert to grayscale, then binarize (Pillow `.convert("L").point(threshold)` or `ImageOps`), run `pytesseract.image_to_string(img, config="--psm 6")`, concatenate page texts. Wrap `pdf2image`/`pytesseract` exceptions and non-existent/corrupt file errors in `OcrError`.

- [ ] **Step 4: Wire `run_ocr` into the upload view**

After `Invoice.objects.create(...)`, call `run_ocr(invoice.file.path)` in a try/except; on success set `invoice.raw_ocr_text` and `status="extracted"`; on `OcrError`, set `status="needs_review"` and continue (don't fail the upload request — the file is saved either way).

- [ ] **Step 5: Run tests to verify they pass**

Run: `pytest backend/invoices/tests/test_ocr.py backend/invoices/tests/test_upload.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/invoices/ocr.py backend/invoices/views.py backend/invoices/tests/test_ocr.py
git commit -m "feat: Tesseract OCR pipeline with grayscale+binarize preprocessing"
```

---

### Task 5: Regex field extraction

**Files:**
- Create: `backend/invoices/extraction.py`
- Modify: `backend/invoices/models.py` (add `extracted_invoice_no`, `extracted_invoice_date`, `extracted_gstin`, `extracted_total_amount`, `extracted_vendor_name` — all nullable `CharField`/`DecimalField`/`DateField`), `backend/invoices/views.py` (call extraction after OCR succeeds)
- Test: `backend/invoices/tests/test_extraction.py`

**Interfaces:**
- Produces: `extract_fields(text: str) -> dict` — keys `invoice_no`, `invoice_date`, `gstin`, `total_amount`, `vendor_name`; each value is the matched string (or `None` if not found). No confidence scoring in this task (Task 6 treats a missing field as the "low confidence" signal).
- Consumes: Task 4's `run_ocr` output (raw text string — extraction itself only takes a string, no DB/file coupling, so it's unit-testable without OCR).

- [ ] **Step 1: Write the failing tests**

```python
# backend/invoices/tests/test_extraction.py
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest backend/invoices/tests/test_extraction.py -v`
Expected: FAIL (`extract_fields` not defined)

- [ ] **Step 3: Implement `extract_fields` in `backend/invoices/extraction.py`**

One `re.compile` per field with named groups, each anchored at a label (`\bInvoice\s*No\b`, `\bGSTIN\b`, `\bTotal\s*Amount\b`, `\bInvoice\s*Date\b`, `\bVendor\b`), non-greedy up to end of line, no nested quantifiers (to avoid catastrophic backtracking). Return `None` per field when its pattern doesn't match.

- [ ] **Step 4: Wire extraction into the upload view**

After OCR sets `raw_ocr_text`, call `extract_fields` and populate the 5 `extracted_*` model fields; leave `status="extracted"`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `python manage.py makemigrations invoices && python manage.py migrate && pytest backend/invoices/tests/test_extraction.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/invoices/extraction.py backend/invoices/models.py backend/invoices/views.py
git commit -m "feat: regex-based invoice field extraction"
```

---

### Task 6: GSTIN checksum validator

**Files:**
- Create: `backend/invoices/gstin.py`
- Test: `backend/invoices/tests/test_gstin.py`

**Interfaces:**
- Produces: `is_valid_gstin(value: str) -> bool` — `True` only if `value` is 15 chars, matches the structural format (2-digit state code + 10-char PAN + 1 entity code + literal `Z` + 1 checksum char), and its modulo-36 check digit matches.
- Consumes: nothing (pure function, independently testable).

- [ ] **Step 1: Write the failing tests**

```python
# backend/invoices/tests/test_gstin.py
def test_valid_gstin_passes():
    assert is_valid_gstin("27AAACC1206D1Z0") is True  # confirm this is a real valid-checksum GSTIN before using it

def test_wrong_length_fails():
    assert is_valid_gstin("27AAACC1206D1Z") is False

def test_right_length_wrong_checksum_fails():
    assert is_valid_gstin("27AAACC1206D1Z9") is False
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest backend/invoices/tests/test_gstin.py -v`
Expected: FAIL (`is_valid_gstin` not defined)

- [ ] **Step 3: Implement `is_valid_gstin` in `backend/invoices/gstin.py`**

Validate length and structural regex first (short-circuit `False` on mismatch), then compute the modulo-36 check digit over the first 14 characters (standard GSTIN checksum: character codeset `"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"`, alternating weights 1/2 per the published algorithm) and compare to the 15th character.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest backend/invoices/tests/test_gstin.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/invoices/gstin.py backend/invoices/tests/test_gstin.py
git commit -m "feat: GSTIN modulo-36 checksum validator"
```

---

### Task 7: Validation engine + exceptions queue

**Files:**
- Create: `backend/invoices/validation.py`
- Modify: `backend/invoices/models.py` (add `InvoiceException` model: `invoice` FK, `reason` CharField, `created_at`; add `"needs_review"`/`"validated"` to `Invoice.status` if not already present from Task 3), `backend/invoices/views.py` (call `validate_invoice` after extraction, create `InvoiceException` rows and set status accordingly), `backend/invoices/serializers.py` (expose exceptions on invoice detail)
- Test: `backend/invoices/tests/test_validation.py`

**Interfaces:**
- Produces: `validate_invoice(invoice: Invoice) -> list[str]` — list of human-readable exception reasons (empty list = passes validation). Checks, in order: mandatory fields present (`invoice_no`, `invoice_date`, `gstin`, `total_amount`, `vendor_name` all non-`None`); duplicate detection (another `Invoice` with the same `extracted_invoice_no` + `extracted_vendor_name` already `"validated"`); GSTIN checksum via Task 6's `is_valid_gstin`; amount format (parses as a positive decimal after stripping thousands separators).
- Consumes: Task 5's `extracted_*` fields, Task 6's `is_valid_gstin`.

- [ ] **Step 1: Write the failing tests**

```python
# backend/invoices/tests/test_validation.py
def test_validate_invoice_passes_clean_invoice(clean_invoice):
    assert validate_invoice(clean_invoice) == []

def test_validate_invoice_flags_missing_mandatory_field(invoice_missing_invoice_no):
    reasons = validate_invoice(invoice_missing_invoice_no)
    assert any("invoice_no" in r for r in reasons)

def test_validate_invoice_flags_duplicate(clean_invoice, duplicate_of_clean_invoice):
    reasons = validate_invoice(duplicate_of_clean_invoice)
    assert any("duplicate" in r.lower() for r in reasons)

def test_validate_invoice_flags_bad_gstin_checksum(invoice_with_bad_gstin_checksum):
    reasons = validate_invoice(invoice_with_bad_gstin_checksum)
    assert any("gstin" in r.lower() for r in reasons)

def test_validate_invoice_flags_malformed_amount(invoice_with_malformed_amount):
    reasons = validate_invoice(invoice_with_malformed_amount)
    assert any("amount" in r.lower() for r in reasons)
```

(Fixtures build `Invoice` instances directly with `extracted_*` fields set, no OCR/upload involved — validation is unit-tested against the model, independent of Tasks 4/5's pipeline.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest backend/invoices/tests/test_validation.py -v`
Expected: FAIL (`validate_invoice` not defined)

- [ ] **Step 3: Add `InvoiceException` model and migrate**

- [ ] **Step 4: Implement `validate_invoice` in `backend/invoices/validation.py`**

- [ ] **Step 5: Wire into the upload view**

After extraction, call `validate_invoice`; if it returns a non-empty list, create one `InvoiceException` row per reason and set `invoice.status = "needs_review"`; otherwise set `invoice.status = "validated"`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `python manage.py makemigrations invoices && python manage.py migrate && pytest backend/invoices -v`
Expected: PASS, full `backend/invoices` and `backend/accounts` suite green

- [ ] **Step 7: Commit**

```bash
git add backend/invoices/validation.py backend/invoices/models.py backend/invoices/views.py backend/invoices/serializers.py
git commit -m "feat: validation engine with mandatory/duplicate/GSTIN/amount checks and exceptions queue"
```

---

### Task 8: Frontend — login + upload page wired to the real API

**Files:**
- Create: `frontend/src/lib/api.ts`, `frontend/src/pages/LoginPage.tsx`, `frontend/src/pages/UploadPage.tsx`
- Modify: `frontend/src/App.tsx` (routing between the two pages, redirect to login if no stored token)

**Interfaces:**
- Produces: a usable manual smoke-test flow — load the app, log in with a seeded user (any role from Task 2), land on the upload page, drag-drop or pick a PDF/image, see it appear in a list with its status (`uploaded`/`needs_review`/`validated`).
- Consumes: Task 2's `/api/auth/login/`, Task 3's `/api/invoices/` (GET list, POST upload).

- [ ] **Step 1: Implement `frontend/src/lib/api.ts`**

A small fetch/axios wrapper: `login(email, password)` storing `access`/`refresh` in memory + `localStorage`, `listInvoices()`, `uploadInvoice(file: File)` — all calling the Task 2/3 endpoints with the `Authorization: Bearer` header attached.

- [ ] **Step 2: Implement `LoginPage.tsx`**

Email/password form (shadcn `Input`/`Button`), calls `api.login`, on success navigates to `/upload`.

- [ ] **Step 3: Implement `UploadPage.tsx`**

Drag-drop/file-picker (shadcn components) calling `api.uploadInvoice`, a table listing invoices from `api.listInvoices()` with `status` as a badge, refreshed after each upload.

- [ ] **Step 4: Wire routing in `App.tsx`**

Use `react-router-dom` (add to `package.json`); unauthenticated → `/login`, authenticated → `/upload`.

- [ ] **Step 5: Manual verification**

Run: `docker-compose up -d`, `cd backend && python manage.py runserver`, `cd frontend && npm run dev`. In the browser: register a user via the DRF browsable API or a `manage.py createsuperuser`-style one-off script, log in through the UI, upload a real sample invoice PDF/image, confirm its status updates after the page refetches.
Expected: upload appears in the table with a non-`"uploaded"` status (OCR/extraction/validation ran).

- [ ] **Step 6: Commit**

```bash
git add frontend/src
git commit -m "feat: login and upload pages wired to auth and invoice APIs"
```
