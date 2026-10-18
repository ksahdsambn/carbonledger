# CarbonLedger Project Comprehensive Review and Remediation Audit Brief

> **Recipient**: AI developer (executes independently, no prior context on this project by default)
> **Project**: CarbonLedger — a Scope 3 carbon accounting and disclosure agent (an entry in the AI Builder Cup 2026)
> **Overall goal**: perform a systematic, comprehensive review of the entire codebase, find and fix all bugs, security vulnerabilities, and other issues that should be resolved; the fixes must not introduce any regressions; in the end every acceptance check in Chapter 9 of this document must pass item by item, and a complete record of the review and remediation must be delivered.
> **Execution**: follow the phases and steps of this audit brief strictly in order; do not skip steps, do not omit records, and do not stop early while acceptance is not fully green.

---

## 1. Task Overview and Execution Flow

The task has five phases, executed in sequence, each with clear entry conditions, deliverables, and completion criteria:

| Phase | Name | Core actions | Deliverables |
|---|---|---|---|
| Phase 1 | Environment preparation and baseline establishment | Install dependencies, get every existing command working, record baseline data | Baseline record (test count, line counts, results of each command) |
| Phase 2 | Domain-by-domain systematic review | Review every file and every interface across the eight domains, verify all open questions in Appendix A, register all defects | Defect register (including newly found issues) |
| Phase 3 | Remediation | Fix items one by one by priority, each fix paired with regression verification | Code fixes + new regression tests |
| Phase 4 | Acceptance | Run the automated acceptance battery + targeted acceptance scenarios + a second review pass | Acceptance record (item-by-item results) |
| Phase 5 | Delivery | Consolidate the report, update documentation and the progress log | Remediation report, updated README and progress log |

**Three iron rules that apply throughout the entire process**:

1. **Register before fixing**: before modifying any code for a defect, the defect must first be written into the defect register (format in 2.1); defects that are not registered must not be fixed directly in code.
2. **Every fix must be verified**: every fix must come with a repeatable verification method (a new regression test, a verification script, or manual steps); manual verification is allowed only when a fix cannot be verified automatically, and evidence must be left in the register.
3. **Failing acceptance does not count as complete**: if any item in the Chapter 9 checklist does not pass, the entire task is considered incomplete; you must return to Phase 2 or Phase 3 and continue. Passing with known defects under the label of "known issue" is forbidden.

---

## 2. Project Quick Start (must be read before execution)

### 2.1 Project positioning

CarbonLedger compresses the production cost of a corporate Scope 3 carbon emissions report from "RMB 30,000 + 3 weeks" to "1 hour + near-zero marginal cost". Users upload mixed-format evidence documents (PDFs including scanned pages, photos, XLSX, CSV), and the agent performs page classification, activity data extraction, unit and location normalization, GHG Protocol boundary determination, semantic matching of public emission factors, uncertainty grading, Scope 1/2/3 accounting, and construction of three reduction scenarios, ultimately producing a ten-chapter English report (PDF/CSV export) and a complete audit trail.

### 2.2 Architecture and runtime shape

- **Frontend**: a React (Vite) single-page application with nine pages (P1 Tasks, P2 Upload, P3 Activity Records, P4 Match Viewer, P5 Dashboard, P6 Scenarios, P7 Report Reading, P8 Review Queue, P9 AI Traces), hash routing, deployed on Firebase Hosting.
- **Backend**: Node.js (Express), deployed on Cloud Run (CPU always on, can scale to zero). The storage abstraction layer selects Firebase Storage + Firestore in production, and local adapters in development/testing/offline evaluation; the task queue abstraction currently has only an in-process implementation, the cloud queue adapter is still a deployment-time placeholder that reports an explicit error when called, and the server currently actually executes the pipeline inline, so the entire queue abstraction is unused by the server (corresponds to open question R-17).
- **AI layer**: all generative calls go through a unified wrapper that enforces structured output, closed-set validation with retries, and configuration-driven timeouts and retry counts, and writes every call (input/output summary, latency, token, cost) into the ai_traces collection.
- **Identity**: entering the site automatically completes a Firebase anonymous sign-in; the SPA carries an ID token on every request, and the backend uses the uid as the task owner after validation. **Requests without a token are allowed but the task has no owner** — this is intentional, for scripts and offline runs, and this semantics must be preserved during security fixes (see the design decision in 6.3).
- **Factor library**: 741 factors from public sources, loaded from a static JSON file, with dual-channel recall (keyword + semantic vector).
- **Model policy**: a mandatory single-model policy: generative tasks may only use `gemini-3.5-flash-lite`, embeddings may only use `gemini-embedding-001`, intercepted by `AI_MODEL_ALLOWLIST` before requests are sent.

### 2.3 Directory map

- `backend/src` — all backend source code: entry point `server.js`; `config.js` the configuration hub; `errors.js` the error code registry; `ai/client.js` the unified AI client; `services/` eighteen business modules (pipeline, classification, extraction, normalization, boundary, recall, accounting, scenarios, report, review, export, files, tasks, tracing, etc.); `store/` local/Firestore data adapters; `storage/` local/Firebase object storage adapters; `queue/` the task queue abstraction.
- `backend/test` — eleven test files, 33 test cases in total at present.
- `frontend/src` — all frontend source code: `App.jsx` routing, `pages.jsx` the nine pages, `api.js` the request wrapper, `auth.js` anonymous authentication.
- `data/factors` — the 741-factor library and source notes; `data/golden` — the standard dataset of 30 annotated documents + 40 matching cases; `data/demo` — the one-click demo dataset (20 documents); `data/sources` — raw material for building the factor library.
- `scripts/` — build/test/smoke/secret scanning/line count scripts, plus several verification scripts (the verify_ family).
- `eval/` — offline evaluation tool, 11 metric groups.
- `progress/` — execution log and evidence (working language Chinese); `deploy/` — deployment notes (currently just one README placeholder).
- In the root directory, `IMPLEMENTATION_PLAN.md` (task numbers T-001…T-051, gates G0…G6) and `PRD_CarbonLedger_Scope3_Carbon_Agent.md` (requirement numbers FR-/NFR-/AI-/EV-, with the acceptance checklist in PRD section 10.3).

### 2.4 Common commands (run in the repository root under Git Bash; Node version 20 or higher)

