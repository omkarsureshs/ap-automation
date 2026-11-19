# Frontend Redesign — Design Doc

**Date:** 2026-11-19
**Context:** The Day 1 + Day 2 frontend works but looks like a bare scaffold — default shadcn/ui grayscale theme, no brand identity, unstyled tables — and its error handling is thin: every page follows `catch { setError('generic message') }`, with no distinction between validation, permission, auth, and server failures, no loading/disabled states during submit, no crash boundary, no toasts, no empty states.

## Intent and why

This is the frontend an interviewer will actually click through. It needs to look like real financial software, not a scaffold, and it needs to fail honestly and specifically everywhere — never one generic red line of text standing in for every kind of error.

## Goals

- A deliberate visual identity applied consistently across all pages, including the Day 3 pages that don't exist yet (dashboards, reports, payments).
- Error handling that distinguishes failure classes and tells the user what happened and what to do next, in the interface's own voice.
- No regression to existing functionality — this is a presentation and resilience layer over the working Day 1/2 backend integration.

## Non-goals

- No backend/API changes.
- No new features beyond what Day 1/2 already built (vendor mgmt, PO/GRN, matching, approvals, notifications).

## Anti-goals

- A generic "AI-generated" look: cream+terracotta, near-black+acid accent, identical shadowed cards everywhere, ALL-CAPS eyebrows, arrow-suffixed buttons.
- Error messages that are vague, apologetic, or identical regardless of what actually failed.

## Approaches considered

1. **Minor polish only** (nicer colors, keep existing structure) — rejected: doesn't fix the structural problem (plain unstyled tables, no error taxonomy).
2. **Full design system + systematic error handling** (chosen) — a token-based visual identity applied via a small set of shared components (Table, Toast, Banner, EmptyState, Skeleton, ErrorBoundary), plus a typed error-classification layer in the API client so every page handles 401/403/404/validation/network/500 distinctly.
3. **Adopt a full external UI kit** (MUI, Ant Design) — rejected: contradicts DECISIONS.md #9's reasoning (shadcn's copy-in components were chosen specifically to avoid a heavy runtime dependency and the "obviously-default" look of a kit).

Chosen: **Approach 2**.

## Visual direction (approved via a clickable preview, since deleted per request)

**Grounding:** GST-compliant Accounts Payable software for Indian finance teams. The identity comes from the subject's own world — ledgers, invoice numbers, GSTINs, rupee amounts — not generic SaaS or generic fintech-bright.

**Color tokens:**
- `--paper: #F6F6F3` — cool off-white background (light mode)
- `--ink: #1B2430` — primary text, a deliberate blue-cast near-black
- `--ledger: #1F3A5F` — the one confident accent; deep letterhead-blue
- `--approved: #1E6B4F`, `--pending: #A86A1A`, `--exception: #B3402F` — reserved strictly for status meaning, never decorative
- `--hairline: #D9D9D3` — row/section dividers
- Full dark-mode equivalents defined alongside (dark paper `#14181D`, lightened ledger-blue `#7CA0CC`, etc.)

**Type:** Public Sans (Google Fonts) throughout — one family, built for government/official digital services, fits GST-compliance software. Tabular (lining) figures on money, invoice numbers, and GSTINs so columns of digits align.

**Layout:** Left-aligned. A fixed left "spine" rule anchors every page like a bound ledger. The hero of every screen is a real data table — hairline row dividers, right-aligned currency columns, status shown as a small colored dot + word, not a shadowed pill. No cards-with-shadows chrome.

**Principle:** *This is a ledger, not a landing page.*

## Error handling design

| Failure class | Treatment |
|---|---|
| 401 (session expired) | Redirect to login with a reason shown there, not a silent fail |
| 403 (no permission) | Inline message naming what's restricted and who can grant it — never a blank page |
| 400 (validation) | Inline, per-field messages on the form — never one paragraph at the bottom |
| 404 / empty data | A named empty state: what will appear here and how to add the first one |
| Network / 500 | A distinct retry banner, separate from validation errors |
| Action success/failure (approve, create, import) | Toast in the interface's own voice — "Couldn't record your decision. Someone else already approved this step." never "Oops" |
| Submitting | Disabled button + spinner, to prevent double-submit |
| Loading | Skeleton rows, never a blank screen |
| Render crash | App-wide error boundary with a calm recovery screen ("Reload page"), not a white screen |

## What's left to the builder

- Exact component API for the shared Table/Toast/Banner/EmptyState/Skeleton/ErrorBoundary components.
- Exact copy for every error state beyond the examples above.
- Whether the toast system is a small hand-rolled context provider or a minimal dependency — builder's call, consistent with the "no heavy dependency" precedent (DECISIONS.md #9).
