# Study Guide — Before You Start Building

Read this before Day 1. Goal: you can explain *why* regex and Tesseract's LSTM
work the way they do, not just that they're used, by the time you're in front of
an interviewer.

## 1. Regex — theory, enough to explain it properly

Regex isn't just a scripting trick — it comes from formal language theory
(finite automata). Knowing this is the difference between "I used regex" and "I
understand why regex can and can't parse certain structures" (the classic
interview trap: "can regex parse HTML?" — answer: not arbitrarily nested
structures, because regular languages can't count/match nesting depth; that
needs a context-free grammar/parser).

**Foundational papers (short, worth skimming, not full study):**
- Kleene, S. C. (1956), *"Representation of Events in Nerve Nets and Finite
  Automata"* — the origin of "regular" in regular expressions; regex patterns
  correspond to finite automata.
- Thompson, K. (1968), *"Regular Expression Search Algorithms"*, CACM — the
  classic construction converting a regex into an NFA (Thompson's construction).
  This is *why* regex engines can match efficiently.
- Russ Cox (2007), *"Regular Expression Matching Can Be Simple and Fast"*
  (swtch.com/~rsc/regexp/regexp1.html) — modern, very readable explanation of
  why naive backtracking regex engines (Python's `re`, PCRE) can be
  exponential-time on pathological input, vs. automata-based engines (RE2) that
  are linear. **This is the single most useful read** — if an interviewer asks
  "could your regex-based extraction have a performance problem," this is the
  answer: catastrophic backtracking on certain patterns, and how to avoid it
  (avoid nested quantifiers like `(a+)+`, prefer `re.compile` with anchored,
  non-greedy, bounded patterns).

**Practical skills to refresh (not papers, just practice):**
- Anchoring (`\b`, `^`, `$`) and why unanchored patterns are the #1 cause of bad
  extraction (grabs trailing junk).
- Greedy vs. non-greedy (`.*` vs `.*?`).
- Named capture groups (`(?P<invoice_no>...)`) — makes extraction code
  self-documenting, use these in the real implementation.
- Lookahead/lookbehind for things like "amount after the word Total but not
  inside a line item table."
- Test everything on regex101.com (Python flavor) before putting it in code —
  it visualizes the match and catastrophic-backtracking risk.

## 2. Tesseract & LSTM — enough to explain the OCR layer honestly

**Core paper (don't need full depth, know the one-paragraph idea):**
- Hochreiter, S. & Schmidhuber, J. (1997), *"Long Short-Term Memory"*, Neural
  Computation. The original LSTM paper — solves the vanishing-gradient problem
  in plain RNNs by adding gated memory cells (input/forget/output gates) so the
  network can retain information across longer sequences. You don't need the
  full math; you need to be able to say: *"LSTM is a recurrent network variant
  designed to remember context over longer sequences, which is why it's good at
  reading a line of text character by character — it uses the surrounding
  characters as context, unlike older template-matching OCR."*

**OCR-specific context:**
- Smith, R. (2007), *"An Overview of the Tesseract OCR Engine"* — the original
  Tesseract architecture (pre-LSTM, pattern-matching based).
- Tesseract 4+ replaced that pipeline with an LSTM-based line recognizer — this
  is the part that makes "Tesseract is AI-powered OCR" a true statement, not
  marketing.
- Shi, B. et al. (2015), *"An End-to-End Trainable Neural Network for
  Image-based Sequence Recognition..."* (CRNN paper) — if asked "how does a
  neural network read a line of text," this is the standard reference
  architecture (CNN extracts visual features per column, LSTM reads them as a
  sequence, CTC loss aligns predicted characters to the unsegmented image).
  Tesseract's LSTM engine follows a similar idea.

**Be ready to explain the honest boundary:** OCR (Tesseract/LSTM) = reads the
raw text accurately. Field extraction (your regex layer) = decides which piece
of that text is "invoice number" vs. "GST amount." Only the first part is ML.
Don't blur this in the interview — see Decision #4 in `DECISIONS.md` for the
exact framing to use.

## 3. GSTIN/GST validation — specific domain knowledge you'll need

- GSTIN format: 15 characters — 2-digit state code + 10-char PAN + 1 entity
  code + 1 default 'Z' + 1 checksum digit. Look up the official checksum
  algorithm (modulo-36 check-digit, similar to code-39 barcode checksums) before
  writing the validator — this is a concrete, explainable piece of domain logic
  for the interview, not generic plumbing.

## 4. Reference projects to skim (not to copy — to see how others structured the problem)

No existing project combines this exact stack, so these are for pattern
inspiration only:
- **InvoSync** (React + Flask + Tesseract) — look at how it separates
  OCR → parsing → comparison → export into modules; a reasonable shape to mirror
  in Django app structure.
- **InvoiceMate AI** (React/Vite + FastAPI + PaddleOCR + Ollama) — note how it
  frames "local-first, no cloud OCR" as a selling point; useful language for
  your own "works fully offline" framing.
- `arxiv.org/abs/2510.15727` — *"Invoice Information Extraction: Methods and
  Performance Evaluation"* — gives you a vocabulary for evaluation (field-level
  precision, exact-match accuracy) if asked how you'd measure OCR/extraction
  quality beyond "it looked right."

## 5. Django/DRF refreshers (if rusty)

- DRF serializers + viewsets (you'll use these heavily for every module's CRUD).
- `djangorestframework-simplejwt` basic flow (obtain/refresh token).
- Django migrations basics (you'll be iterating the schema daily across 3 days).
- `django-cryptography` (or a custom `EncryptedCharField`) for the vendor bank
  detail encryption decision.

## 6. The actual plan to build (summary)

Full detail is in `docs/superpowers/specs/2026-11-18-ap-automation-design.md`
and the reasoning for every choice is in `docs/DECISIONS.md`. One-paragraph
version: a Django+DRF+Postgres backend and a React+Tailwind+shadcn frontend,
covering all 9 scope-doc modules — real Tesseract OCR with regex field
extraction and a validation/exception-review layer, real PO/GRN matching
(2-way/3-way) against an internal CRUD+CSV-import module, a real role-based
approval workflow with escalation and in-app+email notifications, real IMAP
email ingestion, and a mocked-but-swappable banking gateway for payment
processing — built in 3 days (scaffold+capture+OCR+validation → vendor/matching/
workflow → payments/dashboards/reports/tests), with Docker+Render deployment as
a stretch goal.
