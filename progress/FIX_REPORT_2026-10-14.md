# CarbonLedger Comprehensive Review and Fix Report (2026-10-14)

> Executed in accordance with `AUDIT_FIX_PROMPT.md`. Companion files: defect register `progress/DEFECT_REGISTER_2026-10-14.md`, phase two notes `progress/REVIEW_PHASE2_NOTES_2026-10-14.md`, baseline snapshot `progress/BASELINE_SNAPSHOT_2026-10-14.md`, acceptance record `progress/ACCEPTANCE_RECORD_2026-10-14.md`.
> Mock mode was used throughout; no real keys were used, no destructive verification was performed against the public deployment, and no deployment commands were executed.

---

## 1. Scope and Methodology

**Scope**: The entire repository, advanced across the eight domains of Chapter 5 of the audit brief — A Security, B Business Correctness, C Frontend Functionality, D Data Storage and Adapters, E Concurrency/Fault Tolerance and AI Client, F Configuration and Deployment, G Testing and Verification System, H Documentation and Repository Hygiene.

**Methodology**:
1. Phase one established a baseline (B-1 through B-8), recording test counts, line counts under three counting rules, and build/smoke/key-scan/offline evaluation results.
2. Phase two read all files domain by domain → checked every checkpoint item by item → verified R-01 through R-33 of Appendix A one by one (code reasoning plus executable reproduction), with all conclusions registered.
3. Phase three applied fixes in the order P0→P1→P2→P3, each accompanied by regression verification, registering before fixing.
4. Phase four executed the automated acceptance battery + targeted scenarios V-01 through V-14 + a second-pass re-review.
5. Phase five consolidated the delivery.

**Examples of verification means**: constructed a two-page PDF to test the multi-page state machine empirically; constructed a malicious filename to test traversal; ran a baseline-vs-scenario comparison locally for persisted calculation accounting; used simulated short responses to test embedding batches empirically; browser walkthrough of nine pages with screenshots verified by an independent visual sub-agent; measured page-count regex deviation empirically against nine PDFs from the standard dataset.

---

## 2. Defect Statistics

A total of **58** items were registered (including baseline defects and newly discovered ones), all closed out.

**By severity**:

| Severity | Count | Notes |
|---|---|---|
| P0 (security vulnerability / data corruption) | 4 | multi-page state machine crash, scenario-polluted ledger, missing task ownership check, path traversal |
| P1 (serious functional defect) | 18 | includes frontend auth regression exposed after the ownership lockdown, report Share column 1000× error, fix-induced self-regression, etc. |
| P2 (robustness and quality) | 17 | trace data exposure, embedding batch, storage atomicity, report/export robustness, real-script guards, etc. |
| P3 (hygiene and low risk) | 19 | frontend request layer, task field validation, dead code reclamation, repository hygiene, documentation reconciliation, etc. |
| Not established (disproved on verification) | 2 | phenomena inherent to mock (D-55/D-57) |

**By domain** (cross-domain items counted once):

| Domain | Items |
|---|---|
| A Security | D-06, D-07, D-08, D-11, D-12, D-13, D-14, D-37, D-39, D-40, D-44, D-45, D-58 |
| B Business Correctness | D-04, D-05, D-10, D-15, D-19, D-21, D-24, D-26, D-27, D-33, D-34, D-36, D-41, D-42, D-52 |
| C Frontend Functionality | D-09, D-30, D-31, D-38, D-43, D-51, D-53, D-54 |
| D Data Storage and Adapters | D-20, D-22, D-35 |
| E Concurrency / Fault Tolerance / AI Client | D-16, D-17, D-18, D-49 |
| F Configuration and Deployment | D-25, D-29, D-47 |
| G Testing and Verification System | D-01, D-28, D-50, D-59 |
| H Documentation and Repository Hygiene | D-02, D-03, D-46, D-48 |
| Baseline defects | D-01 (smoke), D-02 (line count), D-03 (test-count rule) |

---

## 3. Fix Summary (by Severity)

