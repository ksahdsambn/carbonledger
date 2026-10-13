# Requirements Traceability List — CarbonLedger

This is the authoritative traceability list required by Implementation Plan T-001.
Source of truth: PRD v1.2 (2026-10-12). Plan: IMPLEMENTATION_PLAN.md (T-001..T-051).

Status values: `not_started` (未开始) / `in_progress` (进行中) / `verified` (已验证).
Final delivery requires every FR / NFR / AI row to be `verified`.

Counts (must match): FR = 57, NFR = 21, AI = 13, EV = 6, M = 5, D = 5, L = 3.

## Functional Requirements (57)

| ID | Requirement summary | Implementation task | Verification task | Status |
|---|---|---|---|---|
| FR-101 | Support PDF/JPG/PNG/XLSX/CSV upload, all five formats parse successfully | T-011 | T-012 | verified |
| FR-102 | Multi-file drag upload with per-file status (7 states), 20 files no hang | T-011 | T-012 | verified |
| FR-103 | Multi-page PDF split into page units, per-page classification | T-013 | T-013 | verified |
| FR-104 | Content-hash duplicate detection with user decision | T-011 | T-012 | verified |
| FR-105 | 10 MB per-file limit with clear English rejection message | T-011 | T-012 | verified |
| FR-106 | Original files persisted, viewable at any point in the flow | T-011 | T-020 | verified |
| FR-201 | Classify each page unit into one of 7 doc types + confidence; ≥93% (28/30) on Golden | T-014 | T-015 | verified |
| FR-202 | Closed enum of 7 types; 0 out-of-set values over ≥200 calls | T-014 | T-015 | verified |
| FR-203 | Classification confidence <0.7 routes to manual confirmation | T-014 | T-015 | verified |
| FR-301 | Extract per field table; missing fields left empty, never fabricated | T-016 | T-017 | verified |
| FR-302 | All units converted to base units (10 conversion pairs correct) | T-018 | T-019 | verified |
| FR-303 | Every extracted field carries 0–1 confidence | T-016 | T-017 | verified |
| FR-304 | One document may yield multiple activity records (3-line invoice → 3) | T-016 | T-017 | verified |
| FR-305 | Extraction traceable to source region with highlight on view | T-020 | T-020 | verified |
| FR-306 | Handwritten/low-quality scans still attempted, ≥2/3 yield valid records | T-016 | T-017 | verified |
| FR-401 | All 10 unit conversions implemented, each conversion in audit trail | T-018 | T-019 | verified |
| FR-402 | Origin/destination normalized to country-region + city structure | T-018 | T-019 | verified |
| FR-403 | Transport mode closed enum (10 values); 0 out-of-set over ≥100 calls | T-018 | T-019 | verified |
| FR-501 | Scope 1/2/3 boundary decision; ≥90% (9/10) on Golden | T-023 | T-024 | verified |
| FR-502 | Scope 3 refined to one of 15 categories (code + name); ≥90% (11/12) | T-023 | T-024 | verified |
| FR-503 | Boundary decision carries non-empty English rationale | T-023 | T-024 | verified |
| FR-504 | Highly duplicated records flagged as suspected duplicates | T-023 | T-024 | verified |
| FR-601 | Factor library from public sources, documented (name, year, link) | T-005 | T-049 | verified |
| FR-602 | 5 industries × ≥40 factors each, total ≤1,200 | T-006 | T-006 | verified |
| FR-603 | Each factor has all 13 attributes; 100% completeness on 50-sample check | T-006 | T-006 | verified |
| FR-604 | Keyword + semantic vector dual recall channels, independently toggleable | T-021 | T-022 | in_progress |
| FR-605 | Factor library shipped as data files, no runtime network fetch | T-006 | T-006 | verified |
| FR-606 | Factor data-year labels; year distribution disclosed in report | T-007 | T-033 | verified |
| FR-701 | Three-stage matching pipeline; ≤8 s per record end-to-end | T-021/T-025 | T-025 | in_progress |
| FR-702 | Selected factor id always exists in candidate list (0 invalid refs) | T-025 | T-025 | in_progress |
| FR-703 | English rationale ≥40 words incl. why-not-runner-up comparison | T-025 | T-025 | in_progress |
| FR-704 | Three-level uncertainty distribution disclosed in report | T-027 | T-033 | verified |
| FR-705 | Runner-up retained; manual re-selection triggers recalculation | T-025/T-036 | T-036 | verified |
| FR-706 | Batch recalculation with synchronized aggregate/chart refresh | T-036 | T-036 | verified |
| FR-801 | Emission = activity × factor in kgCO2e; 10 known-answer calcs 100% | T-029 | T-030 | verified |
| FR-802 | Aggregation by scope, category, supplier, month | T-029 | T-030 | verified |
| FR-803 | Top emitters list default Top 10, descending | T-029 | T-030 | verified |
| FR-804 | Every conversion/GWP adjustment/multiplication in audit trail, viewable | T-029 | T-039 | verified |
| FR-805 | Total = sum of parts exactly at 3-decimal display precision | T-029 | T-030 | verified |
| FR-901 | Three scenarios auto-computable without user input | T-031 | T-032 | verified |
| FR-902 | Absolute and percentage reductions vs baseline on same screen | T-031 | T-032 | verified |
| FR-903 | Feasibility analysis ≥80 English words per scenario with assumptions | T-031 | T-032 | verified |
| FR-904 | Adjustable replacement-ratio parameter with live refresh | T-031 | T-032 | verified |
| FR-1001 | Report follows the 10-chapter structure in order | T-033 | T-033 | in_progress |
| FR-1002 | Every numeric conclusion has a citation anchor; 100% coverage, 0 invalid | T-033 | T-034 | in_progress |
| FR-1003 | PDF export with header, page numbers, TOC; ≥6 pages | T-035 | T-035 | verified |
| FR-1004 | CSV export: activity detail + category summary files, no encoding issues | T-035 | T-035 | verified |
| FR-1005 | Cover carries GWP version statement and factor year distribution | T-033 | T-033 | verified |
| FR-1006 | Disclaimer: tool output is not an audit or legal opinion | T-033 | T-033 | verified |
| FR-1101 | Review queue sorted by uncertainty (high first) | T-036 | T-036 | verified |
| FR-1102 | Edit quantity/unit/transport/locations + fill missing required fields; recalc on save | T-036 | T-036 | verified |
| FR-1103 | Manual factor override labeled "manually assigned", higher priority | T-036 | T-036 | verified |
| FR-1104 | Exclude-from-accounting mark with English reason; excluded list in report | T-036 | T-036 | verified |
| FR-1105 | Review actions logged with operator and timestamp in audit trail | T-036 | T-036 | verified |
| FR-1201 | Real-time processing visualization: stage, completed count, per-file status | T-038 | T-042/T-044 | verified |
| FR-1202 | Per-AI-call trace: input/output summaries, latency, usage estimate, filterable | T-014 | T-041 | verified |
| FR-1203 | One-click demo dataset load, full flow to report within 3 minutes | T-010/T-038 | T-044 | in_progress |

