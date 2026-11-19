# Frontend Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bare default-shadcn frontend with the "ledger register" visual identity from the approved design doc, and give every page a systematic, typed error-handling layer (distinct 401/403/400/404/network/500 treatment, toasts, loading skeletons, empty states, double-submit guards, an app-wide crash boundary) instead of today's uniform `catch { setError('generic message') }`.

**Architecture:** A token-based design system in `index.css` (light + dark, per the design doc) feeds a small set of shared primitives (`Table`, `Badge`, `Button`, `Input`, `Toast`, `Banner`, `EmptyState`, `Skeleton`, `ErrorBoundary`). A new `ApiError` class in `lib/api.ts` classifies every failed request once, at the fetch layer, so every page branches on `error.kind` instead of re-guessing what went wrong. Pages are rebuilt on top of these primitives in the same order they were originally built (Login → Invoices → Vendors/POs → Approvals/Notifications).

**Tech Stack:** Existing stack only — React 19 + TypeScript + Tailwind CSS v4 (CSS-first config, no `tailwind.config.js`) + `lucide-react` (already a dependency, unused so far) for icons. No new dependencies — consistent with DECISIONS.md #9's reasoning against a heavy UI runtime.

**Spec:** `docs/superpowers/specs/2026-11-19-frontend-redesign-design.md` (approved design doc — color/type/layout tokens, error-handling treatment table).

## Global Constraints

