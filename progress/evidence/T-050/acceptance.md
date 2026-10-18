# Final acceptance checklist execution (T-050, PRD 10.3)

Public site: https://myproject-dc19d.web.app
Demo task used as the reference: task_4d4a28a0

## Functional acceptance (8/8)
- [x] **A1** All five formats (PDF, JPG, PNG, XLSX, CSV) parse successfully — uploaded 5 files, accepted 5: GD-01_invoice_metal_scan.pdf, GD-05_utility_gas_photo.jpg, GD-07_packing_cartons.png, GD-02_po_polymer.xlsx, GD-08_invoice_steel.csv
- [x] **A2** One-click load of 20 documents produces a full report within 3 minutes — T-044 evidence: 10/10 timed runs passed, P90 = 61.3s (target <= 180s)
- [x] **A3** Every citation anchor resolves to its original file (coverage 100%, 0 invalid) — coverage 100%, invalid 0; sampled 12 record anchors and opened each source document (12 downloads, e.g. {"anchor":"rec_1531c2dc","locator":"doc_0f1bb61d#page=1","document":"D-12_waste_invoice.pdf"})
- [x] **A4** High-uncertainty records are queued for review automatically — review queue has 20 open item(s); high-uncertainty records in ledger: 19, all present in queue: true
- [x] **A5** A review edit recalculates and refreshes the report — record rec_1531c2dc: quantity 4200 -> 8400; total 636063.420 -> 638249.857 kgCO2e; stored report total refreshed 636063.420 -> 638249.857 t
- [x] **A6** All three scenarios are computed with absolute and percentage reductions — chapter 7 rows: Transport mode shift = 45.825 t (7.20%) | Supplier swap = 97.692 t (15.36%) | Material substitution = 91.232 t (14.34%)
- [x] **A7** PDF and CSV exports succeed with no encoding problems — PDF 38274 bytes, 38 pages (>= 6); CSV detail 20 rows, category 15 rows, both decode as UTF-8 with no replacement characters
- [x] **A8** Task state survives a page refresh — a fresh client (no cookies) re-read the task: 20 documents and 19 records persisted server-side; the SPA restores the active task from localStorage on load and keeps the anonymous session across reloads

## Compliance acceptance (5/5)
- [x] **B1** Deployed on Cloud Run + Firebase and the public URL is reachable — firebase.json declares the Cloud Run rewrites (gcloud unavailable in this shell); public URL https://myproject-dc19d.web.app -> HTTP 200; hosting rewrites /api/** and /factors/** to the Cloud Run service
- [x] **B2** All generative capability comes from Gemini models and recall uses the Google official embedding model, with no third-party model service — model endpoints referenced in first-party code: generativelanguage.googleapis.com, identitytoolkit.googleapis.com, securetoken.googleapis.com; non-Google model endpoints: none; configured models: gemini-3.5-flash-lite, gemini-3.5-flash-lite, gemini-3.5-flash-lite, gemini-embedding-001, gemini-3.5-flash-lite, gemini-embedding-001, gemini-3.5-flash-lite
- [x] **B3** The public URL has no login barrier: anonymous sign-in completes automatically with no credentials — anonymous sign-in without any credential returned uid 841V5aDH…; a task created with that ID token is owned by the same uid (true); the SPA calls ensureAnonymousSession() on load and renders no credential form
- [x] **B4** All UI copy, report body, README and video subtitles are English — checked 5 user-visible artifacts plus the generated report: no CJK characters; the model-output validator rejects non-English rationales. (Chinese strings in the normalization tables are input aliases for parsing Chinese-language source documents, not output copy.)
- [x] **B5** The track label matches in all three places (deck cover, README top, video end) — README top: "Sustainability & Social Impact"; deck cover: "Sustainability & Social Impact"; video script credit: "Sustainability & Social Impact"

## Engineering acceptance (5/5)
- [x] **C1** The evaluation tool runs from the command line and emits a complete report — node eval/run.js -> single table with 11 metric rows, summary row passed=11 failed=0, verdict PASS; machine-readable + markdown written to eval/results/run-online/
- [x] **C2** Every evaluation metric meets its PRD 10.1 target and the invalid-reference count is 0 — verdict PASS; failed metrics: none; invalid references: 0
- [x] **C3** No secrets are present in the repository — SECRET SCAN: PASSED (0 hits)
- [x] **C4** Self-developed code is within the 7,000-line target and never touches the 10,000-line hard cap — application + JS tooling: 6978 lines (<= 7,000); including the offline Python dataset toolchain: 8773 lines (< 10,000). Method and full breakdown in scripts/count_lines.sh
- [x] **C5** The README explains the architecture, deployment steps, environment variables and evaluation results — all required sections present (7); the environment-variable table documents every one of the 12 central configuration entries (missing: none)

## Accessibility and language NFRs (2/2)
- [x] **N1** NFR-403 — the main flow is completable by keyboard alone — task form uses native controls with labels and submit; the drop zone is focusable (tabIndex=0) and opens the file picker on Enter; record rows are focusable and expand on Enter; the primary navigation is labelled and anchor-based
- [x] **N2** NFR-404 — colour is never the only carrier of information — every status and uncertainty badge renders an outline icon (aria-hidden, so it is decoration) next to its English text label: 3 icon usages, 3 text labels, 3 decorative icons marked aria-hidden

## Video acceptance (4) — pending human recording
- [ ] Video acceptance 1 — the first 15 seconds state the value numbers (cost and hours) — record per deliverables/video_script.md shot 1, then confirm the hook caption
- [ ] Video acceptance 2 — one continuous drag-to-report run without cuts — record shot 2 in one take over the live demo dataset
- [ ] Video acceptance 3 — a semantic-matching comparison case is shown — record the Golden boundary case selected in deliverables/video_script.md
- [ ] Video acceptance 4 — a citation traceability click is shown — record the anchor click on P7 with the original document opening

## Human usability check (1) — pending
- [ ] NFR-401 — a first-time user understands the main screen within 5 seconds — show P1/P2 to someone unfamiliar and time their first correct action

## Post-production steps — pending
- [ ] Video subtitles are English (final check after recording) — the English subtitle script in deliverables/video_script.md is the source for the burned-in captions
- [x] Export the deck to PDF (10-14 pages) — render deliverables/deck_draft.md to PDF
  - Done: `deliverables/CarbonLedger_Deck.pdf` (13 pages, 16:9, 334 KB ≤ 5 MB; zero CJK per text extraction; cover carries the verbatim title, track and value proposition; p.8 metrics match README eval table 11/11 PASS; per-page raster check shows no overflow). Built by `deliverables/build_deck.py`, verified by `deliverables/verify_deck.py`.
- [ ] Upload the video — publish the recording

## Verdict
- Automated items: functional 8/8, compliance 5/5, engineering 5/5 — **PASS**
- G6 engineering part: **PASSED** (README complete, every automatable acceptance item executed, deck draft and video script ready)
- G6 in full still requires the human items above (video recording, real-person usability test, video upload).