- Install dependencies: `npm install`
- Build (frontend build + backend syntax check): `npm run build`
- All automated tests: `npm test`
- Smoke (startup, health check, graceful shutdown): `npm run smoke`
- Secret scanning: `npm run scan-secrets`
- Line count statistics (NFR-504 budget): `bash scripts/count_lines.sh`
- Start the local API (default port 8080): `node backend/src/server.js`
- Start the frontend dev server (default port 5173, proxies /api to 8080): run `npm run dev` in the `frontend` directory
- Offline evaluation (automatically uses the mock adapter when no key is present): `node eval/run.js`

### 2.5 Core business pipeline (the main thread for understanding defects)

Upload validation and deduplication → PDF split by page into processing units → classification (seven-class closed set) → extraction of activity records (structured output) → unit/location/currency normalization → boundary determination (Scope 1/2/3 and categories) → factor recall (keyword + semantic) → factor selection (with rationale and runner-up) → uncertainty assessment → accounting (including GWP conversion) → audit chain persisted → scenario simulation (S-1/S-2/S-3) → ten-chapter report assembly and citation anchors → manual intervention in the review queue → export (PDF/CSV). The document state machine has seven states: queued, parsing, extracting, matching, completed, needs_review, failed, plus two bypass states: pending_duplicate and discarded.

### 2.6 Existing project policies that must be observed

1. **The single-model policy must not be relaxed**: `AI_MODEL_ALLOWLIST` must not be expanded, and no second generative model may be introduced.
2. **Line count budget (NFR-504)**: measurement basis B (application code + all first-party JS tooling, including backend/test) is currently 6,976 lines against a cap of 7,000 lines, **leaving only about 24 lines of headroom**. New code (including regression tests) must be offset by deleting dead code and duplicated code; if offsetting is genuinely impossible, the over-budget line count and the reason must be recorded in writing in the defect register, and measurement basis C (including the Python toolchain) must be kept under 10,000 lines. Rigging the measurement basis of the statistics script to "pass" is strictly forbidden.
3. **Secret discipline**: the root `.env` and `frontend/.env` contain real secrets (the former a Gemini API Key, the latter a Firebase Web public key). It is **strictly forbidden** to print, copy, or commit the contents of these two files in any output, log, document, or commit; renaming secrets to other variables to bypass scanning is also strictly forbidden. The repository `.gitignore` already ignores them correctly; the ignore rules must not be changed in a way that lets secrets into the repository.
4. **mock mode**: when `GEMINI_API_KEY` is absent, the AI layer automatically degrades to a deterministic mock adapter and the full pipeline can run offline; the default working mode for the review and remediation is mock mode, which depends on no external credentials.
5. **Standard data must not be modified without cause**: `data/golden`, `data/factors`, and `data/demo` are the evaluation baseline and must not be modified unless the data itself is proven wrong.
6. **Style continuity**: code comments are in English, with a style consistent with existing code; the working language of the progress directory is Chinese; no refactoring unrelated to this task.

---

## 3. Execution discipline (in effect throughout)

### 3.1 Defect register

Create a new defect register file under `progress/` (the name is recommended to include the date of this review), with one record per defect and the following fields (recorded as a text form; no specific file format is required):

- **ID**: starting at D-01, incremented sequentially.
- **Source**: the pre-review open question number from Appendix A (e.g. R-03), or "newly found in Phase 2".
- **Severity**: P0 (security vulnerability / data corruption or severe error) / P1 (severe functional defect) / P2 (robustness and quality defect) / P3 (hygiene and low-risk issue).
- **Location**: file path and line number (when line numbers change after the fix, register the pre-fix line number and note this).
- **Description**: what the problem is, what its impact is, and what triggers it.
- **Verification evidence**: reproduction steps or the basis of reasoning (open questions must be verified first; those disproved by verification are registered as "not applicable" and the verification process is retained, not deleted).
- **Fix plan**: one sentence on what to change and why.
- **Verification method**: the corresponding regression test name or acceptance scenario number (Chapter 7, V-xx).
- **Status**: pending fix / fixed / not applicable / intentionally retained (reason required).

### 3.2 Remediation principles

- Minimal change: only modify code directly related to the defect; no opportunistic refactoring, no renaming, no reformatting.
- Behavior preservation: fix the defective behavior itself without changing the external contract of existing correct behavior (interface paths, response structures, and error code semantics remain unchanged; if a change is genuinely required, it must be registered as a separate defect with an explanation of how compatibility is handled).
- One commit per defect, with the commit message referencing the defect ID.
- Run `npm test` immediately after each fix to ensure the existing 33 cases do not fail, then continue to the next item.

### 3.3 Commit conventions

- Make one git commit after completing each phase or batch of similar fixes, with the commit message format: phase or defect number + brief description (e.g. "D-03/D-11: Add missing task ownership validation and new unauthorized-access regression tests").
- Before committing, confirm that `git status` does not contain ignored paths such as `.env`, `frontend/.env`, `frontend/dist`, `data/.local-store`, `data/.uploads`, and `.firebase`.

### 3.4 Red lines (violating any one of these is considered task failure)

1. Do not execute any production deployment commands (gcloud run deploy, firebase deploy, etc.); production environment verification is performed only when the user explicitly provides credentials and requests it.
2. Do not print, transmit, or commit any secret content; do not access external services unrelated to the task.
3. Do not delete, skip, or weaken any assertion in existing tests or verification scripts in order to "make tests pass".
4. Do not modify the measurement basis of statistics scripts, the target values of evaluation metrics, or the decision logic of acceptance scripts to create a false pass.
5. Do not relax the model allowlist, and do not introduce new runtime dependencies (if one is genuinely needed, it must be recorded as a separate decision item with the reason and an assessment of size and security impact).
6. Do not modify `.gitignore` in a way that lets ignored sensitive or generated files into the repository.
7. Acceptance records must truthfully reflect the execution results; a failure is a failure, and fabrication is forbidden.

---

## 4. Phase 1: Environment preparation and baseline establishment

### 4.1 Environment requirements

- Node 20 or higher, npm available; commands are executed under Git Bash (all repository scripts are bash scripts).
- Confirm that `.env` exists in the root directory (do not view or output its contents) and that the frontend build configuration file exists as needed; when either is missing, work in mock form, which does not affect this task.

### 4.2 Baseline commands (execute and record the result of each one)