### P0

- **D-04 Multi-page document state machine crash**: `setDocumentStatus('extracting')` was originally called per-unit inside the unit loop, while the transition table has no self-loop, so the second page of a multi-page PDF immediately threw `ERR_ENUM_INVALID`, the whole document was set to failed, and all page records were lost. Fix: moving into the extracting state was taken out of the loop (once per document); the transition table allows re-entry into `parsing` from the processing state to support re-runs after interruption/review; old records of the document are cleared before a re-run to guarantee idempotence. Regression: full flow on a two-page PDF + re-run integrity.
- **D-05 Scenario recompute polluting the official ledger**: scenario reuse invoked the persisting `computeEmission`, overwriting baseline accounting and audit under the same `calc_<record_id>` primary key. Fix: a `persist` switch was added to the accounting function, with scenario paths using `persist:false` (compute only, no persistence) and official path behavior unchanged. Regression: post-scenario persisted accounting and audit row counts unchanged.
- **D-06 Missing task ownership check**: all task-level routes except file download lacked an ownership check. Fix: added an injectable token validator + `requireTaskOwner` conditional enforcement middleware (when a task has an owner, any non-owner gets a 403 `ERR_FORBIDDEN`; ownerless tasks stay open for script and one-click demo compatibility), mounted on all 15 task-level routes; review actions also gained a "record belongs to the task" check. Regression: three identities × full endpoint matrix.
- **D-07 Path traversal**: uploaded filenames were concatenated into storage keys without normalization, and the local adapter lacked a containment check. Fix: filename normalization (basename extraction, character whitelist, length truncation) + containment check after local storage resolve (out-of-bounds throws `ERR_STORAGE_ACCESS`). Regression: directory tree comparison after traversal/backslash/absolute-path uploads.

### P1 (Selected)

- **D-52 Report Share column 1000× error** (found during phase four visual verification): the Chapter 2 proportion formula `s.value * 1000 / totalKg * 100` multiplied by an extra 1000 even though s.value and totalKg are both in kilograms, displaying proportions at the 26240% level. Fix: changed to kilograms divided by kilograms. Regression: proportions sum to ≈100% and each item ∈[0,100].
- **D-51 P4 candidates always empty** (found during phase four walkthrough): the P4 heading was "recall channel output" yet it used the AND-semantics `/factors?q=` multi-word query, which necessarily returned zero items for free text, making manually specified factors unreachable. Fix: added a candidate interface based on the recall channel, and the frontend was changed to use it.
- **D-59 Fix-induced self-regression** (found in phase four): the D-14 patch validation initially accepted only number, while the review UI submitted strings → P8 edits uniformly returned 422. Fix: numeric fields accept numbers or numeric strings and are coerced, while non-finite values are still rejected.
- **D-10 Report anchor 1000× error**: the scope-decomposition anchor passed the value in the wrong direction, amplifying ton values a thousandfold. Fix: pass kilograms, with the anchor performing the conversion uniformly.
- **D-11 CSV formula injection**: cells starting with =, +, -, @, tab, or carriage return were output verbatim. Fix: neutralized by a leading single quote (numeric columns remain numeric).
- **D-12 Upload resource consumption**: multer was unbounded, with the size check applied only after the full body was in memory. Fix: middleware `limits` (10MB per file, 50 files), with errors mapped to 413/422.
- **D-13 Rate limiting and origin**: the rate-limit key used a forgeable forwarding header, buckets had no upper bound, and malformed Origin values threw exceptions; **it was also found that cross-cutting middleware was registered after early routes, leaving `/config` and `/factors` entirely outside rate limiting and CORS coverage**. Fix: middleware hoisted to the front; keys default to socket address (forwarding headers trusted only when `TRUST_PROXY=1`); bucket upper bound; exact string comparison for Origin; illegal thresholds fall back to 60.
- **D-14 Review action privilege escalation and unvalidated patches**: assign/exclude lacked cross-task checks, and patch values had no type/range validation. Fix: unified `getTaskRecord` + `normalizePatch`.
- **D-15 No finiteness defense anywhere in the quantity pipeline**: NaN/Infinity could penetrate extraction validation, conversion, and accounting bases, polluting aggregation, sorting, and reports. Fix: `Number.isFinite` validation across all numeric fields plus conversion and accounting-base guards.
- **D-16/D-17 Configuration and retry**: illegal concurrency caused the pipeline to silently run empty, and illegal retry counts caused empty-value throws; fatal errors were needlessly retried. Fix: out-of-bounds config values fall back to defaults with a warning; a finiteness guard on concurrency; `fatal` errors terminate immediately; exponential backoff between retries.
- **D-33 Incomplete reports on re-run/concurrency**: completed documents were skipped on re-run but returned empty accumulations; a concurrent second run of the same task produced an incomplete report (V-08 would necessarily fail). Fix: completed documents reload their records and accounting from storage on re-run; runs of the same task are serialized in a queue.
- **D-39/D-40 Frontend regression from the ownership lockdown**: the audit view used bare fetch, and exports and source documents were bare `<a>` elements, which would return 403 for tasks with owners once D-06 took effect. Fix: rerouted through the authenticated-header api layer and a blob download helper.
- **D-01 Smoke test necessarily fails under Git Bash** (baseline): `mktemp` returned an MSYS path that native Windows Python could not open. Fix: the log is passed to Python via stdin.
- **D-02 Line-count budget** (baseline): see Section 4.
- **D-08 Trace data exposure**: trace records contained base64 fragments of uploaded documents and upstream error response bodies. Fix: `inline_data` is summarized as omitted; upstream response bodies no longer enter error messages.
- **D-09 P3/P4 data source error**: both pages read a nonexistent `task.records`, always empty. Fix: switched to the records from the dashboard interface.

