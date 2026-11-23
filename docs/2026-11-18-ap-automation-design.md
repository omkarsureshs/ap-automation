# AP Automation Software with OCR — Design Doc

**Date:** 2026-11-18
**Context:** Recruitment take-home assignment (Templegate Technologies). Submission deadline 2026-11-24; internal target 3 working days. Mandatory stack: ReactJS, Django, PostgreSQL.

## Intent and why

Build a working Accounts Payable automation system that covers every module in the
provided scope document (`Accounts Payable automation.pdf`), demonstrating real
engineering judgment rather than feature-count theater: genuine OCR, genuine
validation/matching/workflow logic, and honest, clearly-labeled mocks for the pieces
that require external systems (bank, ERP) no take-home assignment can realistically
connect to.

The primary audience is a technical interviewer reviewing the repo, the DB schema,
and a demo video — so legibility and defensibility of decisions matter as much as
feature coverage.

## Goals

- Implement all 9 modules from the scope doc, end to end.
- Real OCR (not stubbed) with a documented extraction approach.
- Real matching logic (2-way/3-way), real approval workflow with escalation.
- Clean architectural seams for the two things that cannot be real in a take-home
  (banking, ERP) so they can be swapped for real integrations later without a rewrite.
- Backend code quality: unit + integration tests on the logic that matters.
- A repo and writeup an interviewer can understand without a live walkthrough.

## Non-goals

- Native mobile app (responsive web satisfies "mobile approval support").
- Real bank/ERP integration (explicitly out of reach in a take-home).
- LLM-based field extraction (regex-only, by decision).
- Frontend automated test suite (manual verification + demo video instead).
- PWA installability.

## Anti-goals (would make this a failure even if "working")

- Fake integrations presented as real (e.g., a banking call that silently no-ops).
- Shallow stub modules that don't actually run the logic they claim to.
- Code that cannot be explained in the demo video.

## Constraints

- Mandatory stack: ReactJS (frontend), Django (backend), PostgreSQL (database).
  Non-negotiable per the assignment email — any other stack is disqualifying.
- ~3 working days of build time.
- No paid APIs / no dependency on external credentials at demo time (OCR must run
  fully offline).

## Approaches considered

1. **Shallow breadth** — stub all 9 modules, fake integrations everywhere. Rejected:
   looks complete on a checklist, falls apart the moment a reviewer opens the code.
2. **Deep core, honest stubs** (chosen) — real logic for everything that can be real
   (OCR, validation, matching, workflow, vendor mgmt, dashboards), real adapter
   pattern + mock implementation for banking/ERP, clearly documented as such.
3. **Narrow and polished** — pick 3-4 modules, skip the rest. Rejected: the scope
   doc is explicit and itemized; partial coverage reads as not having read it.

Chosen: **Approach 2**.

## Architecture

- **Backend:** Django + Django REST Framework, PostgreSQL. JWT auth via
  `djangorestframework-simplejwt`. Role field on user profile:
  `Requester / Approver / AP Admin / Vendor`.
- **Frontend:** React + TypeScript + Tailwind CSS + shadcn/ui components,
  Recharts for dashboard charts. Fully responsive (satisfies mobile approval
  support — no native app, no PWA).
- **OCR:** Tesseract (`pytesseract` + `pdf2image`/`pdfplumber`) run server-side on
  upload. Preprocessing: grayscale + binarization, `--psm 6` for block text.
- **Field extraction:** regex + positional heuristics, anchored with word
  boundaries. Deliberately not LLM-based, for predictability, offline operation,
  and testability.
- **Validation engine:** separate layer from extraction — mandatory field checks,
  duplicate detection, GST/GSTIN checksum validation, amount format validation,
  vendor master cross-check. Low-confidence/failed fields route to an **exceptions
  / manual review queue**, not silently through.
- **PO/GRN matching:** internal PO & GRN module (CRUD + CSV bulk import, mirroring
  the invoice uploader) since no real ERP exists to source them from. 2-way
  (PO vs Invoice) and 3-way (PO vs GRN vs Invoice) match logic against this data.
- **Approval workflow:** configurable approval matrix, role-based approvals,
  escalation mechanism, parallel approvals. Notifications via **both** an in-app
  notification center (DB-backed) and real email (SMTP/Django email backend,
  reusing the mailbox used for email ingestion).
- **Invoice capture:** PDF/Image/drag-drop (direct upload) plus **real email
  ingestion** — a background job polling a test IMAP mailbox via `imaplib`,
  extracting attachments into the same OCR pipeline as manual upload.
- **Payment processing:** `BankingGateway` abstract interface with a
  `MockBankingGateway` implementation (simulated request → delay → status).
  Designed so a future `RazorpayGateway` (sandbox) can be swapped in via a
  settings flag with no changes to payment tracking, dashboards, or reports.
- **Vendor bank details:** encrypted at the field level in Postgres
  (`django-cryptography` or equivalent custom field), masked in API responses
  except to AP Admin role.
- **Reports:** in-app filterable table + chart views (AP aging, invoice status,
  exception report, audit logs, GST/tax reports), CSV export baseline, PDF export
  as a stretch (`weasyprint`).
- **Dashboards:** invoice aging, pending approvals, processing turnaround time,
  OCR accuracy %, vendor-wise analytics, payment tracking — Recharts.
- **Testing:** pytest-django unit tests for validation engine, matching logic,
  approval/escalation state transitions, vendor GST/TIN validation. DRF
  `APIClient` integration tests for the key end-to-end flows (upload→OCR→validate,
  approve→escalate, match→link, pay→status). No frontend test suite (time
  budget); a couple of Playwright smoke tests only if day 3 has slack.
- **Deployment (stretch, attempted last):** fully Dockerized stack (Django+Gunicorn,
  Postgres, Nginx serving the built React app + reverse-proxying `/api`), deployed
  as a Render Web Service built from the Dockerfile — not split across
  Vercel+Render, to read as owned infrastructure rather than stitched-together
  free tiers.

## Build sequence (3 days)

1. **Day 1** — scaffold, auth/roles, DB schema, invoice capture, OCR, extraction,
   validation engine.
2. **Day 2** — vendor management, PO/GRN + CSV import, 2-/3-way matching, approval
   workflow + escalation, notifications (in-app + email).
3. **Day 3** — mock payment processing, dashboards, reports + CSV export, core
   tests, README + challenges writeup, demo video. Email-IMAP-ingestion polish
   and Render deployment are the first things cut if time runs short.

## Open items

- Exact DB schema / migrations (captured as its own deliverable per
  submission requirements).
- Exact regex patterns per field and exception-queue UX details.
- Exact escalation timing defaults (admin-configurable, not hardcoded).
- Demo video script and "Challenges and Solutions" writeup content — drawn from the
  real issues encountered during development, not generic filler.