| No. | Command | Expected result | What to record |
|---|---|---|---|
| B-1 | `npm install` | Success | Whether there are warnings or vulnerability reports |
| B-2 | `npm run build` | Success | Summary of frontend and backend build output |
| B-3 | `npm test` | All pass | **Actual total number of cases, number passed, number failed** (note: the README claims 34 items, the actual source count is 33, so trust the measured value and register the difference as a documentation defect) |
| B-4 | `npm run smoke` | Outputs the smoke success flag | Key points of the startup and shutdown logs |
| B-5 | `npm run scan-secrets` | Zero hits, exit code 0 | Number of hits |
| B-6 | `bash scripts/count_lines.sh` | NFR-504 verdict PASS | Line counts for the three bases (note the basis B value, which is the remaining budget for later new code) |
| B-7 | `node backend/src/server.js`, then open another terminal to access the health check endpoint, then Ctrl+C | Normal response, clean process exit | Port and result |
| B-8 | `node eval/run.js` | In mock mode, all 11 metric groups collected completely (values differing from live measurements is normal) | Whether the result file for each metric group was generated |

If any baseline command fails: register it as a defect first, then continue (a baseline failure means the repository is already in a broken state; it is not permitted to skip a failure by treating it as "the environment is just like this").

**Additional prohibition (in effect for the baseline and throughout)**: in an environment where no real model key is set, it is strictly forbidden to run the five real-adapter verification scripts (classification, extraction, boundary, factor selection, report) — four of them have no key precondition guard, and running them will overwrite the official metric evidence files with mock results (corresponds to open question R-23). The offline evaluation entry point itself only aggregates existing result files and does not overwrite them, so it can be run safely.

### 4.3 Baseline snapshot

Organize the results of B-1 through B-8 into a baseline snapshot and store it in the progress directory; all subsequent "no regression" judgments use this snapshot as the reference.

---

## 5. Phase 2: Domain-by-domain systematic review

**General requirements**: for each domain, first read all files in that domain, then check each checkpoint item one by one, and finally verify each open question assigned to that domain in Appendix A. All review output goes into the defect register. The checkpoint list is "minimum coverage"; the review must not stop at the list — problems found outside the list are registered as well.

### 5.1 Domain A: Security review (highest priority)

**Scope**: `backend/src/server.js`, `backend/src/services/fileService.js`, `backend/src/services/reviewQueue.js`, `backend/src/services/taskService.js`, `backend/src/storage/index.js`, `backend/src/ai/client.js`, `backend/src/services/exportService.js`, `frontend/src/auth.js`, `frontend/src/api.js`.

**Checkpoints**:

1. **Ownership and unauthorized access (corresponds to NFR-301)**: for each HTTP interface, answer one by one "who can call it and whose data it can read/write". Focus: task details, document list, document download, duplicate resolution, status modification, triggering a run, dashboard, report reading, report export, all review actions, audit viewing, AI trace query — confirm one by one whether an ownership check exists; where it does not, determine the fix approach according to the design decision in 6.3. Verify open questions R-03, R-11.
2. **Path traversal**: trace the full chain of the uploaded file name from the HTTP multipart form to the storage key, confirming that `../` and backslash variants, absolute paths, and special characters cannot escape the storage root directory; the read/write paths of the local storage adapter must perform containment validation. Verify R-04.
3. **Upload resource consumption**: whether the upload middleware is configured with limits on single file size, number of files per request, and total request body; whether oversized files are rejected before being fully buffered into memory; whether there are defenses against parsing bombs (PDF decompression amplification, XLSX as a ZIP bomb), or at least a record of the danger level. Verify R-09, R-20.
4. **Injection**: formula injection in CSV export (cell values starting with an equals sign, plus sign, minus sign, or @ are executed in spreadsheet software) must be neutralized; confirm there is no command execution and no dynamic code evaluation; confirm the HTML frontend has no rendering path that injects directly into the DOM. Verify R-08.
5. **Data exposure in AI traces**: whether the input summaries in trace records contain base64 fragments of uploaded documents, and whether error messages contain upstream service response bodies; combined with the unauthorized access problem, this interface amounts to exposing raw document fragments publicly. Verify R-05.
6. **CORS and rate limiting**: whether the origin allowlist is too broad (is it reasonable to allow any Firebase domain); whether a malformed Origin header causes an uncaught exception; what it means that the rate limiting key is taken from a client-forgeable forwarding header, and whether the bucket dictionary grows without bound; whether an illegally configured rate limit threshold disables the limiter or makes it crash. Verify R-10, R-32.
7. **Authentication implementation**: the storage location and lifecycle of frontend tokens (the risk of a long-lived refresh token in local storage), and the impact of silently degrading to a new anonymous identity on refresh failure; the combined risk of the backend's alert-and-allow strategy on token validation failure combined with missing ownership checks, all to be closed out in the R-03 fix.
8. **Response headers and caching**: whether no-cache headers for dynamic APIs cover all routes; whether static hosting lacks security response headers (see Domain F).
9. **Information disclosure**: whether error responses leak internal details; whether logs print sensitive values; whether the configuration query interface only echoes non-secret configuration (currently correct, confirm it is not broken).

### 5.2 Domain B: Business correctness review

**Scope**: all modules in `backend/src/services/`, with emphasis on pipeline.js, pipelineModelCalls.js, calculation.js, scenarios.js, reportService.js, normalization.js, uncertainty.js, documentUnits.js, and reviewQueue.js.

**Checkpoints**:

