# Challenges and Solutions

A record of real problems encountered during development of this project, with the symptom, root cause, fix, and lesson for each. Source: the project's git history and review rounds.

## a. Extraction ran past the end of the line

- **Symptom:** wrong field values, and one upload crashed with a database 500 (value too long).
- **Root cause:** the regex captured "everything after the label", crossing newlines and pulling in unrelated text.
- **Fix:** captures are line-bounded and shaped like the field (date-like, GSTIN-like, number-like).
- **Lesson:** a greedy pattern is a bug waiting for real data; constrain by shape, not just by label.

## b. A renamed .exe passed as a PDF; OCR failures left no trace

- **Symptom:** an `.exe` renamed `.pdf` was accepted; when OCR failed the invoice just sat with no explanation; a long failure message overflowed the exception column.
- **Root cause:** only the file extension was checked; the OCR error path did not record an exception; reasons exceeded `max_length` 255.
- **Fix:** magic-byte check (`%PDF`, PNG, JPEG headers); OCR failure creates an exception row and moves the invoice to Needs Review; reasons are truncated to 255.
- **Lesson:** never trust file names; every failure path must leave a visible record.

## c. Self-registration allowed choosing the AP Admin role

- **Symptom:** found in code review: anyone could register as `ap_admin`.
- **Root cause:** the register serializer accepted `role` from the client.
- **Fix:** the role is no longer client-controlled on self-registration.
- **Lesson:** privilege escalation hides in "convenience" fields; every writable field should be reviewed for who is permitted to set it.

## d. Adding the vendor-master check silently broke the Day 1 end-to-end test

- **Symptom:** after adding "vendor must exist in master", the earlier upload test failed.
- **Root cause:** the test fixture had no matching vendor row; new validation changed what "valid" means.
- **Fix:** gave the end-to-end test a matching vendor.
- **Lesson:** a new rule ripples into old fixtures; the full suite should run after every rule change, not only the new test.

## e. The exception queue flooded with "no PO" noise

- **Symptom:** every invoice without a PO produced a match exception.
- **Root cause:** matching ran for all validated invoices.
- **Fix:** matching and approval start only for PO-linked invoices.
- **Lesson:** an alert that fires for everything is ignored. Side effect to remember: no-PO invoices now stay Validated with no approval route.

## f. An escalated step could never let the invoice reach Approved

- **Symptom:** found in review: after escalation the invoice stayed Pending Approval forever.
- **Root cause:** the "are all steps done?" check only accepted approved steps, but the original step is marked escalated and a replacement step is created.
- **Fix:** escalated steps count as resolved; the replacement step carries the decision.
- **Lesson:** every state must be modeled in the final "is it finished?" condition.

## g. CSV import crashed on missing cells, BOM headers and NaN amounts

- **Symptom:** 500 errors from real-world CSV files.
- **Root cause:** assumed every cell exists, headers have no byte-order mark, and amounts are sane numbers.
- **Fix:** read with `utf-8-sig`, treat missing cells as empty, reject non-finite or out-of-range amounts, and report errors per row while importing the good rows.
- **Lesson:** user-supplied files are hostile input; partial success with clear row errors beats all-or-nothing crashes.

## h. Duplicate check could allow double payment

- **Symptom:** a duplicate of an already approved invoice was not flagged.
- **Root cause:** the check only compared against invoices with status "validated".
- **Fix:** compare against every invoice except rejected and needs-review ones.
- **Lesson:** "duplicate" should be defined by the risk being protected against (paying twice), not by one convenient status.

## i. A real Clean Fanatics tax invoice and quotation exposed template variety

- **Symptom:** labels like "Invoice No. :", "GSTIN-" and a bare "Total" were missed; an OCR misread of a colon broke another field.
- **Root cause:** patterns were written against idealised sample text.
- **Fix:** widened separators and labels. A quotation was correctly refused as not a tax invoice. Vendor-from-letterhead and OCR-misread dates were honestly left for manual review rather than guessed.
- **Lesson:** real documents should be tested against early, and any deliberately unsolved cases should be documented explicitly.