## Non-Functional Requirements (21)

| ID | Requirement summary | Verification task | Status |
|---|---|---|---|
| NFR-101 | 20-document end-to-end P90 ≤3 min (10 runs) | T-044 | in_progress |
| NFR-102 | AI cost per document ≤$0.03 | T-045 | in_progress |
| NFR-103 | First-screen load ≤3 s (5-run average) | T-045 | in_progress |
| NFR-104 | Report PDF export ≤10 s (5 consecutive) | T-035/T-045 | in_progress |
| NFR-105 | 3 concurrent tasks without request failures | T-045 | in_progress |
| NFR-201 | Single-file failure never blocks the batch (17/20 succeed with 3 corrupt) | T-046 | verified |
| NFR-202 | AI timeout retried twice, then explicit failure marking (file/record) | T-046 | verified |
| NFR-203 | Page refresh preserves progress and completed data | T-042 | in_progress |
| NFR-204 | All failures produce machine-readable error codes + English descriptions | T-046 | verified |
| NFR-301 | Uploaded files inaccessible across tasks/users | T-046 | in_progress |
| NFR-302 | User data never used for model training (README declaration) | T-049 | verified |
| NFR-303 | Public demo URL has basic rate limiting | T-043/T-046 | in_progress |
| NFR-304 | No production secrets hardcoded (code scan) | T-002/T-043 | verified |
| NFR-401 | Main screen self-explanatory within 5 s (first-time user) | T-042/T-050 | in_progress |
| NFR-402 | All site copy in English, no grammar errors | T-042/T-049 | in_progress |
| NFR-403 | Keyboard navigation; main flow completable keyboard-only | T-042 | in_progress |
| NFR-404 | Color never sole information carrier; outline icons for levels | T-039/T-042 | in_progress |
| NFR-501 | Factor library decoupled from code; add factors with zero code change | T-048 | verified |
| NFR-502 | Model selection centralized in config; swap by config only | T-048 | verified |
| NFR-503 | All service parameters overridable via environment variables | T-002 | verified |
| NFR-504 | Self-developed code ≤7,000 target, <10,000 hard cap | T-048 | verified |

