# Decision Log — AP Automation Project

Every design decision made during planning, in order, with the reasoning behind
it. Read this before the demo video script — it's the raw material for "why did
you build it that way" answers.

---

### 1. Scope: deep core with honest stubs, not shallow breadth
**Decision:** Build real logic for OCR, validation, matching, and workflow. Mock
only genuinely external systems (bank, ERP) behind a real interface.
**Why:** A reviewer who opens the code sees either real engineering or theater.
Mocking everything shallowly looks complete from a feature list but fails the
moment someone reads the implementation. Interviewers grade judgment, not
checkbox count.

### 2. Repo location & name
**Decision:** New folder `ap-automation/`, git-initialized, pushed to GitHub as
`ap-automation`.
**Why:** No existing repo to build into; needed a clean, named project for
submission.

### 3. Auth & roles
**Decision:** 4 roles (`Requester`, `Approver`, `AP Admin`, `Vendor`) via a role
field on the user profile, JWT auth (`djangorestframework-simplejwt`), no SSO.
**Why:** The approval matrix and role-based approvals (module 5) need roles to
exist, but Django's full groups/permissions system is more machinery than a
3-day build needs. JWT is the standard, expected pairing with a React SPA.

### 4. OCR engine: Tesseract, regex-only header-field extraction
**Decision:** `pytesseract`/`pdf2image` for OCR; regex + positional heuristics for
*header* field identification (invoice no., date, GSTIN, vendor name, total). No
cloud vision API, no LLM call for these five fields.
**Why:** Keeps that part of the demo dependency-free (no API keys, works offline,
no cost) and deterministic to test. **How to describe this honestly to
interviewers:** Tesseract's engine (v4+) is itself a neural network (LSTM) —
calling the OCR step "AI-powered" is accurate, not marketing. The *header-field
classification* layer on top is deliberately rule-based regex, not ML — don't
claim that part is "AI," since that would be the actual overclaim.

**Addendum — line items are the deliberate exception.** Real line-item/table
extraction from OCR text is genuinely hard with regex: column alignment varies
across invoice layouts, and OCR noise breaks naive column-splitting. Rather than
ship fragile regex likely to misfire on an unfamiliar invoice live in a demo,
`invoices/llm_extraction.py` calls an LLM (Google Gemini, genuinely free unlike Anthropic/OpenAI, model configurable via
`GEMINI_MODEL`) with the OCR'd text, asking for a structured JSON array of
line items. This is scoped narrowly and kept honest about its limits:
- **Best-effort only.** Nothing in validation, matching or approval depends on
  it succeeding — a missing or malformed response just means no line items
  are shown, never an upload failure.
- **Never trusted as a number.** Every field comes back as a `CharField`, same
  as the regex-extracted header fields — an LLM's read of an amount is still
  unverified free text, not something the system does arithmetic on without a
  human looking at it.
- **No key configured → silently does nothing.** `extract_line_items()` returns
  `[]` immediately if `GEMINI_API_KEY` isn't set, so the feature degrades to
  "not present" rather than failing loudly, in any environment that hasn't
  configured it.

This framing matters for the interview: the header-field decision above is a
genuine instance of "automation, not AI" done on purpose; line items are the
one place an LLM is actually used, and only because the realistic alternative
is fragile, overfit regex for a task that is legitimately an unstructured
reading problem — not applying an LLM everywhere for its own sake.

