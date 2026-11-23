# AP Automation

An Accounts Payable automation system. A user uploads a supplier invoice (PDF or image); the system reads it with OCR, pulls out the key fields, checks them, matches the invoice to a purchase order, routes it through a configurable approval chain, and lets an admin request payment. Dashboards and reports show what is happening.

Built as a recruitment take-home for Templegate Technologies. Stack: Django 5 + Django REST Framework + PostgreSQL (backend), React 19 + Vite + Tailwind (frontend) — the mandated stack, no substitutions.

## Submission checklist

| Requirement | Where |
|---|---|
| Source code (React + Django + PostgreSQL) | this repository |
| Live deployment (added advantage) | Render — see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) |
| Database schema (tables + relationships) | [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) (ER diagram + per-table breakdown), raw dump at [docs/schema/schema.sql](docs/schema/schema.sql) |
| Demo video | architecture, design decisions and a full feature walkthrough — recording script in [docs/DEMO_VIDEO_SCRIPT.md](docs/DEMO_VIDEO_SCRIPT.md), ready-made test invoices in [docs/sample-invoices/](docs/sample-invoices/) |
| Challenges and solutions | [docs/CHALLENGES_AND_SOLUTIONS.md](docs/CHALLENGES_AND_SOLUTIONS.md) |

## The invoice journey, in plain words

1. A requester uploads an invoice file.
2. Tesseract OCR turns the image into text. Simple pattern rules (regular expressions) pick out invoice number, date, GSTIN, total and vendor name.
3. The validation engine checks the result: all mandatory fields present, GSTIN checksum valid, vendor exists and is active, amount is a valid positive number, not a duplicate.
4. Anything wrong becomes a row in the invoice's exception list and the invoice goes to **Needs Review**.
5. If the invoice is linked to a purchase order, it is matched to the PO (2-way) and any goods receipts (3-way) with a 1% amount tolerance.
6. A clean match starts approval. The invoice amount picks an approval rule, which creates one approval step per required role (steps can run in parallel).
7. Approvers approve or reject. Steps nobody touches in time are escalated to an AP Admin by a command (`escalate_pending_approvals`).
8. When every step is approved the invoice is **Approved**; an AP Admin requests payment through the (mock) bank gateway and it becomes **Paid**.
9. The dashboard and five reports (with CSV export) read from the same data.

Full walkthrough with diagrams: [docs/HOW_IT_WORKS.md](docs/HOW_IT_WORKS.md).

## Features by scope-doc module