## AI Constraints (13)

| ID | Requirement summary | Verification task | Status |
|---|---|---|---|
| AI-101 | Structured output mode for all generative calls; no free-text parsing | T-014 onwards | verified |
| AI-102 | Closed-set enum validation; invalid values retry, never silently pass | T-014 onwards | verified |
| AI-103 | Every call carries a source identifier for traceability | T-014 | verified |
| AI-104 | Model-returned numeric fields carry 0–1 confidence | T-016 | verified |
| AI-105 | All user-visible model text in English | T-014 onwards | verified |
| AI-106 | Every call logs latency and usage estimate | T-014 | verified |
| AI-201 | Every numeric report conclusion has ≥1 citation anchor (100% coverage) | T-033 | verified |
| AI-202 | Anchors point to genuinely existing documents/factors (5 injected invalid detected) | T-033 | verified |
| AI-203 | No un-cited carry-over or stitched inference values | T-033 | verified |
| AI-204 | Factor id outside candidate list = call failure + retry, never used directly | T-025 | verified |
| AI-301 | Unit-consistency self-check per match; results visible; Golden 100% pass | T-027/T-028 | verified |
| AI-302 | Self-check failure auto-downgrades to high uncertainty + review queue | T-027 | verified |
| AI-303 | Self-check result shown as explicit UI field, never implicit | T-027/T-039 | verified |

## Evaluation Tool Requirements (6)

| ID | Requirement summary | Verification task | Status |
|---|---|---|---|
| EV-1 | Single complete table: metric, target, measured, pass/fail columns | T-004 | verified |
| EV-2 | Pass column only 达标/未达标-style binary values (PASS/FAIL) | T-004 | verified |
| EV-3 | Summary row: passed count, failed count, overall PASS/FAIL verdict | T-004 | verified |
| EV-4 | Non-zero invalid references ⇒ overall FAIL (veto) | T-004 | verified |
| EV-5 | Run-all or run-single-metric-group modes | T-004 | verified |
| EV-6 | Machine-readable result file + human-readable summary | T-004 | verified |

## Compliance — Models & Platform (5)

| ID | Requirement summary | Verification task | Status |
|---|---|---|---|
| M-1 | Gemini/Gemma models for all generative AI; Google Cloud official embeddings | T-047/T-048 | verified |
| M-2 | Agent platform path documented in README if used | T-049 | verified |
| M-3 | Deployed on Cloud Run (backend) + Firebase (frontend, Firestore, Storage, Auth) | T-043 | verified |
| M-4 | Deep use of Google Cloud AI toolchain (structured output, batch, autoscale) | T-049 | verified |
| M-5 | Running prototype, publicly accessible, anonymous judge can complete full flow | T-043/T-044 | in_progress |

## Compliance — Deliverables (5)

| ID | Requirement summary | Verification task | Status |
|---|---|---|---|
| D-1 | English proposal deck PDF, 10–14 pages | T-051 (draft) / manual | in_progress |
| D-2 | Runnable functional prototype, public URL | T-043 | in_progress |
| D-3 | 3-minute demo video, public link, English voice+subtitles | T-051 (script) / manual | in_progress |
| D-4 | Complete English README (architecture, deployment, evaluation) | T-049 | verified |
| D-5 | Track declared in three places (deck cover, README top, video end) | T-051 | verified |

## Compliance — Language (3)

| ID | Requirement summary | Verification task | Status |
|---|---|---|---|
| L-1 | All submissions in English incl. comments, README, deck, video, UI | T-042/T-050 | in_progress |
| L-2 | Product UI copy in English | T-038 onwards | verified |
| L-3 | Generated report body in English | T-033 | verified |
