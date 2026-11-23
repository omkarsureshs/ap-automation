# Demo Video Script

This is a **presentation script**, not the testing guide — it's built to be watched, not to verify
every edge case. Target length: **9-12 minutes**. Read [docs/APPLICATION_GUIDE.md](APPLICATION_GUIDE.md)
once before recording — it's the source for *why* things work this way, which is what makes the
narration sound like understanding, not a script being read.

Format: **[SAY]** is narration (read it, or say it in your own words — meaning matters more than the
exact wording). **[SHOW]** is what to click/do on screen. **[TIME]** is a rough budget, not a hard rule.

---

## 0. Before you hit record

- [ ] Fresh database: `python manage.py seed_demo --users-only` (4 logins, no demo clutter — every
      row you see on camera is something *you* created live, which looks far more real than
      pre-seeded `demo-001.pdf` rows).
- [ ] Backend + frontend both running, both tested once already today.
- [ ] The three files in `docs/sample-invoices/` ready to hand (know their folder location so you
      don't go hunting on screen).
- [ ] Browser zoom at a level comfortably readable on a recording (110-125% is usually safer than 100%).
- [ ] Four private/incognito windows ready (or be comfortable logging out/in on camera) — one per role.
- [ ] Know your repo URL and (if fixed) your live Render URL before you start talking about them.

---

## 1. Cold open — the problem, in one breath

**[TIME] 30 seconds**

**[SAY]**
> "Every company that buys anything from outside vendors has the same problem: an invoice arrives,
> someone has to read it, check it, match it to what was actually ordered, get it approved, and pay
> it — and do all of that without losing track, without paying the same bill twice, and without
> letting the same person both request and approve a payment. This project automates that whole
> chain, end to end."

**[SHOW]** Nothing yet — just you talking, or the login screen sitting ready behind you.

---

## 2. What this is, and the stack

**[TIME] 45 seconds**

**[SAY]**
> "This is an Accounts Payable automation system — Django and Django REST Framework on the backend,
> PostgreSQL for the database, React with TypeScript on the frontend. That's the mandated stack for
> this assignment, no substitutions. The whole invoice lifecycle lives here: capture, OCR extraction,
> validation, purchase-order matching, a configurable approval workflow, and mock payment execution,
> with a dashboard and five reports on top."

**[SHOW]** The login screen — let it sit a beat so the design is visible (the register preview panel
is a nice, non-generic touch worth a half-second of silence to let it register).

---

## 3. Architecture and design decisions, briefly

**[TIME] 90 seconds — this is the one section that's mostly you talking, not clicking**

**[SAY]**
> "A few decisions worth calling out specifically, because they weren't the obvious or easiest
> choice:
>
> First — the OCR field reading is deliberately rule-based, not an LLM, for the five header fields:
> invoice number, date, tax ID, vendor name, amount. That's a conscious choice for predictability and
> testability over a fancier but less deterministic approach. The one place I *did* bring in an AI
> model is reading out individual line items — the actual materials or services billed — because that
> genuinely can't be done reliably with pattern matching across different invoice layouts, and it's
> built as a pure bonus: if that service is unavailable, the rest of the system doesn't even notice.
>
> Second — every amount-related operation that could race — two people approving the same step, two
> payment requests for the same invoice — is protected with database row locking, not just a check in
> application code. That matters because a check-then-act race condition is exactly how double
> payments happen in real systems.
>
> Third — vendor bank details are encrypted at rest and masked for anyone except AP Admin, and every
> permission boundary is enforced on the server, not just hidden in the UI — a forbidden action
> returns a real 403, it isn't just a missing button."

**[SHOW]** Optionally flash the repo's folder structure or `docs/DATABASE_SCHEMA.md`'s diagram for a
few seconds while you say this — not required, but it backs up "database" and "architecture" with
something visual.

---

## 4. Live walkthrough — the golden path, across all four roles

**[TIME] 4-5 minutes — this is the heart of the video**

**[SAY]** *(as you start)*
> "Let me walk through one invoice, start to finish, as the actual people who'd touch it."

### 4a. Requester uploads

**[SHOW]** Log in as `requester@demo.com`. Go to Invoices. Upload
`docs/sample-invoices/test-invoice-northwind.pdf`.

**[SAY]**
> "A requester just drags the invoice in — no special handling needed. The system reads it with OCR
> right now, synchronously, in a few seconds."

**[SHOW]** The row appears — point out the status.

### 4b. AP Admin sets up the vendor (if not already done)

**[SHOW]** Switch to `admin@demo.com`. Go to Vendors, add "Northwind Traders" with GSTIN
`29NWTRA1234P1ZL` (from `docs/sample-invoices/README.md`).

**[SAY]**
> "The invoice's tax ID didn't match anyone in our vendor master yet, so it would have landed in
> Needs Review for exactly that reason — not guessed, not auto-created. As AP Admin, I add the
> vendor properly."

**[SHOW]** Go back to Invoices (or refresh) — the invoice is now **Validated**.

### 4c. Link a purchase order and show matching

**[SHOW]** Create a Purchase Order for Northwind Traders with a total close to the invoice amount
(within 1%). Either link it through the UI if available, or narrate the `curl` step from
`docs/TESTING_GUIDE.md` scenario 6 briefly without dwelling on the command syntax on screen.

**[SAY]**
> "Once it's tied to a purchase order, the system checks the invoice amount against what was actually
> ordered — within a 1% tolerance, because real invoices are almost never an exact match. Clean match,
> and it moves straight into the approval queue."

### 4d. Approver decides

**[SHOW]** Switch to `approver@demo.com`. Open Approvals. Approve the invoice.

**[SAY]**
> "The approver is a different person than the one who requested it, by design — that's the actual
> control this whole workflow exists to enforce. One click, approved."

### 4e. AP Admin pays

**[SHOW]** Switch back to `admin@demo.com`. Open Payments. Click "Request payment" on the now-Approved
invoice.

**[SAY]**
> "And only AP Admin can trigger the payment — through a mock banking gateway here, built behind the
> same interface a real one would use, so swapping it out later doesn't touch anything else. The
> vendor also gets a payment advice email — you can see it printed in the backend console right now,
> since this build doesn't have a live SMTP server connected."

**[SHOW]** Point at the backend terminal output for the payment-advice email, briefly.

---

## 5. Exception handling, live — the part that actually proves it's not just a happy-path demo

**[TIME] 90 seconds**

**[SHOW]** As requester, upload `docs/sample-invoices/test-invoice-incomplete.pdf`.

**[SAY]**
> "Let's deliberately break something. This invoice is missing its tax ID and vendor name."

**[SHOW]** It lands in Needs Review with the specific reasons listed.

**[SAY]**
> "Nothing crashes, nothing silently disappears — it's flagged, and it tells you exactly what's
> wrong."

**[SHOW]** Switch to `admin@demo.com`, click "Fix & revalidate" on that row, type in a GSTIN and
vendor name, save.

**[SAY]**
> "An AP Admin can correct just the field that was misread and the system re-validates live — no
> need to re-upload the whole file for one bad field."

---

## 6. Dashboard and reports — the view from the top

**[TIME] 60-75 seconds**

**[SHOW]** As admin, open Overview (dashboard). Point at 2-3 tiles (pending approvals, straight-through
rate, payment tracking) and the charts.

**[SAY]**
> "None of this happens invisibly. The dashboard shows invoice aging, how many approvals are pending,
> average turnaround time, what fraction of invoices go straight through with zero issues, and vendor
> and payment analytics."

**[SHOW]** Open Reports, flip through one or two tabs, click Export CSV on one.

**[SAY]**
> "And five reports — aging, status, exceptions, an audit trail built from the real records rather
> than a separate log that could drift out of sync, and a tax report — all exportable."

---

## 7. Role-based access — quickly, to show it's real

**[TIME] 30-45 seconds**

**[SHOW]** Log in as `vendor@demo.com`. Point at the nav bar — only Vendors and Purchase Orders.

**[SAY]**
> "Every role only sees what it can actually use — hidden, not just disabled — and that's enforced on
> the server as well. A vendor trying to hit an approval endpoint directly gets refused exactly the
> same way, this isn't just a hidden button."

---

## 8. Challenges actually hit while building this

**[TIME] 60-90 seconds — talk over the screen, or show `docs/CHALLENGES_AND_SOLUTIONS.md` scrolling briefly**

**[SAY]** *(pick 2-3 of these, don't read all of them — whichever you can speak to most naturally)*
> "A few real problems came up building this, not hypothetical ones. OCR on a real tax invoice
> template missed fields that worked fine on an idealized sample — real invoices use inconsistent
> separators and labels, so the extraction had to be widened and tested against actual documents, not
> just clean mockups.
>
> Getting an LLM integration for the line-item reading actually working took five real, separate
> failures — a deprecated SDK, a provider with no free tier, a call with no timeout that could hang
> an upload indefinitely, three different model names that were each unavailable for different
> reasons, before landing on one that actually responds — all found by testing against the live API,
> not by reading documentation.
>
> And deploying to Render surfaced two surprises: the platform assigns its own hostname suffix on a
> name collision, which broke `ALLOWED_HOSTS` until I updated it to the real assigned URL, and the
> frontend's API base URL is baked in at build time, so updating it in the dashboard alone does
> nothing without a rebuild."

---

## 9. Close

**[TIME] 20-30 seconds**

**[SAY]**
> "That's the full lifecycle — capture, read, validate, match, approve, pay, and full visibility the
> whole way through, with every exception explained rather than hidden. The source is on GitHub
> [mention your repo URL], the database schema and a full list of known limitations are documented in
> the repo, and [if live] there's a deployed version at [your Render URL]. Thanks for watching."

**[SHOW]** README or the repo's GitHub page for the last few seconds.

---

## Notes on pacing

- The golden-path walkthrough (section 4) is the section to rehearse once before recording — role
  switches are the easiest place to fumble on camera. Know exactly which private window is which
  role before you start.
- You do not need to show every scenario in `docs/TESTING_GUIDE.md` — that guide is for QA, this
  script is for a recruiter watching once. One clean path, one deliberate failure, one quick tour of
  dashboards/reports/roles, and the talking points, is a complete story.
- If Gemini's free tier is unavailable when you record (check `docs/CHALLENGES_AND_SOLUTIONS.md`,
  item o), skip the line-item mention in section 4a/4b rather than showing a feature that visibly
  does nothing — the system is explicitly built so that's safe to skip.