| Module | Status | Notes |
|---|---|---|
| Invoice capture | Real (manual upload) | PDF/PNG/JPG, extension and magic-byte checks. **Email (IMAP) ingestion is not built.** |
| OCR extraction | Real | Tesseract (LSTM engine) via pytesseract + pdf2image/Poppler. Header-field extraction is deliberately regex, not an LLM; line-item extraction uses an LLM instead, on purpose (DECISIONS.md #4). Runs synchronously inside the upload request. |
| Line-item extraction | Real, LLM-based, best-effort | `invoices/llm_extraction.py` calls Google Gemini (free tier) with the OCR'd text for a structured JSON line-item list. Optional: does nothing if `GEMINI_API_KEY` isn't set, never blocks an upload if it fails. |
| Validation engine | Real | Mandatory fields, GSTIN modulo-36 checksum, vendor master check, amount, duplicate detection; failures become exception rows. |
| PO matching | Real | 2-way (PO vs invoice) and 3-way (PO vs GRN vs invoice), 1% tolerance. PO/GRN entered via CRUD or CSV import (no real ERP). |
| Workflow / approvals | Real | Configurable amount-based ApprovalRule matrix, parallel steps, escalation command, in-app notifications plus email (console backend by default). |
| Vendor management | Real | Vendor master; bank details encrypted at rest (Fernet) and masked for non-admins. |
| Payments | Real tracking, **mocked bank** | `BankingGateway` abstract interface with `MockBankingGateway` (always succeeds). Selected by the `BANKING_GATEWAY` env var. No real bank is called. |
| Dashboards | Real | Summary endpoint over real data (see plan doc for the metrics). |
| Reports | Real | Five reports (AP aging, invoice status, exceptions, audit log, GST/tax) with CSV export. The audit log is derived from existing records, not a separate table. |

Known gaps and limits are listed honestly in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#deliberately-out-of-scope). Notably: an invoice with no linked PO stays at **Validated** (matching and approval only start for PO-linked invoices).

## Tech stack and why

- **Django + DRF**: batteries included auth, ORM and admin; fast to build correct CRUD.
- **PostgreSQL**: relational integrity for money-adjacent data; row locks (`select_for_update`) protect approvals and payments from double-processing.
- **JWT (simplejwt)**: standard pairing with a React single-page app. 30 minute access token, 1 day refresh.
- **Tesseract**: free, offline, no API keys.
- **React + Vite + Tailwind + Recharts**: quick, responsive UI with dark mode.
- **Fernet (cryptography)**: field-level encryption for bank details.

## Quick start

Prerequisites: Python 3.12+, Node 20+ (22 used in CI), PostgreSQL 16+, Tesseract and Poppler on PATH (`tesseract --version`).

Create a Postgres database/user matching the defaults (`ap_automation` / `ap_automation` / `ap_automation_dev`, host `localhost`, port 5432), or set the `POSTGRES_*` variables. `docker-compose.yml` starts a suitable Postgres if you have Docker.

```bash
# Backend
cd backend
python -m venv .venv
.venv/Scripts/activate          # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_demo      # demo users, vendors, POs, invoices in every status
python manage.py runserver      # http://localhost:8000

# Frontend (second terminal)
cd frontend
npm install
npm run dev                     # http://localhost:5173
```

Demo logins (created by `seed_demo`), password `Demo@12345` for all:

| Email | Role |
|---|---|
| requester@demo.com | Requester |
| approver@demo.com | Approver |
| admin@demo.com | AP Admin |
| vendor@demo.com | Vendor |

Useful URLs: health `http://localhost:8000/api/health/`, API docs `http://localhost:8000/api/docs/`.

Environment variables (all optional in dev): `POSTGRES_DB/USER/PASSWORD/HOST/PORT`, `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`, `FIELD_ENCRYPTION_KEY`, `TESSERACT_CMD`, `POPPLER_PATH`, `EMAIL_HOST/PORT/HOST_USER/HOST_PASSWORD/USE_TLS`, `DEFAULT_FROM_EMAIL`, `BANKING_GATEWAY`, `GEMINI_API_KEY`/`GEMINI_MODEL` (optional — enables LLM line-item extraction; without it the feature just doesn't add any line items, nothing breaks). Frontend: `VITE_API_BASE` (defaults to `http://localhost:8000`). A full template is in `.env.example`.

## Tests

```bash
cd backend && pytest            # backend unit + API tests (needs Postgres running)
cd frontend && npm run lint     # oxlint (currently a few warnings, no errors expected)
cd frontend && npm run build    # TypeScript check + production build
```

There is no frontend test suite (DECISIONS.md #10). For manual QA use [docs/TESTING_GUIDE.md](docs/TESTING_GUIDE.md). A GitHub Actions workflow (`.github/workflows/ci.yml`) runs the same checks, but it has not yet been run.

## Repo map

```
backend/
  apconfig/    settings, root URLs, health check
  accounts/    custom User model with roles, JWT auth, HasRole permission
  invoices/    upload, OCR, extraction, GSTIN, validation, exceptions
  vendors/     vendor master, encrypted bank fields
  procurement/ purchase orders, GRNs, CSV import, matching engine
  workflow/    approval rules/steps, notifications, escalation command
  payments/    Payment model, BankingGateway interface + mock
  dashboard/   summary and reports (added on this branch)
frontend/src/  pages, components/ui primitives, lib/api.ts (typed errors)
docs/          documentation (below)
```

## Documentation

- [docs/APPLICATION_GUIDE.md](docs/APPLICATION_GUIDE.md): plain-English purpose, usage flow and edge cases — why each role exists, not how the code works
- [docs/DEMO_VIDEO_SCRIPT.md](docs/DEMO_VIDEO_SCRIPT.md): the recording script for the demo video — a presentation narrative, deliberately different from the QA-focused testing guide
- [docs/HOW_IT_WORKS.md](docs/HOW_IT_WORKS.md): lifecycle, roles, statuses, interview-defensible decisions
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): components, security, error handling, out of scope
- [docs/TESTING_GUIDE.md](docs/TESTING_GUIDE.md): manual QA script with expected results
- [docs/CHALLENGES_AND_SOLUTIONS.md](docs/CHALLENGES_AND_SOLUTIONS.md): real problems hit and fixed
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): deployment runbook — `render.yaml` is the path actually deployed (Render builds it; no local Docker needed); the Docker Compose path in the same doc was written but never built or run on the dev machine
- [docs/sample-invoices/](docs/sample-invoices/): three ready-made test PDFs (verified against the real OCR pipeline) for a fresh database, covering the happy path, PO tolerance matching, and the exceptions queue
- [docs/DECISIONS.md](docs/DECISIONS.md), [docs/STUDY_GUIDE.md](docs/STUDY_GUIDE.md), [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md), [docs/superpowers/](docs/superpowers/) (specs and plans)