1. **Document state machine**: cross-check the seven-state transition table against all call sites and find illegal transitions (especially repeatedly setting the same state inside a loop, concurrent re-runs, and the recalculation path after review). Verify R-01.
2. **Multi-page document full flow**: the current demo set and most tests use only single-page documents, so multi-page PDFs are the largest untested path; trace every step of a multi-unit document from splitting to per-unit processing to state advancement. Verify R-01.
3. **Numeric robustness**: search the whole chain for possible entry points where non-finite values (non-numeric, infinite, numeric strings) enter quantities: model extraction validation, normalization conversion, review edit patches, accounting bases; once they enter, how they spread in aggregation, sorting, and reports. Verify R-12, R-16.
4. **Isolation of scenarios from the official ledger**: whether scenario recalculation reuses accounting functions that persist to the database, thereby overwriting baseline accounting records and audit records; whether report lazy generation, export, and report rebuilding after review read scenario values as baseline values. Verify R-02, R-28.
5. **Report values and citation anchors**: verify the unit conversion of anchor values (kilograms and tonnes) in each place; whether the citation scan performs an existence check on scenario-type anchors or judges validity purely by the shape of the identifier. Verify R-07, R-14.
6. **Aggregation and rounding consistency**: the boundaries of the display-consistent allocation algorithm (empty set, single element, negative values, extreme values); whether totals and details are always rebuilt after a review change; whether stale accounting results of excluded records remain. Verify R-28.
7. **Normalization rules**: the order and mutual exclusivity of currency recognition regexes, re-validation of already normalized input, and the defense of conversions against illegal types. Verify R-19.
8. **Duplicate detection**: the concurrency window of content-hash deduplication, and an impact assessment of missed detection when deduplication occurs before normalization, causing synonymous but differently written entries to slip through. Verify R-27.
9. **Document counting and parsing**: the accuracy of PDF page counting with a raw byte regex, and which downstream judgments use it. Verify R-21.
10. **Export**: error paths in PDF generation (whether a generator exception causes the request to hang), whether table row truncation is disclosed, and division by zero when the header is empty. Verify R-22.
11. **Task creation input validation**: type, length, and ordering validation of fields such as the task entity name and reporting period start and end (currently only shallow validation). Verify R-29.
12. **Dead code and dead branches**: empty loops in the report service, dead branches in the tracing service, the unused queue abstraction, etc.; confirm one by one that there are no references, then register them as recovery candidates for offsetting the line count budget. Verify R-17, R-31.

### 5.3 Domain C: Frontend functionality review

**Scope**: all five source files in `frontend/src` (application entry, routing, page collection, request wrapper, authentication module) and the style files.

**Checkpoints**:

1. **Data sources of the P3 Activity Records page and the P4 Match Viewer**: whether the field names used by the two pages to fetch the record list from the task details interface match the actual response structure of that interface (note that the backend returns a task and document list, with no record fields); if they do not match, these two pages will always be empty, which is currently the most severe functional UI defect. Verify R-06.
2. **P6 Scenarios page**: whether the replacement ratio slider value is actually passed to the backend; whether it is reasonable to trigger a full pipeline re-run on blur. Verify R-25.
3. **Request layer and authentication storage**: whether the upload path checks the response status; the request header override issue; the impact of no timeout control on all interfaces; go through the pages one by one where errors are silently swallowed, causing no UI feedback; the local storage location of the long-lived refresh token and the session mismatch risk of silently degrading to a new anonymous identity on refresh failure. Verify R-33.
4. **URL construction**: whether database identifiers are encoded when directly concatenated into links and query strings; the issue that the local development proxy does not cover the factor query interface. Verify R-26.
5. **Interaction completeness**: P1 create task → P2 upload/one-click demo → walk through P3 to P9 page by page (Chapter 7, V-10, has the complete script), and record all problems of backend contract mismatches, misleading empty states, and invisible errors.
6. **Local storage**: the local storage keys, lifecycle, and error recovery for task identifiers and authentication information (the behavior of each page when an identifier points to a task that has already been cleaned up).

### 5.4 Domain D: Data storage and adapter review

**Scope**: `backend/src/store/index.js`, `backend/src/store/firestore.js`, `backend/src/storage/index.js`, `backend/src/queue/index.js`.

**Checkpoints**:

1. Persistence atomicity of local file storage (crash halfway through a write, concurrent whole-file rewrites, last write wins), and the risk and missing warning of silently resetting a collection file to empty when parsing fails. Verify R-15.
2. Behavioral differences between the local adapter and the production adapter: undefined value queries, document ordering, pagination; a concrete list of differences leading to "all local tests pass, but production behavior differs". Verify R-30.
3. The queue abstraction is currently unused by the server: after confirming this, decide between "fixing its double-dispatch defect" and "removing it as dead code" (removal can recover line count budget); choose one and register the decision.
4. The valid character set and containment validation of storage keys (coordinated with path traversal in Domain A).

### 5.5 Domain E: Concurrency, fault tolerance, and AI client review

**Scope**: `backend/src/ai/client.js`, `backend/src/services/pipeline.js`, `backend/src/services/taskRuns.js`, `backend/src/services/recall.js`.

**Checkpoints**:

1. Model call retry strategy: whether fatal errors (such as authentication failure, illegal request) are retried needlessly; the impact of missing backoff and jitter; the behavior when the retry count is configured to an illegal value. Verify R-13.
2. Embedding batch calls: the consequences of having no timeout, no retries, and silently accepting and writing bad indexes when the number of response vectors is fewer than the number of inputs. Verify R-18.
3. Pipeline concurrency parameters: the problem that illegal environment variable values lead to a concurrency of zero and the pipeline silently running empty; the concurrency semantics of triggering two runs for the same task (whether single-flight waiting is sufficient). Verify R-13.
4. Extraction result validator: type and finiteness validation gaps in quantity fields. Verify R-12.
5. Prompt injection surface: the risk of user- and model-controllable text (product names, locations, supplier names) being directly concatenated into prompts must at least be handled with "identify + document" (record the attack surface and mitigation suggestions in text in the register; if a code mitigation is made, extraction accuracy must not regress).
6. Observability of background task failures: the eventual consistency of task and document statuses after an asynchronous pipeline failure (whether a failure always ends up persisted as a readable status).

### 5.6 Domain F: Configuration and deployment review

**Scope**: `backend/src/config.js`, `Dockerfile`, `firebase.json`, `.firebaserc`, `.gcloudignore`, `.gitignore`, `deploy/`.

**Checkpoints**:

1. Configuration parsing: a list of integer and float items that take effect without validation for illegal values (non-numeric, negative, zero, out of range), and the consequences. Verify R-13.
2. Container: missing health check instruction; whether data directories needed only by offline tools have been mixed into the image (assess size and attack surface); keep the current state of running as non-root.
3. Hosting configuration: missing security response headers (content security policy, strict transport security, frame protection, sniffing protection); the relationship between API path rewrites and the health check path; the consistency between the cache policy and the API no-cache headers. Verify R-24.
4. Secret injection method: the gap between injecting runtime secrets as plaintext environment variables and using a secret management service; at minimum, document the improvement path (implementation is not required this time unless it is zero risk).
5. Ignore rules: whether `.gcloudignore` and `.gitignore` have gaps in covering sensitive files and generated artifacts; three compiled cache files under `scripts/golden/__pycache__` are already tracked by git, which is a repository hygiene issue — tracking should be removed and the ignore rules made effective (compiled caches are not counted in line count statistics; this fix is directory hygiene and does not change the budget balance).
6. The consistency of the `deploy/` directory placeholder content with the actual deployment method.

