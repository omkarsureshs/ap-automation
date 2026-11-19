# Day 2: Vendor Management, PO/GRN Matching, Approval Workflow, Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add vendor master management (encrypted bank details), an internal PO/GRN module with CSV bulk import, 2-way/3-way invoice matching, a configurable approval workflow with escalation, and dual-channel (in-app + email) notifications — the full Day 2 slice from `docs/DECISIONS.md` and the design doc.

**Architecture:** Three new Django apps (`vendors`, `procurement`, `workflow`), each following the existing `accounts`/`invoices` pattern (models → serializers → views → urls, `HasRole` for permissions, pytest-django for tests). `Invoice` gains a nullable `purchase_order` FK and match-result fields. Matching and approval are pure functions/services called from view actions, mirroring how `invoices/validation.py` is called from `perform_create` today — same separation of "data layer" from "decision layer."

**Tech Stack:** Django 5 + DRF (existing), `cryptography` (Fernet) for field-level encryption, Python `csv` stdlib for bulk import (no new dependency), Django's `django.core.mail` for notification email (console backend in dev), a custom `manage.py` command for escalation (run manually/via cron, no Celery). React 18 + TS + existing component library for new pages.

**Spec:** `docs/superpowers/specs/2026-11-18-ap-automation-design.md` (Architecture section: vendor bank details, PO/GRN matching, approval workflow, invoice capture/notifications), with reasoning in `docs/DECISIONS.md` (#5 PO/GRN source, #13 notifications, #14 encryption, #15 build sequence/Day 2 scope, #128-equivalent escalation-configurable note in the design doc's "What's left to the builder").

## Global Constraints

- Mandatory stack unchanged: Django + DRF + PostgreSQL backend, React+TS frontend (per design doc Constraints).
- Vendor bank account number is encrypted at the field level in Postgres and returned masked (last 4 digits only) in API responses to every role except `ap_admin` (DECISIONS.md #14).
- No real bank/ERP integration — PO/GRN data is sourced from an internal CRUD+CSV-import module, not an external system (DECISIONS.md #5).
- Escalation timing is admin-configurable per approval rule, never hardcoded as a constant (design doc "What's left to the builder").
- Notifications go out on both channels — DB-backed in-app notification and real SMTP-capable email via Django's email backend — for the same event, not one or the other (DECISIONS.md #13).
- No paid APIs / no external credentials required at demo time (design doc Constraints) — email defaults to Django's console backend in dev, SMTP only if env vars are set.
- Follow existing patterns: `HasRole(*roles)` for permission checks, pytest-django + DRF `APIClient` for tests, TDD RED→GREEN→commit per task.

## Review Focus

- CSV import with malformed rows (missing column, non-numeric amount, duplicate PO number) — should report per-row errors and import the valid rows, not crash or silently drop the whole file.
- Invoice amount that matches its PO within a small rounding difference (e.g. paise/rupee rounding) — should still match, not get flagged as a mismatch over a fraction of a rupee.
- An approval step whose approver role has zero active users — escalation/assignment should produce a visible exception, not silently stall forever with no one able to act.
- A vendor marked inactive — new invoices from/for that vendor should be flagged, not pass validation as if the vendor were in good standing.
- Concurrent approve+reject on the same approval step (double-submit from two tabs, or the same action twice) — the second action should be rejected as already-decided, not double-process or corrupt state.

---

### Task 1: Vendor model with encrypted bank details + CRUD API

**Files:**
- Create: `backend/vendors/__init__.py`, `backend/vendors/apps.py`, `backend/vendors/models.py`, `backend/vendors/fields.py`, `backend/vendors/serializers.py`, `backend/vendors/views.py`, `backend/vendors/urls.py`, `backend/vendors/migrations/`
- Create: `backend/vendors/tests/__init__.py`, `backend/vendors/tests/test_vendor_crud.py`, `backend/vendors/tests/test_encrypted_field.py`
- Modify: `backend/apconfig/settings.py` (add `"vendors"` to `INSTALLED_APPS`, `FIELD_ENCRYPTION_KEY` env var), `backend/apconfig/urls.py` (mount `vendors.urls` at `/api/vendors/`), `backend/requirements.txt` (add `cryptography`)

**Interfaces:**
- Produces: `vendors.models.Vendor(name, gstin, email, bank_account_number, bank_ifsc, is_active, created_at)`; `vendors.fields.EncryptedCharField(models.CharField)` — transparently encrypts on write, decrypts on read via Fernet; `VendorSerializer` with `bank_account_number` masked to `"****1234"` (last 4 digits) unless `request.user.role == "ap_admin"`; `GET/POST /api/vendors/`, `GET/PATCH /api/vendors/<id>/`.
- Consumes: `accounts.permissions.HasRole` (existing).

- [ ] **Step 1: Write the failing test for the encrypted field round-trip**

```python
def test_encrypted_field_stores_ciphertext_and_returns_plaintext(db):
    vendor = Vendor.objects.create(name="Acme", gstin="27AAAAA0000A1Z5", email="a@acme.test",
                                    bank_account_number="1234567890", bank_ifsc="HDFC0001234")
    raw = Vendor.objects.raw("SELECT bank_account_number FROM vendors_vendor WHERE id = %s", [vendor.id])[0]
    assert raw.bank_account_number != "1234567890"
    assert Vendor.objects.get(pk=vendor.pk).bank_account_number == "1234567890"
```

- [ ] **Step 2: Run test to verify it fails** — `pytest backend/vendors/tests/test_encrypted_field.py -v`, expected FAIL (app/model don't exist).

- [ ] **Step 3: Implement `EncryptedCharField`, `Vendor` model, migration**

`EncryptedCharField` wraps a `Fernet(settings.FIELD_ENCRYPTION_KEY.encode())` instance; `get_prep_value` encrypts, `from_db_value`/`to_python` decrypt (return plaintext unchanged if already plaintext, to tolerate `None`). `FIELD_ENCRYPTION_KEY` defaults to a fixed dev key via `os.environ.get(...)` so a fresh clone works without extra setup, documented as override-in-prod in README (same pattern as `DJANGO_SECRET_KEY`).

- [ ] **Step 4: Run test to verify it passes.**

- [ ] **Step 5: Write failing tests for CRUD + masking**

```python
def test_ap_admin_sees_full_bank_account_number(auth_client_ap_admin, vendor): ...
def test_requester_sees_masked_bank_account_number(auth_client_requester, vendor): ...
def test_requester_cannot_create_vendor(auth_client_requester): ...
def test_ap_admin_can_create_vendor(auth_client_ap_admin): ...
```

(Add an `auth_client_ap_admin` fixture to `backend/conftest.py`, mirroring the existing `auth_client_requester`/`auth_client_vendor` fixtures.)

- [ ] **Step 6: Run tests to verify they fail.**

- [ ] **Step 7: Implement `VendorSerializer`, `VendorViewSet` (`ModelViewSet`, `HasRole("ap_admin")` for write, `IsAuthenticated` for read), `urls.py`**

- [ ] **Step 8: Run tests to verify they pass.**

- [ ] **Step 9: Commit**

```bash
git add backend/vendors backend/apconfig/settings.py backend/apconfig/urls.py backend/requirements.txt backend/conftest.py
git commit -m "feat: vendor master with field-level encrypted bank details"
```

---

### Task 2: Wire vendor master into the validation engine

**Files:**
- Modify: `backend/invoices/validation.py`, `backend/invoices/tests/test_validation.py`

**Interfaces:**
- Consumes: `vendors.models.Vendor` (Task 1).
- Produces: `validate_invoice` now also returns `"Vendor not found in master"` or `"Vendor is inactive"` reasons; no signature change.

- [ ] **Step 1: Write failing tests**

```python
def test_validate_invoice_flags_vendor_not_in_master(db, invoice_with_all_fields): ...
def test_validate_invoice_flags_inactive_vendor(db, invoice_with_all_fields, inactive_vendor): ...
def test_validate_invoice_passes_for_active_known_vendor(db, invoice_with_all_fields, active_vendor): ...
```

- [ ] **Step 2: Run to verify fail.**

- [ ] **Step 3: Implement** — after the existing GSTIN check, look up `Vendor.objects.filter(gstin=invoice.extracted_gstin).first()`; append the two new reasons as applicable. Matching is by GSTIN (the one field both Invoice and Vendor already carry and validate), not by name (OCR'd names are unreliable for exact lookup).

- [ ] **Step 4: Run to verify pass.**

- [ ] **Step 5: Commit**

```bash
git add backend/invoices/validation.py backend/invoices/tests/test_validation.py
git commit -m "feat: cross-check invoices against vendor master in validation engine"
```

---

### Task 3: PurchaseOrder + GoodsReceiptNote models, CRUD, CSV bulk import

**Files:**
- Create: `backend/procurement/__init__.py`, `backend/procurement/apps.py`, `backend/procurement/models.py`, `backend/procurement/csv_import.py`, `backend/procurement/serializers.py`, `backend/procurement/views.py`, `backend/procurement/urls.py`, `backend/procurement/migrations/`
- Create: `backend/procurement/tests/__init__.py`, `backend/procurement/tests/test_po_grn_crud.py`, `backend/procurement/tests/test_csv_import.py`
- Modify: `backend/invoices/models.py` (add `purchase_order` FK + match fields, see Interfaces), `backend/invoices/migrations/` (new migration), `backend/apconfig/settings.py` (`INSTALLED_APPS`), `backend/apconfig/urls.py` (mount at `/api/procurement/`)

**Interfaces:**
- Produces:
  - `procurement.models.PurchaseOrder(po_number [unique], vendor FK→vendors.Vendor, total_amount Decimal, created_at)`
  - `procurement.models.GoodsReceiptNote(grn_number [unique], purchase_order FK, received_amount Decimal, created_at)`
  - `procurement.csv_import.import_purchase_orders_csv(file) -> dict` with keys `created` (int) and `errors` (list of `{"row": int, "message": str}`); same shape for `import_grns_csv(file)`. Expected CSV columns: `po_number,vendor_gstin,total_amount` and `grn_number,po_number,received_amount` respectively.
  - `GET/POST /api/procurement/purchase-orders/`, `POST /api/procurement/purchase-orders/import-csv/` (multipart file field `file`); same two for `/grns/`.
  - `invoices.models.Invoice.purchase_order` — `ForeignKey(procurement.PurchaseOrder, null=True, blank=True, on_delete=models.SET_NULL)`; `Invoice.MATCH_STATUS_CHOICES` + `match_status` CharField default `"unmatched"`.
- Consumes: `vendors.models.Vendor` (Task 1).

- [ ] **Step 1: Write failing tests for PO/GRN CRUD**

```python
def test_ap_admin_can_create_purchase_order(auth_client_ap_admin, vendor): ...
def test_requester_cannot_create_purchase_order(auth_client_requester): ...
def test_grn_requires_existing_purchase_order(auth_client_ap_admin): ...
```

- [ ] **Step 2: Run to verify fail.**

- [ ] **Step 3: Implement models, migration (including the `Invoice.purchase_order`/`match_status` migration), serializers, `ModelViewSet`s (`HasRole("ap_admin")` write, `IsAuthenticated` read), urls.**

- [ ] **Step 4: Run to verify pass.**

- [ ] **Step 5: Write failing tests for CSV import**

```python
def test_import_purchase_orders_csv_creates_rows_and_reports_errors(db, vendor, tmp_csv_with_one_bad_row): ...
def test_import_purchase_orders_csv_rejects_duplicate_po_number(db, vendor, tmp_csv): ...
def test_import_grns_csv_rejects_unknown_po_number(db, tmp_csv): ...
```

- [ ] **Step 6: Run to verify fail.**

- [ ] **Step 7: Implement `import_purchase_orders_csv`/`import_grns_csv`** using stdlib `csv.DictReader`; validate each row (amount parses as positive `Decimal`, vendor/PO lookup succeeds, PO/GRN number not already taken) independently, collecting per-row errors instead of raising, and bulk-create only the valid rows — this is the Review Focus item on malformed CSV rows. Wire the two import endpoints to call these functions and return their dict as the JSON response.

- [ ] **Step 8: Run to verify pass.**

- [ ] **Step 9: Commit**

```bash
git add backend/procurement backend/invoices/models.py backend/invoices/migrations backend/apconfig/settings.py backend/apconfig/urls.py
git commit -m "feat: PO/GRN CRUD and CSV bulk import, link invoices to purchase orders"
```

---

### Task 4: Matching engine (2-way / 3-way)

**Files:**
- Create: `backend/procurement/matching.py`, `backend/procurement/tests/test_matching.py`
- Modify: `backend/invoices/views.py` (call matching after validation in `perform_create`), `backend/invoices/serializers.py` (accept optional `purchase_order` id on upload)

**Interfaces:**
- Produces: `procurement.matching.match_invoice(invoice: Invoice) -> list[str]` — pure function, same shape as `validate_invoice`: returns a list of human-readable mismatch reasons (empty list = matched). Sets no state itself; caller sets `invoice.match_status` from the result, mirroring how `perform_create` already turns `validate_invoice`'s reasons into `InvoiceException` rows.
- Consumes: `invoices.models.Invoice` (now with `purchase_order`), `procurement.models.PurchaseOrder`, `GoodsReceiptNote` (Task 3).

- [ ] **Step 1: Write failing tests**

```python
AMOUNT_TOLERANCE_PERCENT = 1  # documented constant, not hidden magic number

def test_match_invoice_2way_passes_within_tolerance(db, po, invoice_linked_to_po): ...
def test_match_invoice_2way_flags_amount_mismatch_beyond_tolerance(db, po, invoice_linked_to_po): ...
def test_match_invoice_3way_passes_when_po_grn_invoice_amounts_align(db, po, grn, invoice_linked_to_po): ...
def test_match_invoice_3way_flags_grn_invoice_mismatch(db, po, grn, invoice_linked_to_po): ...
def test_match_invoice_with_no_purchase_order_returns_unmatched_reason(db, invoice_without_po): ...
```

- [ ] **Step 2: Run to verify fail.**

- [ ] **Step 3: Implement `match_invoice`** — if no `purchase_order`, return `["No purchase order linked — cannot match"]`. Else compare `invoice.extracted_total_amount` to `purchase_order.total_amount` within `AMOUNT_TOLERANCE_PERCENT` (2-way). If a `GoodsReceiptNote` exists for that PO, additionally compare `grn.received_amount` to both PO and invoice amounts (3-way) — this is the Review Focus item on rounding tolerance, satisfied by the percentage tolerance rather than exact equality.

- [ ] **Step 4: Run to verify pass.**

- [ ] **Step 5: Wire into `InvoiceUploadView.perform_create`** — after `validate_invoice` and only when its reasons list is empty (don't match an invoice that's already `needs_review`), call `match_invoice`; on non-empty result, create `InvoiceException` rows for each reason and set `match_status = "mismatched"`, else `match_status = "matched"`.

- [ ] **Step 6: Run the full `invoices` + `procurement` test suites to verify nothing regressed.**

- [ ] **Step 7: Commit**

```bash
git add backend/procurement/matching.py backend/procurement/tests/test_matching.py backend/invoices/views.py backend/invoices/serializers.py
git commit -m "feat: 2-way/3-way PO/GRN/invoice matching engine"
```

---

### Task 5: Approval workflow — matrix, steps, approve/reject

**Files:**
- Create: `backend/workflow/__init__.py`, `backend/workflow/apps.py`, `backend/workflow/models.py`, `backend/workflow/services.py`, `backend/workflow/serializers.py`, `backend/workflow/views.py`, `backend/workflow/urls.py`, `backend/workflow/migrations/`
- Create: `backend/workflow/tests/__init__.py`, `backend/workflow/tests/test_approval_matrix.py`, `backend/workflow/tests/test_approval_actions.py`
- Modify: `backend/invoices/views.py` (call `start_approval` once an invoice is `matched`), `backend/apconfig/settings.py` (`INSTALLED_APPS`), `backend/apconfig/urls.py` (mount at `/api/workflow/`)

**Interfaces:**
- Produces:
  - `workflow.models.ApprovalRule(min_amount, max_amount, approver_roles [JSONField list, ordered], escalation_hours [PositiveIntegerField], is_active)` — the admin-configurable matrix: the first rule whose `[min_amount, max_amount)` contains the invoice amount applies.
  - `workflow.models.ApprovalStep(invoice FK, rule FK, sequence_order, approver_role, status ["pending","approved","rejected","escalated"], assigned_at, decided_at, decided_by FK→User null)`.
  - `workflow.services.start_approval(invoice) -> list[ApprovalStep]` — looks up the matching `ApprovalRule` by `invoice.extracted_total_amount`, creates one `ApprovalStep` per role in `approver_roles` (parallel: all created with `status="pending"` at once, not sequential gating — matches design doc's "parallel approvals").
  - `workflow.services.decide_step(step: ApprovalStep, user: User, approve: bool) -> ApprovalStep` — raises `workflow.services.AlreadyDecidedError` if `step.status != "pending"` (Review Focus: double-submit). On reject, also sets `step.invoice.status = "rejected"`. On approve, if every step for that invoice is now `"approved"`, sets `step.invoice.status = "approved"`; otherwise leaves it `"pending_approval"` (parallel approvals: last one to approve finalizes it).
  - `GET /api/workflow/approvals/?mine=true` (steps where `request.user.role == step.approver_role` and `status="pending"`), `POST /api/workflow/approvals/<id>/decide/` with body `{"approve": true|false}`.
- Consumes: `invoices.models.Invoice`, `accounts.models.User` roles.

- [ ] **Step 1: Write failing tests for the matrix**

```python
def test_start_approval_creates_one_step_per_configured_role(db, approval_rule_single_approver, invoice): ...
def test_start_approval_creates_parallel_steps_for_multi_role_rule(db, approval_rule_two_approvers, invoice): ...
def test_start_approval_with_no_matching_rule_raises(db, invoice_with_amount_outside_any_rule): ...
```

- [ ] **Step 2: Run to verify fail.**

- [ ] **Step 3: Implement `ApprovalRule`, `ApprovalStep` models + migration, `start_approval`.**

- [ ] **Step 4: Run to verify pass.**

- [ ] **Step 5: Write failing tests for decide/double-submit**

```python
def test_approver_can_approve_own_pending_step(auth_client_approver, pending_step): ...
def test_wrong_role_cannot_decide_step(auth_client_requester, pending_step): ...
def test_deciding_an_already_decided_step_raises_already_decided_error(db, approved_step): ...
def test_invoice_status_becomes_approved_once_every_step_is_approved(db, invoice_with_two_pending_steps): ...
def test_invoice_status_becomes_rejected_when_any_step_is_rejected(db, invoice_with_two_pending_steps): ...
```

- [ ] **Step 6: Run to verify fail.**

- [ ] **Step 7: Implement `decide_step`, `ApprovalStepViewSet`/`decide` action, serializers, urls** — `decide_step` re-fetches the row with `select_for_update()` inside the view's transaction before checking `status`, so two concurrent decisions on the same step serialize instead of racing (Review Focus item).

- [ ] **Step 8: Run to verify pass.**

- [ ] **Step 9: Wire into `invoices/views.py`** — in `perform_create`, after a successful match (`match_status == "matched"`), call `start_approval(invoice)`; set `invoice.status = "pending_approval"` (add `"pending_approval"`, `"approved"`, `"rejected"` to `Invoice.STATUS_CHOICES`).

- [ ] **Step 10: Run full backend test suite to verify no regressions.**

- [ ] **Step 11: Commit**

```bash
git add backend/workflow backend/invoices/views.py backend/invoices/models.py backend/apconfig/settings.py backend/apconfig/urls.py
git commit -m "feat: configurable approval matrix with parallel approval steps"
```

---

### Task 6: Escalation command

**Files:**
- Create: `backend/workflow/management/__init__.py`, `backend/workflow/management/commands/__init__.py`, `backend/workflow/management/commands/escalate_pending_approvals.py`
- Create: `backend/workflow/tests/test_escalation.py`

**Interfaces:**
- Produces: `python manage.py escalate_pending_approvals` — for every `ApprovalStep` with `status="pending"` and `assigned_at` older than its rule's `escalation_hours`, sets `status="escalated"` and creates a new `ApprovalStep` for role `"ap_admin"` (the fallback escalation target) with a fresh `assigned_at`. If no active `ap_admin` user exists, the step is still marked `"escalated"` and the command prints a warning to stderr rather than failing silently (Review Focus item on a role with zero active users).
- Consumes: `workflow.models.ApprovalStep`, `ApprovalRule` (Task 5).

- [ ] **Step 1: Write failing tests**

```python
def test_escalate_marks_overdue_pending_step_escalated_and_creates_ap_admin_step(db, overdue_pending_step): ...
def test_escalate_leaves_fresh_pending_step_untouched(db, fresh_pending_step): ...
def test_escalate_warns_when_no_active_ap_admin_exists(db, overdue_pending_step, capsys): ...
```

- [ ] **Step 2: Run to verify fail.**

- [ ] **Step 3: Implement the command** using `timezone.now() - step.assigned_at > timedelta(hours=step.rule.escalation_hours)`.

- [ ] **Step 4: Run to verify pass.**

- [ ] **Step 5: Commit**

```bash
git add backend/workflow/management backend/workflow/tests/test_escalation.py
git commit -m "feat: escalate_pending_approvals management command"
```

---

### Task 7: Notifications (in-app + email)

**Files:**
- Create: `backend/workflow/notifications.py` (added to existing `workflow` app), `backend/workflow/tests/test_notifications.py`
- Modify: `backend/workflow/models.py` (add `Notification`), `backend/workflow/migrations/`, `backend/workflow/services.py` (call `notify` from `start_approval`), `backend/workflow/management/commands/escalate_pending_approvals.py` (call `notify` on escalation), `backend/workflow/views.py`/`urls.py` (notification list/mark-read endpoints), `backend/apconfig/settings.py` (`EMAIL_BACKEND`, `DEFAULT_FROM_EMAIL`, SMTP env vars)

**Interfaces:**
- Produces: `workflow.models.Notification(recipient FK→User, message, is_read [default False], created_at)`; `workflow.notifications.notify(user: User, message: str) -> Notification` — creates the `Notification` row and calls `django.core.mail.send_mail` to `user.email` with the same message (both channels, same call, per DECISIONS.md #13). `GET /api/workflow/notifications/?unread=true`, `POST /api/workflow/notifications/<id>/mark-read/`.
- Consumes: `workflow.models.ApprovalStep` (Task 5/6).

- [ ] **Step 1: Write failing tests**

```python
def test_notify_creates_notification_and_sends_email(db, mailoutbox, user): ...
def test_start_approval_notifies_each_assigned_approver(db, mailoutbox, approval_rule_two_approvers, invoice): ...
def test_escalation_notifies_the_ap_admin(db, mailoutbox, overdue_pending_step): ...
def test_mark_read_only_affects_own_notification(auth_client_requester, other_users_notification): ...
```

(`mailoutbox` is pytest-django's built-in fixture backed by Django's `locmem` email backend in tests.)

- [ ] **Step 2: Run to verify fail.**

- [ ] **Step 3: Implement `Notification` model + migration, `notify()`, wire into `start_approval` (one notification per step's approver — look up users with that role) and into the escalation command.** Set `EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"` by default in settings, overridable to SMTP via `EMAIL_HOST`/`EMAIL_PORT`/`EMAIL_HOST_USER`/`EMAIL_HOST_PASSWORD`/`EMAIL_USE_TLS` env vars (unset = console backend, satisfying the "no external credentials required at demo time" constraint).

- [ ] **Step 4: Run to verify pass.**

- [ ] **Step 5: Implement `NotificationViewSet` (list own, filtered by `recipient=request.user`; `mark-read` action), urls.**

- [ ] **Step 6: Run full backend suite.**

- [ ] **Step 7: Commit**

```bash
git add backend/workflow backend/apconfig/settings.py
git commit -m "feat: in-app + email notifications for approval assignment and escalation"
```

---

### Task 8: Frontend — Vendors and Purchase Orders/GRNs

**Files:**
- Create: `frontend/src/pages/VendorsPage.tsx`, `frontend/src/pages/PurchaseOrdersPage.tsx`
- Modify: `frontend/src/lib/api.ts` (add `listVendors`, `createVendor`, `listPurchaseOrders`, `importPurchaseOrdersCsv`, `listGrns`, `importGrnsCsv`), `frontend/src/App.tsx` (routes, nav links, gated by role like the existing `RequireAuth` wrapper)

**Interfaces:**
- Consumes: `/api/vendors/`, `/api/procurement/purchase-orders/`, `/api/procurement/purchase-orders/import-csv/`, `/api/procurement/grns/`, `/api/procurement/grns/import-csv/` (Tasks 1 & 3); existing `authedFetch`/`errorMessage` helpers from `frontend/src/lib/api.ts`.
- Produces: routes `/vendors`, `/purchase-orders` visible only to `ap_admin` in the nav (same pattern `App.tsx` already uses for role-gated routes).

- [ ] **Step 1: Add the six API functions to `frontend/src/lib/api.ts`**, following the existing `listInvoices`/`uploadInvoice` signatures (fetch + JSON, CSV import as `FormData` like the existing invoice upload).

- [ ] **Step 2: Build `VendorsPage.tsx`** — table of vendors (masked bank number as returned by the API, no client-side masking logic needed) + a create form (AP Admin only).

- [ ] **Step 3: Build `PurchaseOrdersPage.tsx`** — table of POs/GRNs with a CSV file input per type, posting to the import endpoints and rendering the returned `{created, errors}` summary.

- [ ] **Step 4: Wire routes into `App.tsx`.**

- [ ] **Step 5: Manual verification** — `npm run build` (type-check), then run both dev servers, log in as `ap_admin`, create a vendor, import a small PO CSV, confirm the created/error counts render.
Expected: build succeeds; CSV import shows correct created/error counts in the browser.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/VendorsPage.tsx frontend/src/pages/PurchaseOrdersPage.tsx frontend/src/lib/api.ts frontend/src/App.tsx
git commit -m "feat: vendor and PO/GRN management pages"
```

---

### Task 9: Frontend — Approvals and Notifications

**Files:**
- Create: `frontend/src/pages/ApprovalsPage.tsx`, `frontend/src/components/NotificationBell.tsx`
- Modify: `frontend/src/lib/api.ts` (add `listMyApprovals`, `decideApprovalStep`, `listNotifications`, `markNotificationRead`), `frontend/src/App.tsx` (route `/approvals`, mount `NotificationBell` in the shared layout/header)

**Interfaces:**
- Consumes: `/api/workflow/approvals/?mine=true`, `/api/workflow/approvals/<id>/decide/`, `/api/workflow/notifications/?unread=true`, `/api/workflow/notifications/<id>/mark-read/` (Tasks 5 & 7).
- Produces: `/approvals` route (visible to `approver`/`ap_admin` roles); a bell icon in the app header showing unread notification count, present on every page.

- [ ] **Step 1: Add the four API functions to `frontend/src/lib/api.ts`.**

- [ ] **Step 2: Build `ApprovalsPage.tsx`** — list of the logged-in user's pending `ApprovalStep`s (invoice summary + Approve/Reject buttons), optimistic-removes the row on decide, surfaces `err.message` on a 409/already-decided response rather than silently failing (Review Focus: double-submit surfaced to the user).

- [ ] **Step 3: Build `NotificationBell.tsx`** — polls `listNotifications` on an interval already used nowhere else in the app (simple `setInterval`, e.g. 30s, cleared on unmount), shows unread count, dropdown list, calls `markNotificationRead` on click.

- [ ] **Step 4: Wire into `App.tsx`.**

- [ ] **Step 5: Manual verification** — as an `approver`, see a pending approval created by an earlier upload, approve it, confirm it disappears from the list and the notification bell reflects the resulting state change.
Expected: approve action succeeds and the UI updates without a full page reload.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/ApprovalsPage.tsx frontend/src/components/NotificationBell.tsx frontend/src/lib/api.ts frontend/src/App.tsx
git commit -m "feat: approvals page and notification bell"
```
