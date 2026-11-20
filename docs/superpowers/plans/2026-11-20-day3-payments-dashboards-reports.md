# Day 3: Mock Payment Processing, Dashboards, Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close out the remaining scope-doc modules — Payment Processing (mock gateway, request/status/advice), Dashboards (6 real charts over real data), Reports (5 report types + CSV export, derived from genuine historical records, no fabricated audit table) — and finish with README + Challenges writeup, the full Day 3 slice from `docs/DECISIONS.md` and the design doc.

**Architecture:** A new `payments` app with a `BankingGateway` abstract interface and `MockBankingGateway` (DECISIONS.md #7 — simulated, swappable), triggered only for invoices already at `Invoice.STATUS_APPROVED`. A new `dashboard` app exposes one aggregate endpoint computed live via Django ORM aggregates (`Count`/`Avg`/`Sum`) over `Invoice`/`ApprovalStep`/`Payment` — no new tables duplicating data that already exists. Reports reuse the same real data: the "audit log" report is a derived, on-the-fly union of `InvoiceException`, `ApprovalStep` decisions, and `Payment` events (each already has its own timestamp) rather than a new log table nobody writes to reliably — this keeps the audit trail honest (real events, not a parallel ledger that can drift from the data it's supposed to describe).

**Tech Stack:** Existing stack only. Recharts (already a Day-0 decision, not yet installed — added now) for the dashboard; CSV export via Python's stdlib `csv` module (same as the Day 2 import pattern, no new backend dependency).

**Spec:** `docs/superpowers/specs/2026-11-18-ap-automation-design.md` (Architecture: Payment processing, Dashboards, Reports sections; Build sequence Day 3), with reasoning in `docs/DECISIONS.md` (#7 banking mock, #10 testing depth, #11 report format).

## Global Constraints

- Mandatory stack unchanged: Django + DRF + PostgreSQL, React + TypeScript + Tailwind.
- Payment can only be requested for an invoice at `status == "approved"` — never for `pending_approval`, `needs_review`, or an invoice already paid.
- `MockBankingGateway` is a concrete implementation of an abstract `BankingGateway` interface, swappable via a settings flag, per DECISIONS.md #7 — not a function call hardcoded into the view.
- No new "audit log" table that duplicates data other tables already own; the audit report is computed from existing timestamps.
- CSV export follows the existing import pattern's honesty standard: real data, real column headers, no placeholder/lorem content.
- Follow existing patterns: `HasRole(*roles)` for permissions, pytest-django + DRF `APIClient` for backend tests, TDD RED→GREEN→commit per task, the ledger-register design system and typed `ApiError` handling for every new frontend page (no regression to a plain `<table>` or generic error string).

## Review Focus

- Requesting payment twice for the same invoice (double-click, or two tabs) — the second request should be rejected as already-paid/in-progress, not create a second `Payment` row and pay twice.
- Requesting payment for an invoice that is not `approved` (e.g. still `pending_approval`, or `rejected`) — should be refused with a clear reason, not silently processed.
- Dashboard aggregates when there is no data at all (fresh install, zero invoices) — percentages and averages must not divide by zero or render `NaN`/`Infinity`.
- A GST/tax report row where `extracted_gstin` or `extracted_total_amount` is null (an invoice that never got that far) — should be excluded or clearly marked, not crash the CSV export or silently coerce `null` to `"None"`.
- The OCR accuracy metric must measure something real and defensible (e.g. "% of invoices that needed no manual correction before validation"), not an invented number with no basis in the data — this is exactly the kind of claim DECISIONS.md #1 warns against faking.

---

### Task 1: Payments backend — model, mock gateway, request/list API

**Files:**
- Create: `backend/payments/__init__.py`, `backend/payments/apps.py`, `backend/payments/models.py`, `backend/payments/gateways.py`, `backend/payments/serializers.py`, `backend/payments/views.py`, `backend/payments/urls.py`, `backend/payments/admin.py`, `backend/payments/migrations/`
- Create: `backend/payments/tests/__init__.py`, `backend/payments/tests/test_gateway.py`, `backend/payments/tests/test_payment_request.py`
- Modify: `backend/invoices/models.py` (add `STATUS_PAID` choice), `backend/invoices/migrations/` (new migration), `backend/apconfig/settings.py` (`INSTALLED_APPS`, `BANKING_GATEWAY` setting), `backend/apconfig/urls.py` (mount at `/api/payments/`)

**Interfaces:**
- Produces:
  - `payments.gateways.BankingGateway` — abstract base class (`abc.ABC`) with abstract method `initiate_payment(self, amount: Decimal, reference: str) -> PaymentResult`, where `PaymentResult` is a small dataclass `{status: Literal["completed", "failed"], gateway_reference: str, failure_reason: str | None}`.
  - `payments.gateways.MockBankingGateway(BankingGateway)` — `initiate_payment` always returns `status="completed"` with a generated reference (e.g. `f"MOCK-{uuid4().hex[:12].upper()}"`), simulating a real gateway's request/response shape without fake randomness (DECISIONS.md #7: "simulated delay/status" — the delay is architectural, not a fabricated failure chance; failures are demonstrated via test-only injection, not production randomness).
  - `payments.gateways.get_gateway() -> BankingGateway` — reads `settings.BANKING_GATEWAY` (default `"mock"`) and returns the configured instance; this is the swap point DECISIONS.md #7 describes.
  - `payments.models.Payment(invoice FK→Invoice [OneToOne], amount, status ["processing","completed","failed"], gateway_reference, failure_reason, requested_by FK→User, requested_at, completed_at)`.
  - `POST /api/payments/` (body `{"invoice": <id>}`, `HasRole("ap_admin")`) — validates `invoice.status == Invoice.STATUS_APPROVED` and no existing `Payment` row for it, calls `get_gateway().initiate_payment(...)`, creates the `Payment` row, and on `status="completed"` sets `invoice.status = Invoice.STATUS_PAID`.
  - `GET /api/payments/` (`IsAuthenticated`) — list, for the payment-tracking dashboard/report.
- Consumes: `invoices.models.Invoice` (now with `STATUS_PAID`).

- [ ] **Step 1: Write failing tests for the gateway**

```python
def test_mock_gateway_returns_completed_with_a_reference(): ...
def test_get_gateway_returns_mock_gateway_by_default(settings): ...
```

- [ ] **Step 2: Run to verify fail.**

- [ ] **Step 3: Implement `BankingGateway`, `PaymentResult`, `MockBankingGateway`, `get_gateway()`.** Add `BANKING_GATEWAY = os.environ.get("BANKING_GATEWAY", "mock")` to settings.

- [ ] **Step 4: Run to verify pass.**

- [ ] **Step 5: Write failing tests for the request endpoint**

```python
def test_ap_admin_can_request_payment_for_approved_invoice(auth_client_ap_admin, approved_invoice): ...
def test_requester_cannot_request_payment(auth_client_requester, approved_invoice): ...
def test_cannot_request_payment_for_non_approved_invoice(auth_client_ap_admin, pending_approval_invoice): ...
def test_cannot_request_payment_twice_for_the_same_invoice(auth_client_ap_admin, approved_invoice): ...
def test_successful_payment_marks_invoice_paid(auth_client_ap_admin, approved_invoice): ...
```

- [ ] **Step 6: Run to verify fail.**

- [ ] **Step 7: Implement `Payment` model + migration, `PaymentRequestSerializer`/`PaymentSerializer`, `PaymentViewSet` (`create`/`list` only — no update/delete), urls.** The "already paid" check: look up `Payment.objects.filter(invoice=invoice).exists()` before calling the gateway, inside a `transaction.atomic()` block with `select_for_update()` on the invoice row (same double-submit pattern Day 2's `decide_step` already uses) so two concurrent requests can't both pass the check.

- [ ] **Step 8: Run to verify pass.**

- [ ] **Step 9: Run the full backend suite to verify no regressions.**

- [ ] **Step 10: Commit**

```bash
git add backend/payments backend/invoices/models.py backend/invoices/migrations backend/apconfig/settings.py backend/apconfig/urls.py
git commit -m "feat: mock banking gateway and payment request/tracking API"
```

---

### Task 2: Dashboard backend — one aggregate endpoint, real math

**Files:**
- Create: `backend/dashboard/__init__.py`, `backend/dashboard/apps.py`, `backend/dashboard/services.py`, `backend/dashboard/views.py`, `backend/dashboard/urls.py`
- Create: `backend/dashboard/tests/__init__.py`, `backend/dashboard/tests/test_summary.py`
- Modify: `backend/apconfig/settings.py` (`INSTALLED_APPS`), `backend/apconfig/urls.py` (mount at `/api/dashboard/`)

**Interfaces:**
- Produces: `dashboard.services.build_summary() -> dict` with exactly these keys (matching the scope doc's "Dashboard Features" list):
  - `invoice_aging`: list of `{"bucket": "0-7 days" | "8-30 days" | "31-60 days" | "60+ days", "count": int, "total_amount": str}` for invoices not yet `paid`/`rejected`, bucketed by `now() - created_at`.
  - `pending_approvals`: int — count of `ApprovalStep` rows with `status="pending"`.
  - `avg_turnaround_hours`: float | null — mean hours between `created_at` and `decided_at`/completion for invoices that reached a terminal state (`approved`, `rejected`, `paid`); `null` (not `0` or `NaN`) when there are none yet.
  - `ocr_accuracy_percent`: float | null — `100 * (invoices that reached validated/pending_approval/approved/paid without ever hitting needs_review) / (total invoices that finished OCR)`; `null` when the denominator is zero. This is the one Review Focus item about an honest, defensible metric — document the exact formula in a docstring.
  - `vendor_analytics`: list of `{"vendor_name": str, "invoice_count": int, "total_amount": str}`, grouped by `extracted_vendor_name`, top 10 by count.
  - `payment_tracking`: `{"processing": int, "completed": int, "failed": int, "total_paid_amount": str}`.
  - `GET /api/dashboard/summary/` (`IsAuthenticated`) returns this dict.
- Consumes: `invoices.models.Invoice`, `workflow.models.ApprovalStep`, `payments.models.Payment` (Task 1).

- [ ] **Step 1: Write failing tests, including the zero-data case**

```python
def test_build_summary_with_no_invoices_returns_nulls_not_errors(db): ...
def test_invoice_aging_buckets_by_age(db, old_invoice, recent_invoice): ...
def test_pending_approvals_counts_only_pending_steps(db, pending_step, approved_step): ...
def test_ocr_accuracy_excludes_invoices_still_mid_ocr(db, needs_review_invoice, validated_invoice): ...
def test_vendor_analytics_groups_by_vendor_name(db, ...): ...
def test_payment_tracking_counts_by_status(db, completed_payment, failed_payment): ...
```

- [ ] **Step 2: Run to verify fail.**

- [ ] **Step 3: Implement `build_summary()`** using Django's `Count`/`Avg`/`Sum`/`Case`/`When` aggregates — no Python-side loops over the full invoice table for anything that can be expressed as one query.

- [ ] **Step 4: Run to verify pass.**

- [ ] **Step 5: Implement `GET /api/dashboard/summary/`, urls.** Run full suite.

- [ ] **Step 6: Commit**

```bash
git add backend/dashboard backend/apconfig/settings.py backend/apconfig/urls.py
git commit -m "feat: dashboard summary endpoint with real aggregate metrics"
```

---

### Task 3: Reports backend — 5 report types + CSV export

**Files:**
- Create: `backend/dashboard/reports.py`, `backend/dashboard/tests/test_reports.py`
- Modify: `backend/dashboard/views.py`, `backend/dashboard/urls.py`

**Interfaces:**
- Produces: five pure functions in `reports.py`, each `(queryset or none) -> list[dict]` of rows, plus a `to_csv(rows: list[dict]) -> str` helper:
  - `ap_aging_report()` — one row per unpaid invoice: `invoice_no, vendor_name, amount, age_days, status`.
  - `invoice_status_report()` — one row per status value: `status, count`.
  - `exception_report()` — one row per `InvoiceException`: `invoice_no, reason, created_at`.
  - `audit_log_report()` — the derived log: unions `InvoiceException` creation, `ApprovalStep` decisions, and `Payment` completions into one `{timestamp, actor, event, detail}` list, sorted by timestamp descending. `actor` is the user's email where one exists (`decided_by`, `requested_by`) or `"system"` for an automated event (e.g. an exception raised during `perform_create`).
  - `gst_tax_report()` — one row per invoice with both `extracted_gstin` and `extracted_total_amount` present (the Review Focus item: invoices missing either are excluded, not coerced): `invoice_no, vendor_gstin, taxable_amount`.
  - `GET /api/dashboard/reports/<kind>/` where `kind` is one of `ap-aging`, `invoice-status`, `exceptions`, `audit-log`, `gst-tax`, returning JSON by default and CSV when `?format=csv` is passed (`Content-Type: text/csv`, `Content-Disposition: attachment`).
- Consumes: `invoices.models.Invoice`/`InvoiceException`, `workflow.models.ApprovalStep`, `payments.models.Payment`.

- [ ] **Step 1: Write failing tests, including the Review Focus null-field case**

```python
def test_ap_aging_report_excludes_paid_invoices(db, ...): ...
def test_gst_tax_report_excludes_invoices_missing_gstin_or_amount(db, incomplete_invoice, complete_invoice): ...
def test_audit_log_report_merges_and_sorts_all_three_event_sources(db, ...): ...
def test_csv_format_returns_real_csv_with_header_row(auth_client_ap_admin, ...): ...
```

- [ ] **Step 2: Run to verify fail.**

- [ ] **Step 3: Implement the five report functions and `to_csv()`.**

- [ ] **Step 4: Run to verify pass.**

- [ ] **Step 5: Implement the `GET /api/dashboard/reports/<kind>/` view + urls.** Run full suite.

- [ ] **Step 6: Commit**

```bash
git add backend/dashboard/reports.py backend/dashboard/tests/test_reports.py backend/dashboard/views.py backend/dashboard/urls.py
git commit -m "feat: AP aging/status/exception/audit/GST reports with CSV export"
```

---

### Task 4: Frontend — install Recharts, API client additions

**Files:**
- Modify: `frontend/package.json` (add `recharts`), `frontend/src/lib/api.ts`

**Interfaces:**
- Produces: `listPayments()`, `requestPayment(invoiceId: number)`, `getDashboardSummary()`, `getReport(kind, format?)` added to `api.ts`, all routed through the existing `ApiError` classification layer — no page gets a new ad hoc error path.
- Consumes: Tasks 1-3's endpoints.

- [ ] **Step 1: `npm install recharts` (pinned to the version already current at the time of this plan).**
- [ ] **Step 2: Add the TS interfaces and API functions**, following the exact pattern already used for every other resource in this file (`authedFetch` + `handleJsonResponse`).
- [ ] **Step 3: Run `npm run build`.**
Expected: build succeeds.
- [ ] **Step 4: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/lib/api.ts
git commit -m "feat: add recharts and API client functions for payments/dashboard/reports"
```

---

### Task 5: Frontend — Payments page

**Files:**
- Create: `frontend/src/pages/PaymentsPage.tsx`
- Modify: `frontend/src/App.tsx` (route `/payments`)

**Interfaces:**
- Consumes: `listPayments`, `requestPayment`, `listInvoices` (for the "approved, unpaid" list), the `Table`/`Badge`/`Banner`/`EmptyState`/`Skeleton`/`Toast` primitives, `ApiError`.
- Produces: `/payments` route — a list of approved-unpaid invoices with a "Request payment" action (`ap_admin` only, server-enforced same as every other page), and a list of `Payment` records with status badges.

- [ ] **Step 1: Build the page** — two sections (payable invoices / payment history), submit-guarded request action, toast on success/failure distinguishing `validation` (wrong invoice state), `conflict` (already paid), and `forbidden`.
- [ ] **Step 2: Add `"processing"|"completed"|"failed"` to `Badge`'s status map** (payments statuses, distinct namespace from invoice statuses but the component already falls back to neutral for unknowns — add real tones for these three).
- [ ] **Step 3: Run `npm run build`.**
- [ ] **Step 4: Manual check against the real backend** — request payment for a genuinely approved invoice, confirm it completes and the invoice disappears from the payable list; attempt it twice, confirm the second attempt is refused with the conflict copy.
- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/PaymentsPage.tsx frontend/src/App.tsx frontend/src/components/ui/badge.tsx
git commit -m "feat: payments page with request action and status tracking"
```

---

### Task 6: Frontend — Dashboard page (Recharts)

**Files:**
- Create: `frontend/src/pages/DashboardPage.tsx`
- Modify: `frontend/src/App.tsx` (route `/dashboard`, make it the post-login landing route for all roles — this is the one page everyone benefits from seeing first)

**Interfaces:**
- Consumes: `getDashboardSummary()`.
- Produces: 6 chart/stat blocks matching `build_summary()`'s 6 keys exactly, each styled with the ledger-register token palette (chart colors pulled from the same `--ledger`/`--approved`/`--pending`/`--exception` tokens, not Recharts' defaults) and a loading skeleton + error banner with retry, same as every other page.

- [ ] **Step 1: Build the page** — invoice aging as a bar chart, pending approvals + avg turnaround + OCR accuracy as stat tiles (render "—" not "NaN%"/"0%" when the value is `null`), vendor analytics as a horizontal bar or simple table, payment tracking as a small stacked/grouped bar or stat row.
- [ ] **Step 2: Run `npm run build`.**
- [ ] **Step 3: Manual check against the real backend** — confirm the summary endpoint's real numbers render, and that a fresh/empty dataset renders the null-safe placeholders instead of crashing or showing `NaN`.
- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/DashboardPage.tsx frontend/src/App.tsx
git commit -m "feat: dashboard page with real Recharts visualizations"
```

---

### Task 7: Frontend — Reports page

**Files:**
- Create: `frontend/src/pages/ReportsPage.tsx`
- Modify: `frontend/src/App.tsx` (route `/reports`)

**Interfaces:**
- Consumes: `getReport(kind)`.
- Produces: a tabbed page, one tab per report kind, each a `Table` of that report's rows plus a working "Export CSV" link/button that triggers a real file download of the `?format=csv` response (using a `Blob`+`URL.createObjectURL` download, since the artifact-style "download link is inert" limitation doesn't apply to the real app — this is a normal browser download).

- [ ] **Step 1: Build the page** with 5 tabs, loading/empty/error states per tab consistent with every other page.
- [ ] **Step 2: Run `npm run build`.**
- [ ] **Step 3: Manual check against the real backend** — pull each of the 5 report kinds, confirm the CSV download actually contains a header row and real data, not an empty file.
- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/ReportsPage.tsx frontend/src/App.tsx
git commit -m "feat: reports page with 5 report types and CSV export"
```

---

### Task 8: README + Challenges and Solutions writeup

**Files:**
- Modify: `README.md`
- Create: `docs/CHALLENGES_AND_SOLUTIONS.md`

**Interfaces:**
- Produces: an updated `README.md` covering the full, now-complete feature set (payments, dashboard, reports) and env vars (`BANKING_GATEWAY`); `docs/CHALLENGES_AND_SOLUTIONS.md` drawing from the real issues hit across all three days (OCR regex overflow bug, the vendor-cross-check ripple into Day 1 tests, the escalated-invoice-can-never-approve bug the Day 2 reviewer caught, the real-invoice extraction gaps found by testing against actual Clean Fanatics documents, etc.) — real issues from this project's own history, not generic filler, per the design doc's explicit instruction.

- [ ] **Step 1: Update `README.md`.**
- [ ] **Step 2: Write `docs/CHALLENGES_AND_SOLUTIONS.md`** from the actual ledgers/commit history of all three days.
- [ ] **Step 3: Commit**

```bash
git add README.md docs/CHALLENGES_AND_SOLUTIONS.md
git commit -m "docs: README update and Challenges and Solutions writeup"
```

---

### Task 9: Full manual verification pass

**Files:** none (verification only).

- [ ] **Step 1: Run the full backend suite and `npm run build`.**
Expected: both clean.
- [ ] **Step 2: Walk the full lifecycle end-to-end against the real backend** — upload → validate → match → approve → request payment → see it reflected on the dashboard and in reports — at least once, with real demo data.
- [ ] **Step 3: Commit** only if fixes were needed during this pass.