## j. Leaky 409 toasts and no redirect on expired sessions

- **Symptom:** a conflict toast showed "Step 42 is already approved"; an expired login left users stranded on a broken page.
- **Root cause:** raw server text was shown to users; 401 had no handling.
- **Fix:** typed `ApiError` kinds with fixed user wording per kind, and a redirect to login on unauthorized.
- **Lesson:** the user-facing message should be decided in one place.

## k. Environment friction

- **Symptom:** Docker unavailable on the dev machine; OCR would not run; git worktree removal failed.
- **Root cause:** Docker could not be installed; Tesseract and Poppler were missing; Windows file locks held files open.
- **Fix:** native Postgres; Tesseract and Poppler installed with `winget`, located through `TESSERACT_CMD` and `POPPLER_PATH`; close editors/processes before removing a worktree.
- **Lesson:** the Docker files in this repo were written but never built here. That is stated plainly in the deployment docs.

## l. A payments-page column showed `—` for every vendor and amount

- **Symptom:** the "Ready to pay" table never showed vendor names or amounts, only em-dashes, even for invoices that clearly had both.
- **Root cause:** `InvoiceSerializer` never listed `extracted_vendor_name` / `extracted_total_amount` / etc. in its `fields`, so the API response simply didn't carry them, even though the frontend already expected them.
- **Fix:** added the five `extracted_*` fields to the serializer (read-only).
- **Lesson:** a frontend reading a field the backend never sends degrades silently to "—", not a visible error — caught only by actually looking at the running page, not by the test suite (which never asserted on those specific fields).

## m. Nav bar randomly appeared on the login screen

- **Symptom:** after a long-idle session, the full app nav rendered above the sign-in form, and separately, the nav never appeared immediately after a fresh login (needed a manual refresh).
- **Root cause:** two different bugs with one root: `isLoggedIn()` only checked whether an access token *existed* in `localStorage`, never whether it had expired, and `Nav` read that state directly rather than through React state, so (a) a stale/expired token still counted as "logged in" anywhere, including `/login`, and (b) nothing told React to re-render when `login()`/`logout()` changed that state.
- **Fix:** `isLoggedIn()` now decodes the JWT `exp` claim; a small `ap-auth-changed` browser event fired from `login()`/`logout()` forces the app to re-render; `/login` also explicitly never renders the nav regardless of token state.
- **Lesson:** "is the user logged in" quietly became two different, slightly wrong questions (token present? vs. token valid?) in two different places. Found only by driving an actual login through Playwright, not a full-reload test script that happened to always land on a fresh render.

## n. The login screen's own fix made things worse, twice, before it was right

- **Symptom:** round 1, a circled 1-2-3-4-5 step diagram replaced with a product preview — still read as a generic, mostly-empty page per direct user feedback. Round 2, filled it out (stat tiles, a register preview, an approvals card) but the layout stretched both columns to `min-h-screen` with content vertically centered independently, so on any tall viewport a large dead gap opened above/below the content — worse on the sign-in side, which had no texture behind the small form at all. Round 2 also clipped the register-preview table at anything narrower than its artificially-forced `min-width`.
- **Root cause:** treating "more content" and "a bounded, intentional layout" as the same fix. They aren't — adding content to two independently-centered, unbounded-height columns just moves the empty space around.
- **Fix:** one bordered panel (both halves) centered as a single unit on a tinted page background, so leftover space reads as page margin around a designed object, not emptiness inside one. Table given `overflow-x-auto` with no forced `min-width`, matching the app's own `Table` primitive.
- **Lesson:** "add more stuff" and "fix the layout" are different diagnoses for "this looks empty" — the actual complaint was about structure, not content volume, and only became obvious after screenshotting at several real viewport heights, not just the one window size used during development.