### P2 / P3 (Selected)

- **D-18 Embedding batch**: no timeout and no retry, with insufficient vector counts silently misaligned when writing indexes → added timeout, strict vector-count validation, and explicit error reporting on failure.
- **D-19 Scenario anchor bypassed validation**: the `includes('_S-')` bypass exempted forged scenario anchors from existence checks → the bypass was removed.
- **D-20 Local storage**: parse failures silently cleared data, and whole files were rewritten non-atomically → added a warning plus a write-to-temp-file-then-rename approach.
- **D-21 Hardcoded confidence 0.5**: made the "no high-confidence factor" signal always true, destroying discrimination, and produced NaN keys in distribution statistics → passes the real recall score; distribution defaults merge into medium.
- **D-22 Queue abstraction**: not referenced by the server and had a double-dispatch defect → removed under 5.4.3 authorization (line-count reclamation).
- **D-24 Currency recognition order**: `¥jp` was never reachable and bare `¥` always judged CNY → reordered as unambiguous-first.
- **D-26 PDF page count**: the byte regex undercounted compressed-object-stream PDFs → switched to pdf-lib precise counting, along with genuine corruption detection.
- **D-27 Export robustness**: PDF generation exceptions left requests hanging, and empty table headers caused divide-by-zero/TypeError → added error rejection and an empty-table-header guard.
- **D-28 Real-script guard**: four real adapter scripts lacked key guards and would overwrite official metrics with mock values; the collector blindly trusted pass → guards added; result files stamped with an `adapter` field, and the collector rejects mock evidence.
- **D-29 Container and hosting**: no HEALTHCHECK; hosting lacked security response headers → added a health check plus CSP/HSTS/frame protection/sniffing protection.
- **D-30 P6 slider dead feature**: the ratio was not passed to the backend yet triggered a full pipeline re-run → passes ratio through (measured: after 50%, the scenario saving is exactly halved).
- **D-31 Dev proxy and empty query**: the proxy did not cover `/factors`, and P4 mounting issued an empty query that necessarily returned 400 → proxy added, empty call removed.
- **D-34 Task field validation**: entity names could be arbitrary structures, and dates lacked type/order checks → added field-level validation.
- **D-36 Dead code**: an empty report loop, a traceability dead branch, a frontend dead function, unused exports → removed (line-count offset).
- **D-37 Overly broad CORS**: any Firebase domain was wildcard-allowed → narrowed to an explicit whitelist.
- **D-38 Frontend request layer**: uploads did not check response status, request headers could be overwritten, and there was no timeout → all remedied; refresh-token local storage and session misalignment intentionally retained and documented.
- **D-41/D-42**: pending_duplicate documents entered the pipeline producing an error storm; document-level needs_review was unreachable → filtered bypass states; judged by normalized records.
- **D-43 P2 polling uncaught**: after a task was cleaned up, an unhandled rejection occurred every 2.5s → catch added.
- **D-45 Error-code registry**: missing ERR_RATE_LIMITED (hand-written inline) and the authorization denial code → incorporated and added ERR_FORBIDDEN.
- **D-47 Repository hygiene**: three tracked `.pyc` files under `scripts/golden/__pycache__` → untracked and added to ignore.
- **D-53/D-54 Frontend display**: the P3 factor column displayed record ids instead of factor ids; empty values displayed the literal "null" because `typeof null === 'object'` → both corrected.
- **D-58 Evidence coverage** (second-pass re-review): running the consistency script locally would overwrite official public evidence → local runs write to an independent filename.