### 5.7 Domain G: Test and verification system review

**Scope**: all of `backend/test/`, `scripts/verify_*.js`, `scripts/test.sh`, `eval/`.

**Checkpoints**:

1. Of the five verification scripts that depend on a real key (classification, extraction, boundary, factor selection, report), four lack the precondition guard of "refuse to execute without a key" (only the classification script has one), and running without a key will overwrite the official metric evidence files with mock results; the evaluation collector blindly trusts the "pass" field of result files and does not validate the adapter source. Verify R-23.
2. Secret scanning only scans repository tracked files — this is correct for "preventing secrets from entering the repository", but it must be confirmed that the pre-commit defenses are complete (for example, whether there is a mechanism that can stop "accidentally adding .env to the staging area"); improvements must not cause false positives on legitimate local secret files.
3. Test coverage gaps against Phase 2 findings: multi-page documents, scenario isolation, interface ownership, path traversal, formula injection, report anchor values, non-finite value defenses — when fixing these defects, the corresponding regression tests must be added (counted against the line count budget, see 2.6).
4. The discrepancy between the actual test count and the count claimed in the README (34 vs 33) is registered as a documentation defect.
5. Whether the exit-code contract (0/1/2) of each verification script is correctly consumed by its callers.

### 5.8 Domain H: Documentation and Repository Hygiene Review

**Scope**: `README.md`, `progress/PROGRESS_SUMMARY.md`, `progress/DEFECT_REPORT_T050.md`, `eval/README.md`, `data/README.md`, `deploy/README.md`.

**Checkpoints**:

1. Reconcile the commands, environment-variable table, error-code list, and metrics table in the README one by one against the actual post-fix behavior (test counts, line counts, and metric definitions will change because of this fix round; the README must be updated accordingly and must not overstate).
2. For the consistency issues that the existing defect report (T-050) claims are already fixed, confirm that its fix approach still holds after this fix round (especially scenario isolation).
3. Repository hygiene: tracked compilation caches, empty-directory placeholders, leftover generated artifacts.

---

## 6. Phase Three: Fix Execution

### 6.1 Priority and Order

Execute in order of registry severity: all P0 → all P1 → all P2 → P3 as budget and time permit (P3 items may be registered as "intentionally retained" with justification, but every one must receive an explicit decision and none may be omitted from the record). Within the same severity, fix first whatever blocks other fixes (for example, owner middleware before the per-endpoint regression tests).

### 6.2 Closed Loop for Each Defect

Verify (reproduce or prove by reasoning) → finalize the registry description and approach → implement the minimal fix → add or adjust regression verification → run `npm test` and `npm run build` → update the registry status. Mixing fixes for multiple unrelated defects in the same commit is **forbidden**.

### 6.3 Key Design Decisions (established positions for the fix; do not invent alternatives)

1. **Compatibility position for owner verification (R-03 class)**: The project intentionally allows "tokenless requests to access ownerless tasks" (scripts, offline evaluation, and public demos all depend on this semantics). The fix position is therefore **conditional enforcement**: if and only if the task record has an owner, any request that is not from that owner (whether carrying a wrong token or no token) is rejected; ownerless tasks stay open as before. The task identifiers exposed in `progress/evidence` all come from ownerless one-click demo tasks, and these scripts must remain usable after the tightening — this is a direct test of fix correctness. The review-queue actions (edit field, assign factor, exclude, close) must likewise gain the dual check of "the record belongs to this task + the task's owner". The token verification component must be implemented in a replaceable way so that unit tests can inject a mock identity without depending on real Firebase credentials; the current behavior of "verification failure degrades to anonymous" when no credentials exist locally is retained, but its semantics when combined with conditional enforcement (owner-bearing tasks reject anonymous requests) must be covered by tests.
2. **Scenario isolation position (R-02 class)**: Scenario recalculation must not write to the official ledger. The fix direction is to let the calculation function support a "compute-only, no persistence" mode for scenario reuse, leaving the official path's behavior unchanged; historical data polluted by scenarios will not be migrated (demo-environment data can be rebuilt), but this must be stated explicitly in the fix notes.
3. **State-machine position (R-01 class)**: In multi-unit document processing, state advancement is at "document level" — entry into the extraction state may happen only once. The fix may adopt any of the following: allow self-transitions, move the state assignment out of the unit loop, or count first and advance once; but it must guarantee idempotent repeated runs, retry from the queue state after failure, and no illegal transition triggered by the post-review recalculation path.
4. **Line-budget offset**: Candidate items for reclamation include the unused queue abstraction, the empty loop and dead branches in the report service, the dead code in the traceability service, and other dead code confirmed in Phase Two; reclamation must be premised on "confirmed no references".
5. **New security regression tests** should preferentially go into existing test files (sharing existing fixtures and imports, saving the most lines), with test names corresponding to defect IDs for traceability.

---

## 7. Phase Four: Acceptance (all items must pass before entering Phase Five)

### 7.1 Automated Acceptance Battery (execute item by item, record results item by item)

| No. | Command/Action | Pass Criteria |
|---|---|---|
| A-1 | `npm run build` | Succeeds, no errors |
| A-2 | `npm test` | All pass; test-case count no less than the baseline B-3 count, and includes the regression tests added this round |
| A-3 | `npm run smoke` | Smoke-success marker appears |
| A-4 | `npm run scan-secrets` | Exit code 0, zero hits |
| A-5 | `bash scripts/count_lines.sh` | NFR-504 verdict PASS (count basis B not over 7,000; any overage must already be documented in writing in the registry and accepted) |
| A-6 | `node eval/run.js` | All 11 metric groups collected completely in mock mode, with no abnormal interruption; compared with baseline B-8, no change in metric definitions |
| A-7 | `git status` | Clean; no sensitive files or generated artifacts in the staging area |

### 7.2 Targeted Acceptance Scenarios (execute item by item and retain evidence; each must be run with the local service running in mock mode, and manual items involving the UI are completed in a browser. **All scenarios are by default executed only against the local service; it is strictly forbidden to perform destructive verification such as injection, traversal, rate-limit testing, or corrupted files against the public deployment**; public-deployment verification is performed only when the user explicitly requests it)

