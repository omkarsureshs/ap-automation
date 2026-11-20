# Challenges and Solutions

Real problems hit while building this, in plain terms. Each: symptom, root cause, fix, lesson. Source: the git history and review rounds.

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
- **Lesson:** privilege escalation hides in "convenience" fields; review every writable field for who may set it.

## d. Adding the vendor-master check silently broke the Day 1 end-to-end test

- **Symptom:** after adding "vendor must exist in master", the earlier upload test failed.
- **Root cause:** the test fixture had no matching vendor row; new validation changed what "valid" means.
- **Fix:** gave the end-to-end test a matching vendor.
- **Lesson:** a new rule ripples into old fixtures; run the whole suite after every rule, not only the new test.

## e. The exception queue flooded with "no PO" noise

- **Symptom:** every invoice without a PO produced a match exception.
- **Root cause:** matching ran for all validated invoices.
- **Fix:** matching and approval start only for PO-linked invoices.
- **Lesson:** an alert that fires for everything is ignored. Side effect to remember: no-PO invoices now stay Validated with no approval route.

## f. An escalated step could never let the invoice reach Approved

- **Symptom:** found in review: after escalation the invoice stayed Pending Approval forever.
- **Root cause:** the "are all steps done?" check only accepted approved steps, but the original step is marked escalated and a replacement step is created.
- **Fix:** escalated steps count as resolved; the replacement step carries the decision.
- **Lesson:** model every state in the final "is it finished?" condition.

## g. CSV import crashed on missing cells, BOM headers and NaN amounts

- **Symptom:** 500 errors from real-world CSV files.
- **Root cause:** assumed every cell exists, headers have no byte-order mark, and amounts are sane numbers.
- **Fix:** read with `utf-8-sig`, treat missing cells as empty, reject non-finite or out-of-range amounts, and report errors per row while importing the good rows.
- **Lesson:** user-supplied files are hostile input; partial success with clear row errors beats all-or-nothing crashes.

## h. Duplicate check could allow double payment

- **Symptom:** a duplicate of an already approved invoice was not flagged.
- **Root cause:** the check only compared against invoices with status "validated".
- **Fix:** compare against every invoice except rejected and needs-review ones.
- **Lesson:** define "duplicate" by what you are protecting (paying twice), not by one convenient status.

## i. A real Clean Fanatics tax invoice and quotation exposed template variety

- **Symptom:** labels like "Invoice No. :", "GSTIN-" and a bare "Total" were missed; an OCR misread of a colon broke another field.
- **Root cause:** patterns were written against idealised sample text.
- **Fix:** widened separators and labels. A quotation was correctly refused as not a tax invoice. Vendor-from-letterhead and OCR-misread dates were honestly left for manual review rather than guessed.
- **Lesson:** test on real documents early, and document what you chose not to solve.

## j. Leaky 409 toasts and no redirect on expired sessions

- **Symptom:** a conflict toast showed "Step 42 is already approved"; an expired login left users stranded on a broken page.
- **Root cause:** raw server text was shown to users; 401 had no handling.
- **Fix:** typed `ApiError` kinds with fixed user wording per kind, and a redirect to login on unauthorized.
- **Lesson:** decide the user-facing message in one place.

## k. Environment friction

- **Symptom:** Docker unavailable on the dev machine; OCR would not run; git worktree removal failed.
- **Root cause:** Docker could not be installed; Tesseract and Poppler were missing; Windows file locks held files open.
- **Fix:** native Postgres; Tesseract and Poppler installed with `winget`, located through `TESSERACT_CMD` and `POPPLER_PATH`; close editors/processes before removing a worktree.
- **Lesson:** the Docker files in this repo were written but never built here. That is stated plainly in the deployment docs.