---

## 4. Line-Count Budget Offset Notes (NFR-504)

| Item | Lines |
|---|---|
| Measured pre-review rule B (baseline) | 7,110 (already 110 over target) |
| Reclaimed dead code (queue abstraction 124 + report/traceability/frontend/taskRuns/calculation/BASE_UNITS totaling 15) | −139 |
| Added: mandatory regression battery `regression.test.js` (explicitly required to be automated by section 7.2 of the audit brief) | +330 |
| Added: minimal implementation of security and correctness fixes | +305 |
| **Post-review rule B** | **7,606** (606 over) |
| Rule C (including the Python toolchain) | 9,401 (< 10,000 hard ceiling, met) |

**Conclusion**: The overrun is recorded in writing and accepted per clause 2.6.2 of the audit brief. Rationale: (1) the baseline was already over budget; (2) of the net increase, 330 lines are regression tests mandated by the audit brief, and the remainder is the minimal implementation of P0/P1 fixes — neither can be removed; (3) all confirmable unreferenced dead code has been reclaimed (a whole-repo export scan found `BASE_UNITS` alone at zero references, now removed), with nothing further to reclaim; (4) rule C meets the hard ceiling; (5) **the statistics script's counting rule was not modified** (red line 4). `count_lines.sh` still prints FAIL, presented truthfully without cosmetic cover-up.

---

## 5. Items Not Implemented and Their Rationale

| Item | Rationale |
|---|---|
| R-20 XLSX decompression amplification defense | This service does not decompress XLSX (it passes it verbatim to the model as inline_data), so there is no local resource-consumption surface; the 10MB middleware cap bounds the input. Documented (D-25) |
| R-30 Adapter behavioral differences | Undefined value lookup, document ordering, pagination differences; there is currently no trigger path, order-sensitive reads already have explicit sorting, and task-level data volume is controllable. Difference table listed (D-35) |
| R-33(4)(5) Refresh-token local storage / refreshing with a new identity on failure | The anonymous identity carries no PII and the token has low value; switching to a new identity is an established best-effort-availability trade-off; a backend session/HttpOnly cookie is an architectural change beyond the minimal-fix scope. Improvement path documented (D-38) |
| R-27 Linear lookup (quadratic complexity) | Task-level n is small, with no measured bottleneck; unchanged (D-32) |
| Code-level mitigation of prompt injection | Existing mitigations (structured output + closed-set validation + closed-set factor candidates + numeric defenses) have compressed the injection-reachable range to "picking a wrong value from a legal enumeration", and every step is logged and auditable; any prompt change would require re-running real adapter evaluations to prove extraction accuracy does not regress, beyond the minimal-fix scope. Attack surface and mitigation suggestions recorded (D-49) |
| Pre-commit key defense (pre-commit hooks) | Ordinary `git add` is already intercepted by `.gitignore`, and only `git add -f` can bypass it (a deliberate human act); introducing hooks is a new toolchain dependency with marginal benefit. Operational red line documented (D-50) |
| Report Scope table row order (1/3/2) | Purely cosmetic; sorting would change the largest-remainder allocation order and could disturb already-passed aggregation-consistency evidence. Intentionally retained (D-56) |
| Single-model strategy | `AI_MODEL_ALLOWLIST` was not modified, and no second generative model was introduced |
| Production deployment | No deployment commands were executed (red line 1) |