- **V-01 Multi-page document full flow**: Obtain or construct a multi-page PDF (the standard dataset already contains multi-page documents, e.g. the four-page GD-09, which can be used directly; alternatively, construct one with the repository's own dataset generation tool), upload it, and run the pipeline; pass criteria: the document's final state is completed (or needs_review due to low confidence, but not failed), activity records exist for every page, and there is no whole-document failure caused by an illegal state-machine transition. This scenario must also be solidified as an automated regression test.
- **V-02 Authorization matrix**: For all task-level endpoints (task detail, document list, file download, report read, report export, dashboard, the four review actions, audit view, AI tracing, trigger run), verify each of the three identities one by one — no token, wrong token, correct-owner token — against tasks that **have an owner**; pass criteria: the first two are all rejected with semantically appropriate error codes, and the third all succeed; additionally verify that **ownerless** tasks remain accessible to all three identities (for script and demo compatibility). Execution note: token verification depends on Firebase admin credentials; when these are absent locally, the "correct owner" side may be verified at the test layer by injecting a mock identity through the replaceable token verifier; ownerless tasks created by the one-click demo loading endpoint must remain available to anonymous visitors.
- **V-03 Path traversal**: Upload files whose names contain path-traversal fragments, backslash variants, and absolute-path fragments respectively; pass criteria: all are handled safely (rejected or normalized), no new files exist outside the storage root, and a before/after directory-tree comparison is retained as evidence.
- **V-04 Scenario isolation**: For the same task, first run the baseline and generate a report, recording the baseline total and per-item calculated values; trigger the three scenarios; then read the report and export again; pass criteria: the baseline values are exactly the same as before the scenarios, the official calculation collection and audit records are not overwritten by scenarios, and the scenario endpoints themselves return correct values; solidify as an automated regression test.
- **V-05 Report anchor values**: Take any generated report and check that the scope-breakdown anchor values match the dashboard aggregate values (unit: tonnes, equal item by item); together with the per-record anchors, solidify as an automated regression test.
- **V-06 CSV formula injection**: Construct records whose product names start with formula trigger characters (they can be written through the review edit endpoint), and export both CSV types; pass criteria: dangerous prefixes are neutralized, the files are safe under spreadsheet-software semantics, and normal field contents and column structure are not damaged; solidify as an automated regression test.
- **V-07 Numeric defense line**: Inject non-numeric, infinite, zero, and negative quantities through the review edit endpoint and the mock extraction path respectively; pass criteria: all are rejected or safely degraded (routed to review instead of being persisted), and no non-finite value appears anywhere in the ledger, aggregates, or reports; solidify as an automated regression test.
- **V-08 Concurrent runs**: Trigger a run twice in a row for the same task while report polling is in progress; pass criteria: only one consistent report is ultimately produced, and the report values match a ledger recalculation (the repository's built-in consistency verification script points to a public address by default; it can be redirected to the local service via its supported base-address environment variable before execution; if not applicable, perform an equivalent manual check and record it in the registry).
- **V-09 Rate limiting and origin protection (local service only)**: Requests at above-threshold frequency receive rate-limit responses; forged forwarding headers can no longer reset the rate-limit bucket; non-whitelisted origins receive no CORS headers; malformed origin headers do not cause server errors.
- **V-10 Full UI walkthrough (manual)**: Start the local backend and frontend dev servers, then complete in order: P1 create task → P2 one-click load demo data and wait for completion → P3 the record table is **non-empty** and can expand details and audit → P4 enter the matching viewer from a record and complete one manual factor assignment → P5 dashboard values display → P6 view the three scenarios (slider behavior matches the post-fix design) → P7 the ten report chapters display, and the PDF and both CSV downloads succeed with correct content → P8 execute one edit/exclusion in the review queue and confirm the report refreshes → P9 the AI tracing list is visible. Retain a screenshot or written evidence for each page; any blank page, error, or silent failure is a fail.
- **V-11 Upload defenses**: Empty files, disguised extensions, corrupted files, oversized files, and batches exceeding the per-request file-count limit — each path's behavior matches error-code semantics; oversized requests must not be fully buffered into memory first (verify that the middleware limit configuration is in effect).
- **V-12 Embedding-batch defense**: Simulate an embedding endpoint response that returns fewer vectors than inputs; pass criteria: the client retries or fails explicitly, and missing vectors are not written to the index (implemented with a unit test that simulates the response).
- **V-13 Documentation reconciliation**: The README's commands, environment-variable table, error codes, test counts, line counts, and metric descriptions have all been reconciled and revised against reality.
- **V-14 Registry closure**: The registry contains no entry that is in "to be fixed" status without a decision note; every "fixed" entry cites a passing verification method; every "not substantiated / intentionally retained" entry includes a justification.

### 7.3 No-Regression Confirmation

- All 33 baseline test cases still pass; all newly added regression tests pass.
- For the demo dataset end-to-end (mock mode), the record count, chapter count, and citation coverage match the baseline.
- All parts of the existing verification scripts that do not depend on secrets or the public network remain runnable and their conclusions do not degrade.

### 7.4 Second Review

After all fixes are complete, run one review round with the same perspective as Phase Two (the review order may be changed, e.g. by file instead of by domain), specifically looking for: new problems introduced by the fixes themselves, interactions between fixes, and similar problems missed outside the registry. Issues found in the second review are handled through the same closed loop until there are zero new additions. Finally, go through Appendix A item by item, naming and confirming the final disposition of each suspicion (fixed / not substantiated / intentionally retained), ensuring none is left hanging.

---

## 8. Phase Five: Deliverables

1. **Defect registry** (progress directory): all entries closed, including second-review results.
2. **Fix report** (progress directory, in Chinese): review scope and method, defect statistics (by severity and domain), a summary of each fix, the line-budget offset explanation, unimplemented items and reasons, and deployment notes for production (explanation only; do not perform deployment).
3. **Updated README**: consistent with actual behavior (including revisions to test counts, line counts, and metric definitions).
4. **Acceptance record** (progress directory): the actual result and evidence-retention note for each item in 7.1 and 7.2.
5. **git commit sequence**: per the 3.3 specification, with a clean working tree at the end.

---

## 9. Final Acceptance Checklist (the task is complete only after every item is checked)

- [ ] The Phase One baseline snapshot is archived, with records for all of B-1 through B-8
- [ ] All suspicions in Appendix A (R-01 through R-33) have been verified item by item and their dispositions registered
- [ ] All checkpoints of the eight domains have been completed, and all new findings are registered
- [ ] All P0 defects are fixed and each has a passing regression verification
- [ ] All P1 defects are fixed and each has a passing regression verification
- [ ] P2 defects are fixed or have a recorded disposition decision
- [ ] Every P3 defect has an explicit decision (fix or retention justification)
- [ ] A-1 through A-7 automated acceptance all green
- [ ] V-01 through V-14 targeted acceptance all pass with evidence retained
- [ ] The second review is complete with zero hanging entries
- [ ] All five deliverables are complete: defect registry, fix report, README, acceptance record, and commit sequence
- [ ] The Chapter Three red-line list was never violated throughout

---

## Appendix A: Pre-Audit Suspicion List (preliminary review conclusions completed before execution; each is a "suspicion" that must be verified before fixing, and if verification disproves it, register it as "not substantiated")

> Note: line numbers are as of the pre-audit and may shift during the fix process; the actual code prevails. Severities are preliminary judgments and may be adjusted at registration, but the change must be explained.

| ID | Preliminary Severity | Location | Suspicion Description | Key Points of Verification Method |
|---|---|---|---|---|
| R-01 | P0 | `backend/src/services/pipeline.js` (where the extraction state is set inside the unit loop) and `backend/src/services/fileService.js` (state transition table) | When processing multi-unit (multi-page) documents, the extraction state is set repeatedly inside the unit loop, but the transition table does not allow self-transitions, so the second assignment throws an illegal-enum error, the document is marked failed, and all page records are lost; the existing demo set and tests happen to be all single-page documents, so this was never exposed | Construct a two-page PDF, run the full local flow, and observe the document state and record count |
| R-02 | P0 | `backend/src/services/scenarios.js` (recalculation function) and `backend/src/services/calculation.js` (persistence in the calculation function) | Scenario recalculation directly reuses the calculation function that persists, so scenario values overwrite the official ledger's calculation records and calculation audit records; afterwards any path that rebuilds the report from storage (lazy generation, export, post-review rebuild) treats scenario values as the baseline | Run baseline → run scenarios → re-fetch the report, compare totals; inspect the contents of the calculation collection |
| R-03 | P0 | `backend/src/server.js` (all task-level routes) | Apart from the file download endpoint, endpoints such as task detail, documents, run, dashboard, report, export, review, audit, and tracing do not verify task ownership; owner-bearing tasks are open to any anonymous request, violating the project's own privacy commitment; task identifiers exposed in the evidence files can be used directly | Probe item by item per the V-02 matrix in Chapter Seven |
| R-04 | P0 | `backend/src/services/fileService.js` (storage key concatenation) and `backend/src/storage/index.js` (local adapter read/write) | Upload filenames are concatenated into storage keys without normalization, the local adapter performs no containment check on keys, and path-traversal fragments can escape the storage root to write files | Upload with malicious filenames and compare the storage root directory tree |
| R-05 | P1 | `backend/src/ai/client.js` (trace input summaries and error messages) and the trace query endpoint | Trace records' input summaries contain base64 fragments of uploaded documents, and error messages contain upstream error response bodies; combined with R-03, this amounts to exposing raw document fragments to anyone | Inspect the trace record field contents and endpoint responses |
| R-06 | P1 | `frontend/src/pages.jsx` (where P3 and P4 fetch the record list) and the task detail endpoint's response structure | The frontend reads record fields from the task detail endpoint, but that endpoint does not return records, so the two pages are always empty; the matching viewer and audit entry points are therefore unreachable | Directly exposed by the UI walkthrough (V-10) |
| R-07 | P1 | `backend/src/services/reportService.js` (where the scope-breakdown anchor is constructed) | When passing values for the scope-breakdown anchor, the unit conversion direction is wrong, inflating the anchor's tonne value by a factor of one thousand; the per-record anchors and the total anchor are all correct, and only this spot is wrong | Compare report anchor values with dashboard aggregate values |
| R-08 | P1 | `backend/src/services/exportService.js` (CSV cell escaping function) | CSV export does not neutralize formula trigger characters, so user/model-controllable text such as product names can execute formulas in spreadsheet software | Export with malicious product names and inspect the escaping |
| R-09 | P1 | `backend/src/server.js` (upload middleware configuration) | The upload middleware does not configure single-file size, file count, or request-body limits; size validation happens after full buffering into memory, creating a memory-exhaustion attack surface | Check the middleware configuration and the behavior of oversized requests |
| R-10 | P1 | `backend/src/server.js` (rate-limit and origin middleware) | The rate-limit key is taken from a forgeable forwarding header, so forging it resets the bucket; the bucket dictionary grows without bound; origin-header parsing can throw an uncaught exception on malformed values; the wildcard allowance for arbitrary Firebase domains is too broad (see R-32) | Load-test with forged headers and send malformed-header requests |
| R-11 | P1 | `backend/src/services/reviewQueue.js` (assign-factor, exclude, and close actions) | Review actions lack the "record belongs to this task" check and task-owner verification, making cross-task rewriting of matches and records possible; edit patch values have no type or range validation | Call the review endpoints with cross-task identifiers |
| R-12 | P1 | `backend/src/services/pipelineModelCalls.js` (extraction validation), `backend/src/services/calculation.js` (calculation bases), `backend/src/services/normalization.js` (conversion), and the review edit path | The entire chain for quantities and bases lacks finite-value validation; non-numeric values and infinity can pass validation and pollute aggregates, sorting, and reports | Inject invalid quantities; trace persistence and report output |
| R-13 | P1 | `backend/src/services/pipeline.js` (concurrency parsing), `backend/src/config.js` (numeric parsing), and the AI client (retry count) | Configuration such as concurrency and retry counts has no validation for invalid values: an invalid concurrency value makes the pipeline silently run empty, and an invalid retry count makes the calling function throw a null error | Start with invalid environment variables and run the flow |
| R-14 | P2 | `backend/src/services/reportService.js` (how the citation scan judges scenario anchors) | Scenario anchors are deemed valid merely because the identifier contains a specific fragment, with no existence check, weakening the governance rule that invalid references are an automatic veto | Construct a report containing fake scenario anchors and scan it |
| R-15 | P2 | `backend/src/store/index.js` (local storage) | A failed collection-file parse silently resets it to empty (data loss with no alert); whole-file synchronous rewrite is non-atomic; concurrent writes are last-write-wins | Corrupt one collection file, restart the service, and observe |
| R-16 | P2 | `backend/src/services/pipeline.js` (where candidate confidence is hard-coded) and `backend/src/services/uncertainty.js` (threshold judgment) | Recall-candidate confidence is hard-coded to a constant below the threshold, causing all records to be flagged as having no high-confidence factor and forced into review, so the signal loses discriminative power; the uncertainty distribution statistics produce non-numeric keys for missing grades | Inspect any task's flag ratio and distribution fields |
| R-17 | P2 | `backend/src/queue/index.js` | The queue abstraction is unused by the server and has defects of double dispatch for the same task and queue leakage; decision: fix or remove (removal reclaims line budget) | Search the whole repository for references to confirm there are no callers |
| R-18 | P2 | `backend/src/ai/client.js` (embedding batch call) | The embedding batch call has no timeout and no retry; when the response has fewer vectors than expected it silently accepts and writes bad vectors to the index | Simulate a short response in a unit test |
| R-19 | P2 | `backend/src/services/normalization.js` (currency recognition) | Incorrect ordering of currency recognition rules makes some currencies permanently unreachable or misclassified | Test cases covering all currency symbols |
| R-20 | P2 | `backend/src/services/fileService.js` (XLSX validation) | XLSX validation is only a substring-existence check inside the archive, with no defense against decompression amplification | Construct a high-compression-ratio file, evaluate the behavior, and record it |
| R-21 | P2 | `backend/src/services/fileService.js` (page counting) | PDF page count is computed by regex over raw bytes; counting bias affects page-unit splitting and the tracing cap | Check against documents of known page count in the standard dataset |
| R-22 | P2 | `backend/src/services/exportService.js` (PDF generation) | PDF generation exceptions do not reject the request, causing hangs; division by zero when headers are empty; tables silently truncate rows without disclosure | Trigger the exception path and an overlong table |
| R-23 | P2 | The five real-adapter verification scripts in `scripts/`, plus `eval/collectors.js` and the secret-scan script | Four of the five real-metric scripts lack secret guards, so running without secrets overwrites the official metrics files with mock results; the collector does not verify the adapter source; the secret scan has no defense against secrets "accidentally entering the staging area" | Run these scripts in a secretless environment and check the metrics files' source fields |
| R-24 | P2 | `Dockerfile`, `firebase.json` | The container has no health-check instruction; hosting lacks security response headers (content security policy, transport security, frame protection, sniffing protection) | Check the configuration files and verify equivalent headers locally |
| R-25 | P3 | `frontend/src/pages.jsx` (P6 ratio slider) | The ratio value is not sent to the backend, yet losing focus triggers a rerun of the entire pipeline — an expensive side effect coexisting with a dead feature | Operate the UI and observe network requests |
| R-26 | P3 | `frontend/vite.config.js` and the factor query endpoint | The dev proxy does not cover the factor query path, so that endpoint returns 404 in local development; the empty query the frontend issues to the factor endpoint on load inevitably gets a 400 error | Reproduce in the local development environment |
| R-27 | P3 | Multiple places (deduplication timing, audit ID generation, linear searches within lists) | Deduplication runs before normalization, weakening its effect; millisecond-timestamp audit IDs can collide; multiple quadratic-complexity linear searches | Code review and constructed test cases |
| R-28 | P3 | `backend/src/services/pipeline.js` (skipping completed documents) and post-review recalculation | Re-running a completed document is skipped, but stale calculations are not cleaned up; after a record is excluded in review, its leftover old calculations can be read by report rebuilds | After changes, re-run and rebuild the report and observe |
| R-29 | P3 | `backend/src/services/taskService.js` (task creation validation) | Task fields get only shallow validation: entity names can be any structure, and date order and types are not validated | Create tasks with invalid fields |
| R-30 | P3 | The two adapters in `backend/src/store/` | The local and production adapters behave inconsistently on undefined-value queries, document order, and pagination; list endpoints load everything with no pagination | Compare the two adapter implementations and list the differences item by item |
| R-31 | P3 | `backend/src/services/reportService.js` (empty loop), `backend/src/services/traceability.js` (dead branch) | Clearly dead code; reclaim it to offset the line budget | Remove after a full reference search confirms it |
| R-32 | P3 | `backend/src/server.js` (origin whitelist) | Wildcard CORS allows any Firebase hosting domain; this should be narrowed to the project's actual domains | Check the configuration |
| R-33 | P3 | `frontend/src/auth.js` (token storage and refresh degradation), `frontend/src/api.js` (request layer) | Long-lived refresh tokens stored in local storage amplify the consequences of XSS; a silent identity swap on refresh failure can cause a session mismatch that "looks successful but is actually someone else"; the request layer has no timeout, the upload path does not check response status, and request headers can be overridden | Code review plus exception-path drills |

**Appendix A usage requirements**: Verify item by item and register dispositions item by item; when verification conclusions differ from the pre-audit, the verification prevails and the reason for the discrepancy is recorded; it is forbidden to batch-fix directly from the table without verification (to prevent erroneous changes caused by pre-audit misjudgments).

---

## Appendix B: Numbering System Reference (use when citing documents within the project)

- Implementation-plan tasks: `T-001` through `T-051`; phase gates: `G0` through `G6`.
- PRD requirements: `FR-1xx` file ingestion, `FR-2xx` classification, `FR-3xx` extraction, `FR-4xx` normalization, `FR-5xx` boundaries, `FR-6xx` factor library, `FR-7xx` matching, `FR-8xx` calculation and aggregation, `FR-9xx` scenarios, `FR-10xx` report and export, `FR-11xx` review, `FR-12xx` observability and demo; `NFR-1xx` performance, `NFR-2xx` reliability, `NFR-3xx` security and privacy, `NFR-4xx` usability, `NFR-5xx` maintainability; `AI-1xx` output contract, `AI-2xx` hallucination governance, `AI-3xx` self-checks; `EV-1` through `EV-6` evaluation contracts. The final acceptance checklist is in PRD Section 10.3.
- Numbering in this audit brief: defects `D-xx`, pre-audit suspicions `R-xx`, baseline items `B-x`, automated acceptance items `A-x`, targeted acceptance scenarios `V-xx`.

---

## Appendix C: Record Template Notes (fields described in prose; no specific file format mandated)

- **Baseline snapshot**: commands, dates, results, key values (test-case count, the three line-count bases), anomaly notes.
- **Defect registry**: see the field list in Section 3.1.
- **Acceptance record**: one row per A item and V item: ID, execution date, result (pass/fail), evidence retention location (file path or screenshot description), and a backlink to the defect ID on failure.

(End of this audit brief)
