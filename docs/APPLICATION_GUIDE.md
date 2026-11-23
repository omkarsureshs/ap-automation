# Application Guide — Plain English

This is not a technical document (see [HOW_IT_WORKS.md](HOW_IT_WORKS.md) for that). This explains
**what the application is for, how a person actually moves through it, and why it behaves the way
it does** — the kind of explanation you'd give a new employee on their first day, not a developer.

## 1. Purpose — what problem this solves

A company receives supplier invoices constantly — for office supplies, services, materials, anything
it buys from an outside vendor. Someone has to:
1. Read each invoice and pull out the key facts (who it's from, how much, which invoice number).
2. Check it's legitimate and correct (right vendor, right amount, not a duplicate, not billed twice).
3. Confirm it matches what was actually ordered and received, if there was a purchase order.
4. Get the right person to sign off on paying it.
5. Actually pay it, and keep a record of all of that for audits.

Done by hand, this is slow, error-prone, and easy to lose track of ("did anyone actually approve
this?"). This application automates that entire chain — from the moment an invoice file lands to
the moment it's paid — while keeping a few people in the loop on purpose, not automating them away
entirely. That last part matters: a system that could read an invoice and pay it with zero human
involvement would be faster, but it would also remove every check that stops a mistake, a duplicate
payment, or outright fraud from going through. The deliberate design choice here is **automate the
reading and checking, keep a human decision at the two points that actually carry risk: approving
money out the door, and executing the payment.**

## 2. Why there are four separate roles

This is the part most worth understanding, because every permission in the system follows directly
from the answer to "why does this role exist, and why can't the other roles do its job?"

| Role | Who they really are | Why they exist, specifically |
|---|---|---|
| **Requester** | The person who actually received the invoice — e.g. someone in the department that ordered the goods/services. | They're the one with firsthand knowledge of "yes, we did order this." They can upload and see their own invoices. They **cannot** approve or pay — if the person who requested something could also approve and pay it, there'd be no independent check at all. |
| **Approver** | A manager or finance reviewer. | Their entire job in this system is to look at an invoice *after* it's been read and checked, and decide approve or reject. This is the control point: money doesn't move without someone other than the requester signing off. |
| **AP Admin** | The accounts payable team member who actually runs the department. | They manage the vendor master list (who are our approved suppliers, what are their bank details), manage purchase orders, and — critically — are the *only* role that can trigger an actual payment. They also see things nobody else does (full bank account numbers, dashboards, reports) because they're accountable for where company money goes. |
| **Vendor** | The outside supplier themselves. | They're not company staff, so their access is deliberately the narrowest: they can see vendor and purchase-order information relevant to them, nothing about internal approvals, payments, or other vendors' bank details. |

Notice the shape of it: **the person who asks for something is never the person who approves it, and
the person who approves it is never the person who pays it.** That's not an accident of the UI, it's
enforced by the server on every single request, regardless of what the screen shows.

## 3. The usage flow — what actually happens, in order

### Step 1 — An invoice comes in
A Requester uploads the invoice file (PDF, image, or scanned TIFF — one file or several at once).
Nothing clever is required of them: drag it in, done.

### Step 2 — The system reads it
The system reads the image with OCR (optical character recognition — the same kind of technology
that turns a scanned page into searchable text) and pulls out the handful of facts that matter:
invoice number, date, the vendor's tax ID (GSTIN), the vendor's name, and the total amount.

*Why this matters for understanding the system:* this reading step is **rule-based, not "AI
guessing."** It looks for known labels ("Invoice No:", "GSTIN:", etc.) and pulls out what follows,
the same way a person skimming for those labels would. That's a deliberate choice — it's
predictable and testable, at the cost of needing invoices that are reasonably well-labeled. (There's
one place an AI model *is* used — reading out the individual line items on an invoice, like "5
office chairs at ₹2,500 each" — because that genuinely can't be done reliably with simple rules, and
it's treated as a bonus, not something anything else depends on.)

### Step 3 — The system checks it
Before anything moves forward, the system asks a short list of yes/no questions:
- Are all the important fields actually present?
- Is the vendor's tax ID a validly-formed one (not just random characters)?
- Does this vendor actually exist in our approved vendor list, and are they still active?
- Is the amount a sane, positive number?
- Have we already paid an invoice with this exact number from this exact vendor before (a duplicate)?

Any "no" sends the invoice to a **Needs Review** queue with the *specific* reason written out — never
a bare rejection. A human looks at it, decides what to do (often: fix a misread field and let the
system check again, without re-uploading).

### Step 4 — Matching against what was actually ordered (if applicable)
If this invoice is tied to a Purchase Order (a record of what was actually ordered beforehand), the
system compares the invoice amount against the PO — and, if goods were received, against the
Goods Receipt Note too. A small difference (within 1%) is allowed, because real invoices almost
never match a PO to the exact paisa (taxes, rounding). Anything beyond that tolerance is flagged for
a human to look at — this is the single biggest fraud/error check in the whole system: it catches
"we were billed for more than we actually ordered or received."

*If there's no purchase order at all* — a one-off expense, a utility bill, anything that wasn't
pre-ordered — the invoice simply stops at "Validated" and never enters the approval chain. This is a
known, deliberate limitation: approval routing in this build is driven by the amount on a matched
PO, so an invoice with nothing to match against has nothing to route against either.

### Step 5 — Getting the right person to sign off
Once an invoice is cleanly matched, the system looks at the amount and picks the approval rule that
covers it (the matrix of "amounts between X and Y need role Z" is configurable, so a company can
tighten scrutiny on larger amounts without touching any code). It then creates an approval task for
whoever holds that role.

*If nobody acts for a while,* the approver first gets a gentle reminder partway through the allowed
window, and if it's still untouched once that window fully elapses, the task automatically escalates
to AP Admin — so nothing just sits forgotten in someone's queue forever.

### Step 6 — Decision
The Approver looks at the invoice and either approves or rejects it. A rejection stops the invoice
there and marks it Rejected. An approval, once every required approver has signed off (a rule can
require more than one), moves the invoice to **Approved**.

### Step 7 — Payment
Only an AP Admin can trigger payment on an Approved invoice, and only once. The system calls out to
a banking gateway (a stand-in/mock here, built so a real bank integration could be swapped in without
changing anything else) and, once it succeeds, marks the invoice Paid and emails the vendor a payment
advice — the same courtesy a real accounts-payable department extends.

### Step 8 — Visibility, the whole time
None of the above happens in the dark. A dashboard shows how invoices are aging, how many approvals
are pending, how long things actually take end-to-end, and what fraction go straight through with
zero issues. A set of reports (aging, status, exceptions, an audit trail, tax figures) can be
exported to a spreadsheet at any point. This is what lets a finance lead see the shape of the whole
operation without opening a single individual invoice.

## 4. Edge cases — and why each one is handled the way it is

| What happens | What the system does | Why that's the right behavior |
|---|---|---|
| A file that isn't really a PDF/image at all (e.g. a renamed `.exe`) | Rejected immediately, before anything else runs | A basic safety net — nothing unsafe should even reach the OCR step |
| A real file, but OCR can't read anything useful from it | Accepted, but flagged Needs Review with "OCR failed" and the reason | Never silently dropped — a human finds out exactly what went wrong |
| Invoice has no purchase order linked | Stops at Validated, no approval chain starts | There's nothing to match or route against — a known, stated limitation, not a bug |
| Invoice amount is slightly off from the PO (≤1%) | Passes, continues to approval | Real invoices rarely match to the paisa; this tolerance absorbs normal rounding/tax differences |
| Invoice amount is meaningfully off from the PO (>1%) | Flagged Needs Review with the exact mismatch | This is the main check against being billed for more than was ordered |
| Same invoice number + vendor seen before | Blocked as a duplicate | Prevents accidentally paying the same bill twice |
| Two approvers try to decide the same step at the same moment | Only the first succeeds; the second sees a clear "someone already handled this," not a crash or silent double-decision | Keeps the approval record honest — exactly one decision per step, ever |
| Nobody approves within the allowed window | A reminder first, then automatic escalation to AP Admin | Nothing is ever silently stuck in one person's queue indefinitely |
| The invoice's tax ID doesn't match any vendor on file | Flagged "vendor not found," never guessed or auto-created | The system never invents a vendor identity — a human decides whether to add one |
| OCR misread one field (a date, a GSTIN) | AP Admin can correct just that field in place, and the system re-checks everything live | Avoids forcing a full re-upload for a one-character OCR mistake |
| The optional line-item reader (AI model) isn't available or fails | The invoice processes exactly as normal, just without the item breakdown | That feature is explicitly a bonus — nothing else in the system depends on it existing |
| Someone requests payment twice on the same invoice | The second request is refused | Prevents a double payment to the same vendor for the same invoice |
| A role tries to do something outside its job (e.g. a Vendor trying to approve an invoice) | Refused with a clear message, and the option isn't even shown on screen to begin with | Matches the whole point of having separate roles in the first place |

## 5. The one-sentence version, if you need it

**An invoice comes in, gets read and checked automatically, gets matched against what was actually
ordered, gets approved by someone who didn't request it, gets paid by someone who didn't approve it,
and every step of that is visible afterward — with every failure along the way explained in plain
language instead of silently dropped.**