---

## 6. Production Deployment Notes (Explanatory Only, Not Executed)

1. **New error codes**: `ERR_FORBIDDEN` (403) and `ERR_RATE_LIMITED` (429) have entered the registry; frontends and callers that branch on error codes need to be aware.
2. **Ownership semantics**: tasks with owners return 403 to non-owner (including anonymous) requests (previously 200). Ownerless tasks (scripts/offline/one-click demo) behave unchanged. Clients must carry an ID token to access tasks they created — the frontend has been rerouted through the authenticated-header api layer.
3. **Rate-limit key**: keys are computed from the connection socket address by default. In production behind a reverse proxy/load balancer, `TRUST_PROXY=1` must be set for `x-forwarded-for` to be trusted; otherwise all requests share the same rate-limit bucket keyed on the proxy address.
4. **CORS whitelist**: defaults include `http://localhost:5173`, `http://127.0.0.1:5173`, and `https://myproject-dc19d.web.app`; custom domains must be added explicitly via `CORS_ORIGINS`.
5. **Upload limits**: the middleware enforces 10MB per file and 50 files per request, rejecting over-limit requests with 413/422 before buffering.
6. **Container**: the Dockerfile adds HEALTHCHECK (based on `/healthz`); Firebase Hosting adds security headers such as CSP/HSTS. The CSP `connect-src` already includes Google API and Firebase domains; if the frontend integrates new third-party endpoints, it must be relaxed accordingly.
7. **Scenario isolation**: scenario recomputation no longer writes to the official ledger. **Historical data polluted by old-version scenarios is not migrated** (demo environment data can be rebuilt); if production was ever affected, it is recommended to re-run the pipeline per task to rebuild the ledger and reports.
8. **Evidence files**: `scripts/verify_consistency.js` writes to `consistency-local.json` when run against a non-default target, no longer overwriting official public evidence.
9. **Key injection**: still injected at runtime via environment variables (plaintext); the improvement path is Secret Manager, not implemented this time (section 5.6.4 of the audit brief only requires documentation).

---

## 7. Deliverables List

1. Defect register: `progress/DEFECT_REGISTER_2026-10-14.md` (65 items closed out)
2. This fix report: `progress/FIX_REPORT_2026-10-14.md`
3. Baseline snapshot: `progress/BASELINE_SNAPSHOT_2026-10-14.md`
4. Phase two review notes: `progress/REVIEW_PHASE2_NOTES_2026-10-14.md`
5. Acceptance record: `progress/ACCEPTANCE_RECORD_2026-10-14.md`
6. Updated `README.md`; `progress/DEFECT_REPORT_T050.md` with an Addendum added
7. Regression tests: `backend/test/regression.test.js` (16 cases; 47 tests in total)
8. Acceptance evidence: `progress/evidence/audit-2026-10-14/` (V-10 nine-page screenshots, PDF/CSV exports, local consistency results)

---

## 8. Second-Pass Re-Review Additions (2026-10-14, independent re-review after closure)

**Background**: When the phase four first pass closed, it claimed "second-pass re-review complete, zero dangling items". An independent reviewer then re-ran the review from a different perspective — "by file, assertion by assertion" — specifically looking for new problems introduced by the fixes themselves, interactions between fixes, and similar omissions outside the register. **That round's conclusion was disproved**: nine new defects were found (D-60 through D-68), all registered, fixed, and covered by regression assertions. Among them, D-67 was found through API-level end-to-end re-verification — a pre-existing defect (attributed via old-version code confirmation) that neither the first pass nor the V-08 automated evidence had covered.