## o. The line-item LLM feature took five real failures to actually work

Each step here was a distinct, real failure against the live API, not a hypothetical:

1. **Wrong SDK.** `google-generativeai`, the package initially selected, is itself fully deprecated by Google in favor of `google-genai` — only discovered by calling the real API and reading the deprecation warning, not from release notes.
2. **Wrong provider, initially.** The Anthropic API has no free tier; the integration was switched to Google Gemini, which does.
3. **No request timeout, on a call inside a synchronous request.** `client.models.generate_content()` has no default timeout, and this call runs inside the invoice upload request — a stalled connection could hang the whole upload indefinitely. Caught by directly testing with a hard tool-level timeout and watching it actually hang past 45 seconds; fixed with an explicit 8s `HttpOptions` timeout.
4. **The specific model name goes stale.** The exact model Google's own 404 error suggested (`gemini-3.8-flash`) was itself overloaded; later, `gemini-flash-latest` (the "safe alias" choice) was *also* overloaded. Five candidate models were tried directly against the live API before finding one (`gemini-flash-lite-latest`) that actually responded — confirmed by uploading a real invoice through the running app and getting correctly-parsed line items back in ~3 seconds, not by reading documentation and guessing.
5. **Retry budget too generous for a live demo.** 3 attempts × 30s timeout + backoff meant a ~96-second worst case if Gemini was down — long enough to look exactly like a hung upload. Cut to 2 attempts × 8s (~17s worst case), and reordered the code so the invoice's real status/validation/matching result is saved *before* the optional line-item call runs, not interleaved with it.
- **Lesson:** for a dependency on a third-party live service, "does it respond to the documented API" and "does it respond to the actual key, right now, for the actual prompt" are different questions — only the second is testable without a working integration already in place, and in this case it produced different answers than the first.

## p. A Render deploy worked, then the app couldn't be reached at all

- **Symptom:** backend logs showed `django.core.exceptions.DisallowedHost`; after fixing that, the frontend's sign-in failed with a 404 on every API call.
- **Root cause:** Render appends a random suffix to a service name on collision (`ap-automation-backend` became `ap-automation-backend-qxbs`), which didn't match the plain hostname baked into `render.yaml`'s `DJANGO_ALLOWED_HOSTS`/`CORS_ALLOWED_ORIGINS`/`CSRF_TRUSTED_ORIGINS`. Separately, the frontend's `VITE_API_BASE` is a Vite **build-time** variable — updating it in the Render dashboard does nothing until the next build, so the already-built JS kept calling the old, wrong hostname.
- **Fix:** update the three backend env vars to the actual assigned hostname; update `VITE_API_BASE` *and* trigger a manual rebuild on the frontend service (not just save the env var).
- **Lesson:** a platform assigning its own hostnames means any config written before first deploy is provisional; the actual URL should be verified rather than assumed from the plan. Confirmed by inspecting real Render deploy logs and querying the live URLs afterward, rather than assuming the dashboard save was sufficient.

## q. The deployed app never actually started "fresh"

- **Symptom:** after wiping the local database for a clean demo, the live Render app still showed 12 old `demo-00X` invoices and 3 demo vendors every time it was checked.
- **Root cause:** the backend `Dockerfile`'s startup command ran `python manage.py seed_demo` on every container start — deliberately added earlier so a deployed instance always "looked populated," without weighing that against also wanting a genuinely fresh instance for a real walkthrough.
- **Fix:** split `seed_demo` with a `--users-only` flag (creates just the 4 login accounts + the one approval rule the workflow needs, no synthetic invoices/vendors/payments); the Dockerfile now runs that instead.
- **Lesson:** "always seed demo data" and "start genuinely empty" are both reasonable defaults for different purposes, and baking one of them into a Docker image silently forecloses the other — worth a day-one decision, not a day-of-deadline correction.