### 5. PO/GRN data source
**Decision:** Build a small internal PO & GRN CRUD module with CSV bulk import
(mirrors the invoice uploader), rather than only seed/fixture data.
**Why:** The scope doc specifies matching *types* (2-way: PO vs Invoice; 3-way: PO
vs GRN vs Invoice) but never says how POs/GRNs enter the system, and there's no
real ERP to source them from (note: the doc also never defines a dedicated ERP
integration module — it's only mentioned once, in the overview). A CRUD+import
module makes matching genuinely demoable end-to-end instead of hardcoded.

### 6. Email ingestion: real, not mocked
**Decision:** Real IMAP polling (`imaplib`) against a test mailbox you control,
feeding attachments into the same OCR pipeline as manual upload.
**Why:** It's cheap to build correctly and "actually works, demoed live" is a
stronger signal than a button that pretends to receive email.

### 7. Banking integration: mock adapter behind a real interface
**Decision:** `BankingGateway` abstract interface, `MockBankingGateway`
concrete implementation (simulated delay/status), explicitly designed to be
swapped for a real gateway (e.g., Razorpay sandbox) later without touching
payment tracking, dashboards, or reports.
**Why:** No real bank API is realistically reachable in days, and touching a real
one with fabricated AP data would be irresponsible. The adapter pattern itself is
the thing worth demonstrating — it's the correct engineering response to "this
dependency isn't available yet."

### 8. Hosting/deployment: stretch goal, Dockerized, Render Web Service
**Decision:** Deployment attempted only after core modules work. If attempted:
full Docker Compose stack (Django+Gunicorn, Postgres, Nginx serving React +
proxying `/api`), deployed as a single Render Web Service built from the
Dockerfile — not split across Vercel (frontend) + a separate backend host.
**Why:** The email calls live deployment "an added advantage," not mandatory, so
it's correctly weighted below getting modules genuinely working. A unified
containerized deploy reads as owned infrastructure; a Vercel+Render split reads as
stitched-together free tiers.

### 9. Frontend UI stack
**Decision:** React + TypeScript + Tailwind CSS + shadcn/ui + Recharts.
**Why:** Produces a deliberately-designed-looking UI quickly without a heavy
runtime dependency (shadcn components are copy-in, not an installed library), and
avoids the obviously-default look of Bootstrap/MUI.

### 10. Testing depth
**Decision:** Unit tests (pytest-django) on validation engine, matching logic,
approval/escalation state transitions, GST/TIN validation. Integration tests
(DRF `APIClient`) on key end-to-end flows. No frontend test suite.
**Why:** Neither the scope doc nor the assignment email mandates a specific test
layer — the email only asks for "code quality." Applied general engineering
practice: tests concentrate where correctness logic actually lives, not spread
thin for checklist coverage.

### 11. Reports output format
**Decision:** In-app filterable table + chart views, CSV export as baseline, PDF
export (`weasyprint`) as a stretch addition.
**Why:** Doc doesn't specify a format. CSV is cheap and always useful; PDF adds
polish only if time allows.

### 12. Mobile approval support
**Decision:** Fully responsive React UI. No native app, no installable PWA.
**Why:** A native app is out of scope for a React/Django stack in days; a PWA
wrapper is extra complexity for a feature that's satisfied by genuinely good
responsive design (proper touch targets, mobile nav — not just "doesn't break").

### 13. Reminder/escalation notifications
**Decision:** Both in-app notification center (DB-backed) and real email (SMTP),
reusing the same mail infra as email ingestion.
**Why:** Email notifications are nearly free once SMTP is configured for the
ingestion mailbox anyway, and "the approver gets a real email" is a strong,
concrete demo moment.

### 14. Vendor bank details: encrypted at rest
**Decision:** Field-level encryption in Postgres (`django-cryptography` or
equivalent), masked account numbers in API responses except for AP Admin role.
**Why:** Bank details are sensitive financial PII even in a demo with fake data.
Cheap to implement (one library, one field type), and directly answers the
standing instruction to avoid introducing security vulnerabilities — not
optional just because the data is synthetic.

### 15. Build sequence / 3-day compression
**Decision:** Day 1 = scaffold+auth+DB+capture+OCR+validation. Day 2 =
vendor+PO/GRN+matching+workflow+notifications. Day 3 = payment(mock)+dashboards+
reports+tests+README/writeup+video; deployment and PDF export/e2e tests are first
cut if day 3 runs tight.
**Why:** Front-loads the modules most likely to be scrutinized (OCR, matching,
workflow) and makes the parts that can slip (polish, deployment) visible early
rather than discovered on the last day.