- No backend/API changes — this plan touches `frontend/` only.
- No new npm dependencies.
- Both light and dark themes must work (tokens defined in both `prefers-color-scheme: dark` and `[data-theme="dark"]`, per the design doc).
- Every currency/ID column uses `font-variant-numeric: tabular-nums` (already specified in the design doc).
- No frontend automated test suite exists or is being added (per DECISIONS.md #10) — each task's verification is `npm run build` (type-check) plus a manual check against the real running backend, same pattern as Day 2 Tasks 8–9.
- Keep existing routes, existing role-based page visibility (none — Day 2's Task 8 ruling already established that nav links are shown to all authenticated users, server-enforced), and existing API functions in `lib/api.ts` — this plan changes how errors from them are classified and rendered, not what they call.

## Review Focus

- A component that reads `localStorage`/JWT and throws during render (e.g. a malformed token) should be caught by the error boundary, not produce a blank white page.
- Submitting a form twice quickly (double-click, or slow network) must not fire two requests — every submit button needs a real in-flight guard, not just a visual disabled state that re-enables too early.
- A 403 from an action the UI itself doesn't prevent (e.g. a non-admin somehow POSTing to vendors) must render the "no permission" treatment, not fall through to the generic/network branch.
- Toast messages must use the action's own vocabulary (the button said "Approve", the toast says "Approved" — never "Success!" or "Done").
- A truly offline/unreachable backend (fetch throws `TypeError`, no response at all) must be distinguished from a reachable backend returning 500 — both exist in the error-handling table as separate rows with separate copy.

---

### Task 1: Design tokens and global styles

**Files:**
- Modify: `frontend/src/index.css`, `frontend/index.html`

**Interfaces:**
- Produces: the full token set from the design doc (`--paper`, `--ink`, `--ledger`, `--approved`, `--pending`, `--exception`, `--hairline`, plus `-soft` background variants of each status color) defined on bare `:root`, redefined under `@media (prefers-color-scheme: dark)` guarded `:root:not([data-theme="light"])`, and again under `:root[data-theme="dark"]`. Public Sans loaded via Google Fonts link tag. `body` sets `font-family`, background/color from tokens, and `font-variant-numeric: tabular-nums` is available as a `.tabular` utility class (Tailwind v4 arbitrary utility or a plain CSS class — implementer's choice).
- Consumes: nothing (foundation task).

- [ ] **Step 1: Replace the token block in `index.css`** with the palette from the design doc (light values on bare `:root`, dark values in both guarded blocks as the page-contract pattern requires). Keep the existing shadcn token *names* that other code already references (`--background`, `--foreground`, `--primary`, `--destructive`, `--border`, etc.) but point them at the new palette's values instead of the old grayscale ones, so existing component code doesn't need to change in this task.
- [ ] **Step 2: Add the Google Fonts `<link>` for Public Sans** (weights 400/500/600/700) to `index.html`, and set `--font-sans` (or equivalent) to `"Public Sans", -apple-system, "Segoe UI", sans-serif` in `index.css`, applied to `body`.
- [ ] **Step 3: Update `index.html`'s `<title>`** from the generic "frontend" to "AP Automation".
- [ ] **Step 4: Run `npm run build`** to verify the CSS and HTML changes don't break the type-check/build.
Expected: build succeeds.
- [ ] **Step 5: Manual check** — run `npm run dev`, confirm the login page (still using old markup) now renders in the new palette and font, in both light and dark (toggle OS theme or devtools emulation).
Expected: background/text/accent colors visibly changed; no layout breakage.
- [ ] **Step 6: Commit**

```bash
git add frontend/src/index.css frontend/index.html
git commit -m "feat: ledger design-system tokens and Public Sans typography"
```

---

### Task 2: Typed API error classification

**Files:**
- Modify: `frontend/src/lib/api.ts`

**Interfaces:**
- Produces: `export class ApiError extends Error { kind: 'unauthorized' | 'forbidden' | 'not_found' | 'validation' | 'conflict' | 'network' | 'server'; fieldErrors?: Record<string, string>; }`. A new `classifyAndThrow(resp: Response): Promise<never>` helper that reads the response body once, builds the right `ApiError` for the status code (401→`unauthorized`, 403→`forbidden`, 404→`not_found`, 400→`validation` with `fieldErrors` populated from the DRF error body's per-field keys, 409→`conflict`, 5xx→`server`), and throws it. `authedFetch`/`handleJsonResponse` (and the standalone `login`/`uploadInvoice` functions that don't currently go through `handleJsonResponse`) call `classifyAndThrow` on any non-ok response instead of building an ad hoc message. A `fetch` that throws (network down, DNS failure, CORS) is caught at the same call sites and re-thrown as `new ApiError('network', "Can't reach AP Automation right now. Check your connection and try again.")`.
- Consumes: nothing new — wraps the existing `fetch`/`authedFetch` plumbing already in this file.

- [ ] **Step 1: Write `ApiError` and `classifyAndThrow`** as described above. Validation messages: join the first error of each field into `fieldErrors`; also set `.message` to the first field's first error (or `detail` when present) so code that doesn't care about per-field detail still gets a sensible single message.
- [ ] **Step 2: Route every existing API function** (`login`, `listInvoices`, `uploadInvoice`, `listVendors`, `createVendor`, `listPurchaseOrders`, `importPurchaseOrdersCsv`, `listGrns`, `importGrnsCsv`, `listMyApprovals`, `decideApprovalStep`, `listNotifications`, `markNotificationRead`) through `classifyAndThrow` on failure, replacing the old `errorMessage`/generic-`Error` paths. Remove the now-dead `errorMessage` helper once nothing calls it.
- [ ] **Step 3: Keep the existing 401-refresh-and-retry behavior in `authedFetch`** unchanged — only the final, still-failing case (refresh itself failed, or a non-401 error) goes through `classifyAndThrow`.
- [ ] **Step 4: Run `npm run build`.**
Expected: build succeeds; no remaining references to the deleted `errorMessage` helper.
- [ ] **Step 5: Manual check** — with the backend stopped, call any page's data-loading function in the browser console (or just load a page) and confirm the thrown error's `kind` is `'network'` with the expected message; start the backend back up, log in with a wrong password, confirm `kind === 'unauthorized'`.
Expected: both cases observed in the browser, not just inferred from reading the code.
- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat: classify API failures into a typed ApiError instead of generic messages"
```

---

### Task 3: Shared display primitives — Table, Badge, Button, Input

**Files:**
- Create: `frontend/src/components/ui/table.tsx`
- Modify: `frontend/src/components/ui/badge.tsx`, `frontend/src/components/ui/button.tsx`, `frontend/src/components/ui/input.tsx`

**Interfaces:**
- Produces:
  - `table.tsx`: `Table`, `TableHead`, `TableRow`, `TableCell` (`TableCell` takes an optional `numeric?: boolean` prop that right-aligns and applies `.tabular`), implementing the hairline-row register styling from the design doc (no card/shadow chrome).
  - `Badge({ status })`: a dot-plus-word status indicator (not a filled pill) covering **every** status value currently in use across the app: `uploaded`, `extracted`, `needs_review`, `validated`, `pending_approval`, `approved`, `rejected` (invoice statuses) and `unmatched`, `matched`, `mismatched` (match statuses) — the current component only has 4 of these 10, so this task also fixes that functional gap. Falls back to a neutral dot for any unrecognized value.
  - `Button`: adds a `loading?: boolean` prop — when true, renders a spinner (lucide `Loader2` with a spin animation) before the label, forces `disabled`, and keeps the button's width stable (no layout shift on click).
  - `Input`: adds an `invalid?: boolean` prop that applies the `--exception` border color.
- Consumes: the tokens from Task 1.

- [ ] **Step 1: Build `table.tsx`** with the four components above, styled per the design doc's register look (hairline `border-bottom`, no border-radius/shadow on rows).
- [ ] **Step 2: Rewrite `badge.tsx`'s status map** to cover all 10 status values with dot + label markup, using the semantic color tokens (`--approved`/`--pending`/`--exception`/neutral) rather than the old `bg-*/15` pill fills.
- [ ] **Step 3: Add the `loading` prop to `button.tsx`** and the `invalid` prop to `input.tsx`.
- [ ] **Step 4: Run `npm run build`.**
Expected: build succeeds (no pages consume these yet, so no visual check possible until later tasks — that's fine, this task is the primitives only).
- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ui/table.tsx frontend/src/components/ui/badge.tsx frontend/src/components/ui/button.tsx frontend/src/components/ui/input.tsx
git commit -m "feat: register-style Table primitive, full status Badge map, loading Button, invalid Input"
```

---

### Task 4: Feedback primitives — Toast, Banner, EmptyState, Skeleton, ErrorBoundary

**Files:**
- Create: `frontend/src/components/ui/toast.tsx`, `frontend/src/components/ui/banner.tsx`, `frontend/src/components/ui/empty-state.tsx`, `frontend/src/components/ui/skeleton.tsx`, `frontend/src/components/ErrorBoundary.tsx`

**Interfaces:**
- Produces:
  - `toast.tsx`: `ToastProvider` (React context + a fixed-position stack, bottom-right, matching the mockup), `useToast()` returning `{ show(opts: { title: string; description?: string; variant?: 'success' | 'error' }) }`. Each toast auto-dismisses after ~5s and is also manually dismissible.
  - `banner.tsx`: `Banner({ variant: 'error' | 'warning', title, children, action? })` — the retry/no-permission/exceptions banners from the mockup.
  - `empty-state.tsx`: `EmptyState({ title, children })`.
  - `skeleton.tsx`: `SkeletonRow({ columns: number })` rendering the shimmering placeholder cells from the mockup, for use inside a `Table` while data loads.
  - `ErrorBoundary.tsx`: a class component (React error boundaries require a class) implementing `componentDidCatch`, rendering the "Something went wrong loading this page" recovery panel from the mockup with a "Reload page" button (`window.location.reload()`).
- Consumes: tokens from Task 1; `Button` from Task 3 for the banner/error-boundary actions.

- [ ] **Step 1: Build `ToastProvider`/`useToast`/the toast stack UI.**
- [ ] **Step 2: Build `Banner`, `EmptyState`, `SkeletonRow`.**
- [ ] **Step 3: Build `ErrorBoundary`** as a class component with `getDerivedStateFromError`/`componentDidCatch`, logging the caught error to `console.error` (no backend error-reporting exists to send it to — logging is the honest baseline) and rendering the recovery panel instead of children when it has caught an error.
- [ ] **Step 4: Run `npm run build`.**
Expected: build succeeds.
- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ui/toast.tsx frontend/src/components/ui/banner.tsx frontend/src/components/ui/empty-state.tsx frontend/src/components/ui/skeleton.tsx frontend/src/components/ErrorBoundary.tsx
git commit -m "feat: toast, banner, empty-state, skeleton, and error-boundary primitives"
```

---

### Task 5: App shell — ledger layout, nav, providers

**Files:**
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `ErrorBoundary`, `ToastProvider` (Task 4).
- Produces: the shell structure from the mockup (fixed left "spine" border, left-aligned nav) wraps every route; `ErrorBoundary` wraps the whole `<Router>` tree so a crash anywhere still shows the recovery panel and keeps the nav/shell visible around it is not required — wrapping the full app is sufficient and simpler.

- [ ] **Step 1: Restructure `App.tsx`'s JSX** to the shell layout (left spine border, wordmark, nav) instead of the current plain `<nav>` row, keeping all existing `<Route>` elements and `RequireAuth` logic unchanged.
- [ ] **Step 2: Wrap the top-level return in `<ErrorBoundary>` and `<ToastProvider>`** (ErrorBoundary outermost, so a provider failure is also caught).
- [ ] **Step 3: Run `npm run build`.**
Expected: build succeeds.
- [ ] **Step 4: Manual check** — `npm run dev`, confirm the shell/nav renders correctly at desktop and phone widths (resize or devtools device mode) and that navigating between routes still works.
Expected: no horizontal scroll at ~400px width; nav still navigates.
- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: ledger-spine app shell with error boundary and toast provider"
```

---

### Task 6: Login page rebuild

**Files:**
- Modify: `frontend/src/pages/LoginPage.tsx`

**Interfaces:**
- Consumes: `Input` (invalid state), `Button` (loading state) from Task 3; `ApiError` from Task 2.
- Produces: same route/behavior, new look and error handling.

- [ ] **Step 1: Rebuild the page markup** per the mockup (wordmark, title, email/password fields, submit button) using the restyled `Input`/`Button`.
- [ ] **Step 2: Replace the generic `catch` block** with one that branches on `error instanceof ApiError ? error.kind : 'network'`: `unauthorized` → "That email and password don't match. Check for typos, or reset your password."; `network` → the can't-reach-server message; anything else → a generic-but-honest fallback ("Something went wrong signing you in. Try again.").
- [ ] **Step 3: Add a `submitting` state** that disables the form and shows the `Button`'s `loading` state for the duration of the request, preventing double-submit.
- [ ] **Step 4: Run `npm run build`.**
Expected: build succeeds.
- [ ] **Step 5: Manual check** — try a wrong password (see the specific message), stop the backend and try again (see the network message), then log in successfully.
Expected: three distinct, correct outcomes observed live.
- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/LoginPage.tsx
git commit -m "feat: rebuild login page with typed error messages and submit guard"
```

---

### Task 7: Invoices page rebuild

**Files:**
- Modify: `frontend/src/pages/UploadPage.tsx`

**Interfaces:**
- Consumes: `Table`/`TableHead`/`TableRow`/`TableCell`, `Badge` (Task 3); `Banner`, `EmptyState`, `SkeletonRow` (Task 4); `useToast` (Task 4); `ApiError` (Task 2).
- Produces: same route/data, rebuilt presentation.

- [ ] **Step 1: Replace the plain `<table>`** with the `Table` primitives; render `invoice.match_status` alongside `invoice.status` using `Badge` for both (two badges per row, as the data model has two independent status fields).
- [ ] **Step 2: Add a loading state** — `SkeletonRow`s while the initial `listInvoices()` call is in flight, an `EmptyState` ("No invoices yet — upload one to get started") when it resolves to zero rows.
- [ ] **Step 3: Add a `Banner`** above the table when any invoice has a non-empty `exceptions` array, summarizing the count, matching the mockup.
- [ ] **Step 4: Wire `useToast`** to show a success toast ("Invoice uploaded") or an error toast on upload failure, branching the error toast's body on `ApiError.kind` (e.g. `validation` → the specific field message; `network`/`server` → the matching copy from Task 2).
- [ ] **Step 5: Guard the upload handler against double-submit** (disable the dropzone/button while `uploading` is true — this already existed; verify it still works with the new markup).
- [ ] **Step 6: Run `npm run build`.**
Expected: build succeeds.
- [ ] **Step 7: Manual check** — upload a valid invoice (success toast, row appears with correct badges), upload an invalid file type (error toast with the real validation message), reload with the backend down (skeleton then... — see note) .
Expected: all three observed. Note: the initial `listInvoices()` failure path should also show a `Banner`, not just swallow the error silently — add this if the current page doesn't yet handle a failed initial load distinctly from "zero invoices".
- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/UploadPage.tsx
git commit -m "feat: rebuild invoices page with register table, badges, and typed error feedback"
```

---

### Task 8: Vendors and Purchase Orders pages rebuild

**Files:**
- Modify: `frontend/src/pages/VendorsPage.tsx`, `frontend/src/pages/PurchaseOrdersPage.tsx`

**Interfaces:**
- Consumes: same primitives as Task 7, plus `Input`'s `invalid` prop for the vendor-creation form's field-level errors.
- Produces: same routes/data, rebuilt presentation.

- [ ] **Step 1: Rebuild `VendorsPage`** — `Table` for the vendor list, `EmptyState`/`SkeletonRow` for loading/empty, the create-vendor form using `Input`'s `invalid` prop + per-field messages from `ApiError.fieldErrors` (e.g. a duplicate GSTIN shows under the GSTIN field, not as one paragraph), `useToast` on create success/failure, submit-guard on the form.
- [ ] **Step 2: Rebuild `PurchaseOrdersPage`** — `Table` for both PO and GRN lists, `EmptyState`/`SkeletonRow`, CSV import results rendered as a `Banner` (success count + per-row errors) instead of the current plain text summary, `useToast` confirming the import, submit-guard on both import buttons independently (importing POs shouldn't block the GRN import button and vice versa).
- [ ] **Step 3: Run `npm run build`.**
Expected: build succeeds.
- [ ] **Step 4: Manual check** — as `ap_admin`, create a vendor with a duplicate GSTIN (see the field-level error), import a CSV with one bad row (see the banner's per-row breakdown), as `requester` attempt the same actions and confirm the 403 path reads as "no permission," not a generic failure.
Expected: all three observed live.
- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/VendorsPage.tsx frontend/src/pages/PurchaseOrdersPage.tsx
git commit -m "feat: rebuild vendors and purchase orders pages with field-level errors and import banners"
```

---

### Task 9: Approvals page and notification bell rebuild

**Files:**
- Modify: `frontend/src/pages/ApprovalsPage.tsx`, `frontend/src/components/NotificationBell.tsx`

**Interfaces:**
- Consumes: same primitives as Task 7/8.
- Produces: same routes/data, rebuilt presentation.

- [ ] **Step 1: Rebuild `ApprovalsPage`** per the mockup — the invoice summary card layout (already added in Day 2's fix pass) restyled with the new tokens, `EmptyState` ("That's everything for now") when there are no pending steps, `useToast` on decide success, and the **409 (`conflict`) case rendered as a distinct toast** ("Someone else already approved this step. Refresh to see the current status.") instead of the current generic error — this directly fixes the Day 2 final-review Minor #17 (a 409 restoring the already-acted-on row): on `conflict`, the row stays removed and the toast explains why, rather than putting the row back.
- [ ] **Step 2: Restyle `NotificationBell`** to the new tokens (bell icon via `lucide-react`'s `Bell`, unread count badge using `--exception`), keep its existing polling behavior, and surface a failed poll via the bell's own UI once (not every 30s) rather than silently swallowing it forever.
- [ ] **Step 3: Run `npm run build`.**
Expected: build succeeds.
- [ ] **Step 4: Manual check** — approve a pending step (success toast, row disappears), then (as a second browser session or via `curl`) attempt to decide the same already-decided step and confirm the specific conflict copy appears, not a generic error.
Expected: both observed live.
- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/ApprovalsPage.tsx frontend/src/components/NotificationBell.tsx
git commit -m "feat: rebuild approvals page and notification bell, fix 409 toast/row-removal mismatch"
```

---

### Task 10: Full manual verification pass

**Files:** none (verification only).

- [ ] **Step 1: `npm run build`** for the whole app one more time.
Expected: clean build.
- [ ] **Step 2: Start both dev servers** and walk every page in both light and dark mode: Login, Invoices, Vendors, Purchase Orders, Approvals, the notification bell.
- [ ] **Step 3: Deliberately trigger each error-handling row from the design doc's table** at least once against the real backend: 401 (let a token expire or log out mid-session), 403 (wrong-role action), 400/validation (bad form input), 404/empty (fresh data with nothing in it), network/500 (stop the backend mid-session), a forced render error (temporarily throw in a component to confirm the `ErrorBoundary` catches it, then revert that throw — this is a verification-only change, never committed).
Expected: each produces the specific, distinct treatment from the design doc — not a shared fallback.
- [ ] **Step 4: Commit** (only if any small fixes were needed during this pass; otherwise this task produces no commit, just a clean bill of health reported to the human partner).