| ID | Severity | Summary | Verification |
|---|---|---|---|
| D-60 | **P1** | `failed` documents could not be retried, and a re-run would delete-then-throw, destroying existing records and permanently deadlocking (violating 6.3.3 "failed state can be retried from the queued state") | Regression test (set failed → re-run → 2 records, terminal state not failed, no duplication) |
| D-61 | P3 | A tautological assertion in the self-built regression test (value compared with itself), which does not constitute an assertion | Changed to a real assertion of `status < 500` |
| D-62 | P3 | The review `close` action lacked a "record belongs to the task" check (D-14 claimed to cover all actions) | Cross-task close → `ERR_TASK_NOT_FOUND` |
| D-63 | P3 | Config value parsing accepted numeric prefixes (`'60abc'`→60, `'7.5'`→7), with illegal values silently adopted | `'7.5'`/`'5x'`/`'0.6junk'` all fall back to defaults |
| D-64 | P3 | 4 pieces of dead code (3 zero-reference exports + 1 unreachable classification rule) | A-2/A-6 do not regress; 8 lines reclaimed |
| D-65 | P3 | No finiteness guard on the accounting product side (NaN could enter the ledger when the factor side was corrupted) | Non-finite factor value → throws error and does not persist |
| D-66 | P3 | The embedding response validated only the count, not element shape, so empty vectors would be silently indexed | Element missing `values` → `ERR_MODEL_CALL_FAILED` |
| D-67 | **P2** | When re-running a non-completed document, old records were deleted first; if this extraction produced nothing, the ledger would be silently emptied (measured one-click demo 20→2 records), yet the task still reported success; in mock mode this was triggered by an omitted `useMockCatalog`, and in real mode by a soft-empty extraction | Regression test (after re-run with no catalog, record count still 2, storage count 2, total > 0) + API-level re-verification (20 records preserved) |
| D-68 | **P2** | Four verification scripts doing "fetch first, then process.exit" triggered a libuv assertion on Windows, reporting PASS yet exiting 127, breaking the 5.7.5 exit-code contract | Changed to `process.exitCode`; measured `verify_consistency.js` printing PASS with exit=0 (three times) |

**Why D-67 matters**: V-08's automated evidence (`verify_consistency.js`) only checks that "the report is self-consistent with the **surviving** ledger", so it still passed after the ledger was emptied — that blind spot has been recorded; the D-67 fix makes "a re-run must not silently shrink the ledger" a hard invariant.

**Why D-60 matters**: Section 6.3.3 of the audit brief lists "the failed state can be retried from the queued state" as a hard requirement of the state-machine fix; the first pass only verified "multiple re-runs are idempotent" (completed returns early) and "multi-page documents no longer break", without covering the failure branch. This defect could be triggered through the UI's only run entry point (the P6 scenario slider), with consequences of data corruption and the document permanently exiting reports.

**Impact on deliverables**:
- Test count 44 → **48** (all passing); regression battery 13 → 17 cases.
- Line counts under three rules: app 4,513→**4,544**; including JS tooling 7,606→**7,708**; including the Python toolchain 9,401→**9,503** (the 10,000 hard ceiling is still met). The nature of the overrun is the same as the first pass, and the acceptance conclusion is unchanged (see the register's D-02 "final account" second-pass additions).
- Register 58 → **67** items, all closed out.
- README has been synchronized with the test count and the three-rule line counts.

**Conclusion**: The second-pass re-review confirms that the first pass's "zero additions" statement does not hold, and it has been closed out to zero new additions per section 7.4; D-60 makes failed documents recoverable and retriable with re-runs no longer destroying existing records, and D-67 makes a re-run preserve the existing ledger when the extraction output is empty.
