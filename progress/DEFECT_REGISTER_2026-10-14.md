# Defect Register (Comprehensive Audit and Fix, from 2026-10-14)

> Established per Section 3.1 of `AUDIT_FIX_PROMPT.md`. The status is updated after each defect is closed.
> IDs increment sequentially from D-01; the source is an Appendix A suspicion ID or a "Phase 2 new finding".

---

## D-01

- **ID**:D-01
- **Source**:Phase 1 new finding (baseline B-4 failure)
- **Severity**:P1 (verification infrastructure unusable under Git Bash, the supported environment declared in README/task specification)
- **Location**:`scripts/smoke.sh:9,37-42`
- **Description**:Under Git Bash, `LOG_FILE=$(mktemp)` returns an MSYS virtual path (e.g. `/tmp/tmp.zU5LxVRQlA`), while the `python -c "open(r'$LOG_FILE'…)"` used to verify the log invokes native Windows Python, which cannot resolve MSYS paths; `open()` throws `FileNotFoundError`, and the script fails with "SMOKE FAIL: first log line is not a structured server_started event". The failure message itself also does not match the assertion content (the assertion only requires `server_started` to be in the event list, not on the first line). Trigger condition: running `npm run smoke` under Windows Git Bash.
- **Verification evidence**:On 2026-10-14, running `npm run smoke` failed; reproducing `LOG_FILE=$(mktemp); python -c "open(r'$LOG_FILE')"` in isolation throws `FileNotFoundError: '/tmp/tmp.zU5LxVRQlA'`, while the log file does exist and contains a valid `server_started` event (server_started is the second line, the first line is factor_library_loaded, and the assertion itself should pass).
- **Fix plan**:Have Python read the log content from stdin (`cat "$LOG_FILE" | python -c "…sys.stdin…"`, since cat is an MSYS tool that can resolve /tmp paths), avoiding passing MSYS paths to native Python; also change the failure message to wording consistent with the assertion.
- **Verification method**:A-3 (`npm run smoke` outputs SMOKE OK).
- **Status**:Fixed (A-3 smoke passed)

---

## D-02

- **ID**:D-02
- **Source**:Phase 1 new finding (baseline B-6 failure)
- **Severity**:P1 (NFR-504 budget violation; acceptance item A-5 directly fails)
- **Location**:whole repository (basis B counting scope: backend/src + frontend/src + eval + scripts/**/*.js, including backend/test)
- **Description**:Basis B measures 7,110 lines, exceeding the 7,000 cap by 110 lines; the task specification claims a baseline of 6,976, and the measured value already exceeds it, indicating that recent commits (the T-044…T-050 batch) added lines net with no offsetting reductions. In the current state `count_lines.sh` reports FAIL, and acceptance item A-5 cannot pass.
- **Verification evidence**:On 2026-10-14, running `bash scripts/count_lines.sh` outputs `B. … 7110`, `NFR-504: FAIL (figure B 7110 <= 7000 …)`.
- **Fix plan**:Throughout this audit and fix, the constraint is "added lines ≤ reclaimed lines − 110"; reclamation candidates per 6.3.4: the queue abstraction unused by the server (R-17), the report service's empty loop and dead branch (R-31), tracing service dead code, and other dead code confirmed in Phase 2; modifying the counting script's basis is strictly forbidden.
- **Verification method**:A-5 (`count_lines.sh`; for the basis B verdict see the final accounting below).
- **Status**:Handled per clause 2.6.2 (overage recorded in writing + basis C met)

### D-02 Final Accounting (2026-10-14, Phase 4)

| Item | Lines |
|---|---|
| Measured basis B before audit (baseline) | 7,110 |
| Reclaimed: queue/index.js + queue.test.js (D-22 dead code removal) | −124 |
| Reclaimed: report empty loop, traceability dead branch, P3 dead function, taskRuns dead export, calculation dead branch, BASE_UNITS dead export (D-36 etc.) | −15 |
| Added: mandatory regression battery `backend/test/regression.test.js` (V-01/02/03/04/05/06/07/12 must be automated, explicitly required by task specification 7.2) | +330 |
| Added: security and correctness fixes (owner middleware, CORS/rate-limit rewrite, run serialization, candidate endpoint, upload limits and error mapping, trace sanitization, embedding defense, patch validation, pdf-lib counting, storage containment, config validation, task field validation, CSV neutralization, report anchor/Share fix, script secret guard) | +305 |
| **Measured basis B after audit** | **7,606** (target 7,000, overage 606) |
| Second-round reclamation: dead exports FACTOR_LIBRARY_FILE / STORE_COLLECTIONS / currentIdToken + unreachable classification rule (D-64) | −8 |
| Second-round addition: D-60/61/62/63/65/66 fix implementations | +12 |
| Second-round addition: regression assertions (D-60/D-62/D-63/D-65/D-66) | +63 |
| Second-round addition: D-67 fix (empty-output guard) | +11 |
| Second-round addition: D-67 regression assertions | +20 |
| Second-round addition: D-68 fix (exit codes of 4 verification scripts) | +3 |
| **Measured basis B after second-round review (final)** | **7,708** (target 7,000, overage 708) |
| Basis C (including Python toolchain) | 9,503 (hard cap 10,000, met) |

**Overage rationale and acceptance conclusion (per 2.6.2)**:
1. The pre-audit baseline was already 7,110, exceeding the target by 110 lines — the overage was not caused by this fix alone.
2. Of the 496 net added lines this time, 330 are acceptance scenarios that Chapter 7 of the task specification explicitly requires to be "solidified as automated regression tests"; the remaining 166 are the minimal implementation of P0/P1 security and correctness fixes. Neither can be cut.
3. Forcing it down to ≤7,000 would leave only deleting the mandatory regression tests or rolling back security fixes — violating Iron Rule 3 and Red Line 3, which is unacceptable.
4. Per 2.6.2, all dead code confirmed to have no references has been reclaimed (139 lines); no further reclaimable items were found (repository-wide export-reference scan: only BASE_UNITS had zero references, and it has been removed).
5. Basis C 9,401 ≤ 10,000, satisfying the hard requirement of 2.6.2.
6. **Modifying the counting script's basis is strictly forbidden** (Red Line 4) — `count_lines.sh` was not changed by a single character, and the overage is presented truthfully.

**Conclusion**:Per the 2.6.2 escape clause, A-5 is judged "recorded and accepted"; `count_lines.sh` itself still prints FAIL, and this fact is recorded truthfully, without glossing over it.

**Second-round addendum (2026-10-14)**:The second independent review added 7 fixes and 6 sets of regression assertions and reclaimed 8 lines of dead code; basis B moved from 7,606 to **7,708** (overage 708), and basis C 9,503 remains < 10,000. The nature of the overage is the same as the first round (mandatory regression tests + security/correctness fixes), and the acceptance conclusion is unchanged. The repository-wide dead-export scan (counting occurrences by export name) hit only 4 items this round, all of which were reclaimed; no further reclaimable items were found.

---

## D-03

- **ID**:D-03
- **Source**:Phase 1 new finding (B-3 reconciliation with documentation)
- **Severity**:P3 (documentation basis unclear)
- **Location**:`README.md` (where the test count is stated)
- **Description**:There are two bases for the test count: 33 `test(` cases inside backend/test; at `npm test` runtime the total is 34 (33 + the upload script suite counted as 1 aggregate case, see `scripts/test.sh:31-46`). If README gives only a single number without explaining the composition, readers cannot reconcile it.
- **Verification evidence**:B-3 run output `[suite] backend: pass=33 fail=0`, `[suite] upload: pass=1 fail=0`, `TOTAL passed=34`; grep counts 33 occurrences of `test(` in backend/test/*.test.js.
- **Fix plan**:Change README's test count wording to an explicit basis of the form "34 (33 node:test cases + 1 upload aggregate script suite)".
- **Verification method**:V-13 (documentation reconciliation).
- **Status**:Fixed (V-13 README reconciliation; the test count is stated with its composition based on the measured 44)

---

## D-04(R-01)

- **ID**:D-04
- **Source**:R-01
- **Severity**:P0
- **Location**:`backend/src/services/pipeline.js:85` (line number before the fix); `backend/src/services/fileService.js:117-125`
- **Description**:When processing a multi-unit (multi-page PDF) document, `setDocumentStatus(...,'extracting')` is called per unit inside the unit loop; the transition table has no self-loop for `extracting`, so when the second unit is processed the second set throws ERR_ENUM_INVALID, withStatus marks the whole document failed, and all page records are lost. The demo set and tests happen to be single-page documents, so this was not exposed.
- **Verification evidence**:Code reasoning + Phase 4 V-01 will reproduce it empirically with GD-09 (4 pages); the transition table `extracting: ['matching','failed','needs_review']` does not contain extracting.
- **Fix plan**:Per task specification 6.3.3, move the extracting status set outside the unit loop (set once before entering the loop); repeated reruns are idempotent (completed is skipped), the failed state can be retried from queued, and review recalculation does not trigger this path — none are affected.
- **Verification method**:V-01 + a new multi-page document regression test (solidified in backend/test/pipeline.e2e.test.js).
- **Status**:Fixed (V-01 + regression test)

---

## D-05(R-02)

- **ID**:D-05
- **Source**:R-02
- **Severity**:P0
- **Location**:`backend/src/services/scenarios.js:15-18`; `backend/src/services/calculation.js:36-89`
- **Description**:The scenario recalculation rerunWithFactor reuses the persist-capable computeEmission, overwriting formal ledger calculation records and calculation audit records under the same primary key `calc_<record_id>`; afterwards the export route and generateReportForTask (lazy generation / rebuild after review) read the persisted calculations and treat scenario values as baseline values.
- **Verification evidence**:Code reasoning (calculation.js:79 `store.put('calculations', calcId, calc)`); V-04 will verify empirically: run baseline → run scenario → compare stored calculations against the report.
- **Fix plan**:Per task specification 6.3.2, add an optional `persist = true` parameter to computeEmission, with the scenario path passing persist:false (compute only, no persistence, no audit write); the formal path (pipeline, dashboard recalculation) is unchanged. Historical data contaminated by scenarios is not migrated (the demo environment can be rebuilt); this is stated in the fix report.
- **Verification method**:V-04 + a new scenario isolation regression test.
- **Status**:Fixed (V-04 + regression test)

---

## D-06(R-03)

- **ID**:D-06
- **Source**:R-03
- **Severity**:P0
- **Location**:all task-level routes in `backend/src/server.js` (139-304, except 161-171 file download which already has an owner check)
- **Description**:Task details, document list, upload, duplicate resolution, status modification, triggering runs, dashboard, report reading, report export, all review actions, audit viewing, and AI trace queries all fail to check task ownership; owned tasks are open to any anonymous/wrong-identity request, violating README's privacy commitment (NFR-301).
- **Verification evidence**:Route-by-route check of server.js (only /file has the `task.owner !== req.uid` check); the V-02 matrix will empirically test three identities × all task-level endpoints.
- **Fix plan**:Per task specification 6.3.1's conditional enforcement policy: add a replaceable token verifier injection point and `requireTaskOwner` middleware — when a task has an owner, any req.uid that is not the owner (no token/wrong token) gets 403 ERR_FORBIDDEN; ownerless tasks remain open (script/offline/demo semantics). The four review actions gain both "record belongs to this task" (D-14) and owner double checks. The token verification component is implemented via dependency injection, with unit tests injecting simulated identities; the local no-credential "verification failure degrades to anonymous" behavior is retained, and its combined semantics with conditional enforcement (owned tasks reject anonymous) are covered by tests.
- **Verification method**:V-02 + a new privilege-escalation matrix regression test; the one-click demo (progress/evidence public task IDs) remaining usable serves as a direct check.
- **Status**:Fixed (V-02 + regression test)
- **Related decision (D-45)**:errors.js adds `ERR_FORBIDDEN` (http 403) and `ERR_RATE_LIMITED` (http 429, absorbing the server's hand-written response, with the message text unchanged). This is a contract addition (not a change), and no existing consumers are affected.

---

## D-07(R-04)

- **ID**:D-07
- **Source**:R-04
- **Severity**:P0
- **Location**:`backend/src/services/fileService.js:76`; `backend/src/storage/index.js:12-25`
- **Description**:The uploaded filename is concatenated into the storage key without normalization (`${taskId}/${id}_${filename}`); the local adapter's put/get only join without containment checks; traversal fragments such as `../../evil.pdf` can escape the storage root and write files (backslash variants take effect on Windows; absolute path fragments likewise).
- **Verification evidence**:Code reasoning + V-03 will upload filenames containing traversal/backslashes/absolute paths and compare the storage root directory tree.
- **Fix plan**:Two-layer defense: (1) fileService normalizes the filename before constructing the storage key — take basename, strip path separators and null bytes, character whitelist [A-Za-z0-9._-() ], truncate overly long names; (2) LocalFileStorage put/get performs containment validation after resolve, throwing ERR_STORAGE_ACCESS on escape.
- **Verification method**:V-03 + a new path traversal regression test (assertions comparing the directory tree before and after).
- **Status**:Fixed (V-03 + regression test)

---

## D-08(R-05)

- **ID**:D-08
- **Source**:R-05
- **Severity**:P1
- **Location**:`backend/src/ai/client.js:61-68,105-131,210,248-250`
- **Description**:Trace records input_summary as the first 300 characters of the parts JSON, and during the extraction stage parts contain inline_data base64 document fragments; the error field of failed traces contains the upstream response body (dispatch `HTTP <status>: <body>`; embedTexts' AppError details carry the body directly). Combined with R-03 this equals exposing raw document fragments to anyone; after D-06 is closed they remain visible to the owner, which violates the minimization principle.
- **Verification evidence**:Code reasoning (summarize(parts) does not filter inline_data; err.message contains body.slice).
- **Fix plan**:summarize first sanitizes the parts array — inline_data items are replaced with `[<mime> omitted]`; dispatch error messages keep only `HTTP <status>` and the classification, no longer embedding the response body (same for embedTexts).
- **Verification method**:a new sanitization regression test (constructing a call containing inline_data and asserting the trace record contains no base64 signature or response body).
- **Status**:Fixed (regression test: trace contains no base64/upstream body)

---

## D-09(R-06)

- **ID**:D-09
- **Source**:R-06
- **Severity**:P1
- **Location**:`frontend/src/pages.jsx:156-168(P3),215-223(P4)`; compare `backend/src/server.js:139-143`
- **Description**:P3/P4 read the `task.records` field from the task details endpoint, but that endpoint only returns `{...task, documents}`, so both pages are always empty; the match viewer and audit entry are therefore unreachable; loadRecords at pages.jsx:156-159 (correctly implemented) is dead code that is never called.
- **Verification evidence**:Code cross-check (the endpoint has no records field); the V-10 UI walkthrough exposes it directly.
- **Fix plan**:P3/P4 switch to the dashboard endpoint (`api.dashboard` returns records, backend contract unchanged); delete the dead function loadRecords (reclaimed together under D-36).
- **Verification method**:V-10 (P3 non-empty, P4 can be entered and manual factor assignment completed).
- **Status**:Fixed (V-10 P3/P4)

---

## D-10(R-07)

- **ID**:D-10
- **Source**:R-07
- **Severity**:P1
- **Location**:`backend/src/services/reportService.js:94`
- **Description**:Scope breakdown anchor `anchor(s.value * 1000, ...)`: s.value is the kilogram aggregate, and anchor internally performs t3(kg)=kg/1000, so multiplying by 1000 before passing in makes the anchor tonnage value equal to the kilogram figure (inflated a thousandfold); the per-record anchor and the total anchor are both correct — only this spot is wrong.
- **Verification evidence**:Code reasoning + V-05 will compare the measured anchor values item by item against the dashboard aggregate values (any inequality exposes it).
- **Fix plan**:Change to `anchor(s.value, 'aggregation', taskId, s.key, ...)` (kilogram input, converted uniformly inside anchor), consistent with the dashboard's t3 rounding.
- **Verification method**:V-05 + a new anchor value regression test.
- **Status**:Fixed (V-05 + regression test)

---

## D-11(R-08)

- **ID**:D-11
- **Source**:R-08
- **Severity**:P1
- **Location**:`backend/src/services/exportService.js:8-11`
- **Description**:csvEscape only handles values containing `"`, `,`, or newlines; cells starting with =, +, -, @, tab, or carriage return are output as-is, so user/model-controllable text such as product names can execute formulas in spreadsheet software (CSV formula injection).
- **Verification evidence**:Code reasoning + V-06 will export malicious product names such as `=SUM(1+1)*cmd|'` and inspect them.
- **Fix plan**:csvEscape prefixes values starting with [=+\-@\t\r] with a single quote `'` to neutralize them (the common OASIS practice), with the other escaping rules unchanged; both CSV export paths share this.
- **Verification method**:V-06 + a new formula injection regression test.
- **Status**:Fixed (V-06 + regression test)

---

## D-12(R-09)

- **ID**:D-12
- **Source**:R-09
- **Severity**:P1
- **Location**:`backend/src/server.js:25,145`
- **Description**:The upload middleware `multer({ storage: multer.memoryStorage() })` has no limits (single-file size, request count); the 10MB check happens in ingestFile (after multer has already buffered everything into memory), forming a memory-exhaustion attack surface (a single request keeps 50 × arbitrarily large files fully resident).
- **Verification evidence**:Configuration check + V-11 will empirically test over-limit behavior.
- **Fix plan**:Add `limits: { fileSize: 10MB, files: 50 }` to multer; the error middleware maps MulterError LIMIT_FILE_SIZE to ERR_FILE_TOO_LARGE (413) and LIMIT_UNEXPECTED_FILE to ERR_ENUM_INVALID (422, with a file-count limit hint). **Supporting decision**: verify_upload.js's 11MB case currently asserts the service-layer per-file error (results[0].code); once the middleware takes effect, that request is rejected before entering the service (HTTP 413 error envelope). This is the stronger behavior explicitly required by task specification V-11 (over-limit content does not fully enter memory), so the case's assertion is updated in step to 413+ERR_FILE_TOO_LARGE+message containing 10 MB — the assertion is strengthened (earlier rejection) rather than weakened, and this is registered as a test contract adaptation. All other existing assertions are untouched.
- **Verification method**:V-11 + upload suite regression.
- **Status**:Fixed (V-11; verify_upload assertions strengthened in step)

---

## D-13(R-10)

- **ID**:D-13
- **Source**:R-10
- **Severity**:P1
- **Location**:`backend/src/server.js:85-95(CORS),98-113(rate limiting)`
- **Description**:(1) The rate-limit key takes the first segment of x-forwarded-for, so a client can forge the header and reset the bucket on every change; (2) the rateBuckets Map grows without bound (memory leak/DoS surface); (3) `new URL(origin)` throws TypeError on a malformed Origin → 500 (V-09 "malformed origin headers do not cause server errors" is not satisfied); (4) see D-37, whitelist too broad.
- **Verification evidence**:Code check + V-09 will test empirically (forged headers, above-threshold frequency, malformed headers).
- **Fix plan**:(1) By default use `req.socket.remoteAddress` as the key, trusting x-forwarded-for only when `TRUST_PROXY=1` is explicitly set (set in production behind a proxy); (2) cap the number of buckets (e.g. 10,000), evicting the oldest bucket when exceeded; (3) wrap URL parsing in try/catch, treating a malformed Origin as not whitelisted and calling next() directly; (4) fall back to the default 60 instead of NaN when RATE_LIMIT_PER_MIN parses to an invalid value.
- **Verification method**:V-09 + a new rate-limit/malformed-header regression test.
- **Status**:Fixed (V-09 + regression test)

---

## D-14(R-11)

- **ID**:D-14
- **Source**:R-11
- **Severity**:P1
- **Location**:`backend/src/services/reviewQueue.js:78-108`
- **Description**:assignFactorManually and excludeRecord do not check record.task_id === taskId (cross-task rewriting of another task's records and matches); editRecordFields patch values have no type/range/length validation (intersecting with R-12); route-layer owner checks are closed out by D-06.
- **Verification evidence**:Code check (assignFactorManually:81-82 only checks existence); V-02/V-07 verify empirically.
- **Fix plan**:All three action functions gain a record.task_id check (on mismatch throw AppError ERR_TASK_NOT_FOUND, consistent with editRecordFields' current behavior); editRecordFields patch validation: quantity finite number > 0, amount finite number ≥ 0, unit/transport_mode/currency closed sets, string fields length cap 500, activity_date string ≤ 40.
- **Verification method**:V-02 (cross-task ID), V-07 (invalid patch) + a new cross-task and invalid-patch regression test.
- **Status**:Fixed (V-02/V-07 + regression test)

---

## D-15(R-12)

- **ID**:D-15
- **Source**:R-12
- **Severity**:P1
- **Location**:`backend/src/services/pipelineModelCalls.js:52-65`; `normalization.js:47-51`; `calculation.js:9-29`; review edit path (merged into D-14)
- **Description**:The whole quantity chain lacks finite-number validation: validateExtraction passes quantity when `NaN<=0` is false and when Infinity is a valid number; amount only checks `<0` (type unrestricted, so strings/Infinity pass); gross_weight_kg/distance_km have no validation at all; convertUnit multiplication and activityBasis have no defense against non-finite values; once such a value enters, it contaminates aggregation (sums become NaN), sorting (NaN comparisons in topEmitters fail) and reports.
- **Verification evidence**:Code reasoning + V-07 will inject non-numeric/infinite/zero/negative values through both the review edit and mock extraction paths and test empirically.
- **Fix plan**:validateExtraction applies uniform `Number.isFinite && type is number` validation to all numeric fields (quantity/amount/gross_weight_kg/distance_km/passengers if present), with quantity also > 0; convertUnit inputs gain a Number.isFinite guard (non-finite returns null without conversion); activityBasis throws on a non-finite basis.value (the existing unbridgeable path takes over as review). The review edit path validation is handled by D-14.
- **Verification method**:V-07 + a new numeric defense regression test (mock extraction injection + review edit injection).
- **Status**:Fixed (V-07 + regression test)

---

## D-16(R-13a)

- **ID**:D-16
- **Source**:R-13
- **Severity**:P1
- **Location**:`backend/src/config.js:85-89`; `backend/src/services/pipeline.js:209`
- **Description**: Numeric config items have no validation: AI_RETRY_COUNT=abc → attempts=NaN, the callModel loop does not execute and directly throws null; BATCH_SIZE/threshold/timeout NaN or negative values take effect directly; PIPELINE_CONCURRENCY=abc → Math.max(1,NaN)=NaN → worker array length NaN→empty→the pipeline silently runs empty (all documents left untouched, no error reported).
- **Verification evidence**: Code reasoning; Phase 4 will re-run with invalid environment variables in a live test.
- **Fix plan**: loadConfig applies "fall back to the default and log.warn on parse failure or out-of-range" to int/float items (ranges: AI_RETRY_COUNT≥0, AI_TIMEOUT_SECONDS>0, BATCH_SIZE>0, threshold ∈[0,1]); the pipeline concurrency gets an extra `Number.isFinite` guard, falling back to 4 when illegal.
- **Verification method**: New config-validation regression tests (config.test.js extension); A-2 full regression.
- **Status**: Fixed (regression test: illegal config falls back to default)

---

## D-17(R-13b)

- **ID**: D-17
- **Source**: R-13 (checkpoint 5.5.1)
- **Severity**: P1
- **Location**: `backend/src/ai/client.js:90-142`
- **Description**: The callModel retry loop does not distinguish error categories: dispatch already marks kind:'fatal' (4xx other than 429), but the loop still pointlessly retries fatal errors (authentication failure, invalid request) all the way to the end, driving up latency and cost; there is no backoff between retries.
- **Verification evidence**: Code review (the catch branch does not read err.kind).
- **Fix plan**: In catch, kind==='fatal' terminates the loop immediately and throws per the existing mapping (no more retry consumption); exponential backoff + jitter is added between retries (200ms×2^n ± jitter, effective only outside mock; tests using tiny values are unaffected — backoff applies only on the real adapter path, mock does not go through it).
- **Verification method**: aiRetry.test.js extension (assertion that fatal is not retried).
- **Status**: Fixed (aiRetry regression: fatal not retried)

---

## D-18(R-18)

- **ID**: D-18
- **Source**: R-18
- **Severity**: P2
- **Location**: `backend/src/ai/client.js:192-225 (embedTexts)`
- **Description**: The embedding batch call has no timeout and no retry; when the response embeddings count is less than the request count it is silently accepted, recall.buildSemanticIndex writes out of alignment by `vectors[i]`, and the bad index silently persists.
- **Verification evidence**: V-12 will test live with a simulated short response.
- **Fix plan**: Add an AbortController timeout to the batch call (reusing AI_TIMEOUT_SECONDS); strictly validate the response vector count against the chunk length, throwing ERR_MODEL_CALL_FAILED when short (one retry allowed); add the same timeout to embedText.
- **Verification method**: V-12 + new short-response regression test (injecting mock fetch).
- **Status**: Fixed (V-12 + regression test)

---

## D-19(R-14)

- **ID**: D-19
- **Source**: R-14
- **Severity**: P2
- **Location**: `backend/src/services/reportService.js:270`
- **Description**: The reference scan treats scenario anchors as `scenarios.has(ref) || String(ref).includes('_S-')` — the second clause exempts any ref_id containing the `_S-` fragment from existence validation, weakening the "invalid references are an automatic veto" governance.
- **Verification evidence**: Code review; provable by scanning a report constructed with a fake scenario anchor (the test will pin it down).
- **Fix plan**: Remove the `|| includes('_S-')` bypass; scenario anchors all go through scenarios.has existence validation (the storage-side id is `${taskId}_${scenario_id}`, so legitimate anchors hit anyway).
- **Verification method**: New fake-scenario-anchor regression test (legitimate anchors pass, fake anchors counted as invalid).
- **Status**: Fixed (regression test: fake scenario anchor counted as invalid)

---

## D-20(R-15)

- **ID**: D-20
- **Source**: R-15
- **Severity**: P2
- **Location**: `backend/src/store/index.js:37-52`
- **Description**: A collection file JSON parse failure is caught and silently reset to an empty Map — existing data is treated as nonexistent, with no warning at all, and the next put overwrites the whole file with the empty set (making the data loss permanent); #persist's whole-file writeFileSync is non-atomic (a crash halfway through corrupts it).
- **Verification evidence**: Code review; provable by corrupting one collection file and restarting the service (Phase 4 manual verification for the record).
- **Fix plan**: On parse failure, log.error (with the file name) before degrading to an empty set (alert, not silent); #persist changed to "write a temp file + renameSync atomic replace". Concurrent whole-file rewrite is last-writer-wins single-process semantics, kept as is (production uses Firestore).
- **Verification method**: New storage robustness tests (bad JSON file construction + atomic-write assertions); manually corrupt a file and restart for the record.
- **Status**: Fixed (regression: bad JSON warning + atomic write)

---

## D-21(R-16)

- **ID**: D-21
- **Source**: R-16
- **Severity**: P2
- **Location**: `backend/src/services/pipeline.js:137`; `backend/src/services/uncertainty.js:123-127`
- **Description**: Recall candidate confidence is hard-coded to 0.5 (< the 0.65 threshold), so assessRecord's allBelowThreshold is always true → every record containing candidates is flagged no_high_confidence_factor and opens a review item, giving the signal zero discriminating power; levelDistribution produces an `undefined: NaN` key for missing levels (the dashboard renders a NaN row).
- **Verification evidence**: Code review; after the fix, measure the flagging ratio and the distribution key set with the demo task.
- **Fix plan**: Candidates pass the real recall score (pipeline passes `match_confidence: c.score`; assessRecord already supports match_confidence taking precedence); levelDistribution folds missing levels into medium (`r.uncertainty_level ?? 'medium'`, consistent with the reporting side). After the fix, live verification is mandatory: the demo task's review queue is still non-empty (V-10 P8 depends on it) and evaluation metrics do not regress (A-6).
- **Verification method**: A-6 + V-10 + new distribution-key purity test (three keys low/medium/high).
- **Status**: Fixed (regression: three distribution keys; V-10 P5)

---

## D-22(R-17)

- **ID**: D-22
- **Source**: R-17; task specification 5.4.3
- **Severity**: P2
- **Location**: `backend/src/queue/index.js` (entire file); `backend/test/queue.test.js`
- **Description**: The queue abstraction is not referenced by any server-side code (in the whole repository, only its own test references it), and it has a double-dispatch defect where runtime setImmediate dispatch does not remove from pending, causing duplicate consumption on stop/start; the server actually executes the pipeline inline.
- **Verification evidence**: Whole-repository reference search (grep queue/index and createQueue/InProcessQueue): only backend/test/queue.test.js.
- **Fix plan**: **Remove** (task specification 5.4.3 authorizes a choice between two options): delete backend/src/queue/index.js and backend/test/queue.test.js, reclaiming lines to offset the D-02 overspend; the "async task-queue abstraction" wording in the README is revised accordingly (D-46). Reason for not choosing "fix": fixing something with no caller is pure expenditure, and the line budget is already 110 lines over.
- **Verification method**: A-2 (total test case count stays ≥ baseline thanks to the new regression tests) + A-5 (metric B back to ≤7000) + full build/test.
- **Status**: Fixed (A-2/A-5)
- **Red-line cross-check note**: Red line 3 prohibits "deleting/weakening assertions to make tests pass"; this item is dead-code cleanup (that test already passes as is), and task specification 5.4.3 explicitly authorizes the removal option; the total test case count does not decrease (see verification method).

---

## D-24(R-19)

- **ID**: D-24
- **Source**: R-19
- **Severity**: P2
- **Location**: `backend/src/services/normalization.js:101-110`
- **Description**: In the currency recognition table the CNY row (containing `¥`) precedes the JPY row, so the `¥jp` marker is never reachable and a bare `¥` is always judged CNY; ambiguous symbols have no context disambiguation.
- **Verification evidence**: Regex order reasoning; test cases will be written for all currency symbols.
- **Fix plan**: Reorder the recognition sequence — explicit codes/unambiguous symbols first (USD/$/dollars, EUR/€, JPY/円/yen/¥jp, HKD/港币, CNY/人民币/RMB), bare `¥` last and judged CNY only (the Chinese-language default, compatible with existing behavior).
- **Verification method**: normalization.test.js extended with all-symbol test cases.
- **Status**: Fixed (regression: all-currency-symbol test cases)

---

## D-25(R-20)

- **ID**: D-25
- **Source**: R-20
- **Severity**: P2
- **Location**: `backend/src/services/fileService.js:58-63`
- **Description**: XLSX validation is only the existence of the `xl/workbook` substring inside the archive, with no defense against decompression amplification.
- **Verification evidence**: Whole-repository search confirms no local decompression path exists (XLSX is handed to the model as-is via inline_data, not decompressed locally); the compressed body is bounded by the 10MB limit; amplification happens on the model side, not in this service.
- **Fix plan**: **Intentionally retained + documented** — this service does not decompress XLSX, so there is no local resource-consumption surface for zip bombs; the 10MB limit (enforced by middleware, D-12) bounds the input size. Record this assessment in the README security notes and the fix report.
- **Verification method**: Registered for the record (this item is itself the disposition conclusion); V-11 covers the over-limit behavior.
- **Status**: Intentionally retained (with assessment rationale)

---

## D-26(R-21)

- **ID**: D-26
- **Source**: R-21
- **Severity**: P2
- **Location**: `backend/src/services/fileService.js:33-37,54-57`
- **Description**: PDF page count is tallied with a raw-byte regex `/\/Type\s*\/Page[^s]/g`: compressed object stream (ObjStm) PDFs are undercounted (page dictionaries do not appear in plaintext), 0 pages are misjudged as corrupt, and N>0 pages are silently split into too few units, affecting page-unit splitting and the page cap for reference tracking.
- **Verification evidence**: live measurement of the 9 golden PDFs shows 0 deviation (tool-generated, uncompressed); the defect is a robustness gap for real-world compressed PDFs, not a current data error.
- **Fix plan**: The PDF branch of ingestFile switches to loading with pdf-lib (an existing dependency) and taking getPageCount: it parses object streams natively and comes with real corruption detection (load throws → ERR_FILE_CORRUPT); the regex-based countPdfPages export then has no references (used only in this file), so it is deleted to reclaim lines.
- **Verification method**: New multi-page PDF page-count regression test (including the four-page GD-09) + regression of the existing upload suite.
- **Status**: Fixed (regression: multi-page counting + corrupt PDF rejection)

---

## D-27(R-22)

- **ID**: D-27
- **Source**: R-22
- **Severity**: P2
- **Location**: `backend/src/services/exportService.js:34-41,103-118`; `reportService empty-header propagation`
- **Description**: reportPdf's Promise resolves only on 'end', with no 'error' handling when PDFDocument throws → the request hangs; renderTable with an empty header → 495/0=NaN width; categorySummaryCsv `b.header[0].startsWith` with an empty header array → TypeError 500. (The "table truncation undisclosed" sub-point is not substantiated: line 117 already discloses with `… N more rows`.)
- **Verification evidence**: Code review; the exception path is tested live with a bad report object.
- **Fix plan**: Add `doc.on('error', reject)` to reportPdf; renderTable skips rendering when the header is empty (defensive); categorySummaryCsv has an empty-header guard returning a header-row-only CSV.
- **Verification method**: New export robustness regression tests (reportPdf rejects instead of hanging, empty header does not blow up).
- **Status**: Fixed (regression: PDF rejects instead of hanging, empty-header guard)

---

## D-28(R-23)

- **ID**: D-28
- **Source**: R-23; checkpoint 5.7.1
- **Severity**: P2
- **Location**: `scripts/verify_extraction_real.js`, `verify_boundary_real.js`, `verify_selection_real.js`, `verify_report_real.js` (none has a guard); `eval/collectors.js:24-29`
- **Description**: Of the five real-adapter verification scripts, only classification has a "no GEMINI_API_KEY → exit 2" guard; the other four, when run without a key, overwrite the formal metric evidence files with mock results; the collector blindly trusts the pass field of result files and does not verify the adapter origin.
- **Verification evidence**: grep GEMINI_API_KEY hits only once across the five scripts; collectors.js only reads measured/pass.
- **Fix plan**: Add the same guard to the top of the four scripts (exit 2, consistent with the classification script); when a result file contains an adapter field whose value is 'mock', collectors treat real metrics as "not measured" (pass=false, evidence annotated as mock evidence unavailable) — mock demo result files are unaffected (items that do not depend on the adapter field remain as-is; blocking occurs only when the field exists and is mock).
- **Verification method**: Run the four scripts in a keyless environment and assert exit 2 with no result files written (Phase 4 for the record); eval/run.js regression (A-6).
- **Status**: Fixed (four-script guard + collector rejects mock + results stamped with adapter)

---

## D-29(R-24)

- **ID**: D-29
- **Source**: R-24
- **Severity**: P2
- **Location**: `Dockerfile`; `firebase.json`
- **Description**: The container has no HEALTHCHECK instruction (the platform restart policy loses its health signal); Firebase Hosting has no security response headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy).
- **Verification evidence**: Config file review.
- **Fix plan**: Add to the Dockerfile `HEALTHCHECK CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"` (the slim image has no curl, so use node); add global security headers to firebase.json headers (CSP allowing self + the connection targets Firebase auth domains require, HSTS, DENY frame protection, nosniff). Configuration changes only; the local equivalent headers are cross-checked with V-09 (the dev server has the backend middleware send the same headers for lightweight verification — no runtime code added, documented by config review).
- **Verification method**: Config diff for the record + docker build not executed locally (red line: do not execute deployment commands; HEALTHCHECK syntax checked against the documentation).
- **Status**: Fixed (Dockerfile HEALTHCHECK + firebase.json security headers)

---

## D-30(R-25)

- **ID**: D-30
- **Source**: R-25
- **Severity**: P3
- **Location**: `frontend/src/pages.jsx:281-302 (P6)`
- **Description**: The replacement-ratio slider's ratio only enters state, and the blur callback calls only `api.runPipeline(taskId)` without passing the ratio — a dead slider coexisting with an expensive side effect (a full pipeline re-run).
- **Verification evidence**: Code review; V-10 P6 will test the network request live.
- **Fix plan**: Pass `ratio` through in the run request body (optional number, default 1.0); the server /run receives it and passes it into runPipeline → computeScenarios (the ratio parameter already exists); the slider on blur sends the current ratio and then refreshes the report. The pipeline re-run is existing design ("recompute at the selected ratio"), kept.
- **Verification method**: V-10 (P6 slider behavior) + manual check that the run request body contains ratio.
- **Status**: Fixed (V-10 P6: the ratio actually takes effect)

---

## D-31(R-26)

- **ID**: D-31
- **Source**: R-26
- **Severity**: P3
- **Location**: `frontend/vite.config.js:6-11`; `frontend/src/pages.jsx:221 (P4 mount)`
- **Description**: The dev proxy does not cover /factors (factor queries in local development 404); P4 fires an empty `api.factors('')` query on mount, which inevitably returns 400.
- **Verification evidence**: Config review + request path reasoning.
- **Fix plan**: Add `'/factors': 'http://localhost:8080'` to the vite proxy; delete the empty query call on P4 mount (the candidate list is already driven by factorSearch(record)).
- **Verification method**: V-10 (full local development flow, factor candidates visible).
- **Status**: Fixed (V-10 P4)

---

## D-32(R-27)

- **ID**: D-32
- **Source**: R-27
- **Severity**: P3
- **Location**: `backend/src/services/reviewQueue.js:45-54 (audit id)`; dedup timing; linear search
- **Description**: The audit record id `aud_rev_<recordId>_<Date.now()>` uses a millisecond timestamp, so two actions on the same record within the same millisecond collide and overwrite each other; dedup happens before normalization (sub-point not substantiated: the design is byte-level sha256, and semantic duplicates are covered at the record level by markSuspectedDuplicates); multiple O(n²) linear searches (sub-point intentionally retained: task-level n is small, no measured bottleneck).
- **Verification evidence**: Code review.
- **Fix plan**: Add a random suffix to the audit id (aligning with the existing ai_traces pattern `Date.now()+random`); the other two sub-points are recorded as conclusions with no code change.
- **Verification method**: Code review for the record; review-related regression tests do not regress.
- **Status**: Fixed (random suffix added to the audit ID)

---

## D-33(R-28)

- **ID**: D-33
- **Source**: R-28; checkpoint 5.5.3 (concurrency)
- **Severity**: P1 (directly affects V-08 acceptance)
- **Location**: `backend/src/services/pipeline.js:60`; `backend/src/services/taskRuns.js`; `backend/src/server.js:191-203`
- **Description**: On re-run, completed documents are skipped but return an empty accumulation — the re-run task report lacks the records and calculations of completed documents (the stale calculations of completed documents also remain in the store); taskRuns only waits single-flight without queuing — a second concurrent trigger of the same task processes the remaining documents after the first run finishes, and its assembleReport contains only the records processed by the second run, making the report inconsistent with the ledger (V-08 will definitely fail).
- **Verification evidence**: Code reasoning + V-08 will test live with two consecutive triggers.
- **Fix plan**: (1) For completed documents, processDocument now loads their existing records/calcs/matches from storage into the accumulation (no longer returning empty), so the re-run report is complete and, once review changes are recalculated via the dashboard, up to date; (2) before /run and /api/demo/load trigger, if the task already has a running execution, await it first before starting (chained queuing via taskRuns), guaranteeing serial execution for the same task. Stale calculation residue from review-excluded records: recalculateTask and generateReportForTask both filter by excluded_from_calc, so the read side is already immune (recorded as confirmed, no further change).
- **Verification method**: V-08 (PUBLIC_BASE pointing locally, running verify_consistency.js) + new re-run completeness regression test.
- **Status**: Fixed (V-08 + regression: re-run complete)

---

## D-34(R-29)

- **ID**: D-34
- **Source**: R-29
- **Severity**: P3
- **Location**: `backend/src/services/taskService.js:7-13`
- **Description**: Task creation only does truthiness shallow validation: entity_name can be any structure (object/array/overlong string); period_from/to have no type or ordering validation, so bad data reaches reports and PDFs.
- **Verification evidence**: Code review; live test creating a task with illegal fields.
- **Fix plan**: entity_name must be a non-empty string of ≤200 characters; period_from/to must be valid YYYY-MM-DD dates with from ≤ to; violations throw ERR_ENUM_INVALID (reusing the existing code, with the field name in the details).
- **Verification method**: New task-creation validation regression tests; the P1 form's normal path is unaffected (the form already sends strings).
- **Status**: Fixed (regression: task field validation)

---

## D-35(R-30)

- **ID**: D-35
- **Source**: R-30
- **Severity**: P3
- **Location**: `backend/src/store/index.js` vs `backend/src/store/firestore.js`
- **Description**: Adapter behavior differences — (1) undefined-value queries: local returns [], firestore `where(==, undefined)` throws; (2) document order: local is insertion order, firestore gives no order guarantee (latestReport, sorted by generated_at, is already immune; where lists are order-sensitive: the report appendix factor table order comes from listFactors → may differ, a display-order difference only); (3) list loads everything with no pagination (task-level data volume is manageable).
- **Verification evidence**: Item-by-item comparison of the two implementations.
- **Fix plan**: **Intentionally retained + difference table documented** (this item is the difference table): (1) all current call sites pass defined values (every query call checked one by one), so there is no trigger path; (2) order-sensitive reads already have explicit sorting; (3) the missing pagination is recorded as a known constraint, acceptable at the 20-200 records per task scale. A note is added in the README deployment considerations.
- **Verification method**: Register entry for the record; A-6 regression.
- **Status**: Intentionally retained (with difference table)

---

## D-36(R-31)

- **ID**: D-36
- **Source**: R-31; 6.3.4
- **Severity**: P3
- **Location**: `backend/src/services/reportService.js:95-97`; `backend/src/services/traceability.js:57-60`; `frontend/src/pages.jsx:156-159`
- **Description**: An empty loop in the report service (the inner slice(0,0) of the agg.scope double loop is always empty); an always-true dead branch on the inner `/^Sheet/` check in traceability; a dead loadRecords function in the frontend.
- **Verification evidence**: Whole-repository reference search confirms no side-effect dependencies.
- **Fix plan**: Delete all three, reclaiming lines to offset D-02.
- **Verification method**: A-2/A-5; reference coverage does not regress (A-6).
- **Status**: Fixed (A-2/A-5)

---

## D-37(R-32)

- **ID**: D-37
- **Source**: R-32
- **Severity**: P3
- **Location**: `backend/src/server.js:84-95`
- **Description**: The origin allowlist wildcard-permits cross-origin for any `*.web.app` / `*.firebaseapp.com` domain — any Firebase project (including someone else's) can read responses cross-origin.
- **Verification evidence**: Regex review (`/\.web\.app$|\.firebaseapp\.com$/`).
- **Fix plan**: Narrow to an explicit list: default `http://localhost:5173 http://127.0.0.1:5173 https://myproject-dc19d.web.app`, still extensible via the CORS_ORIGINS environment variable (deployment domain changes are configuration changes); the wildcard regex is deleted.
- **Verification method**: V-09 (non-allowlisted origins get no CORS headers) + existing integration does not regress.
- **Status**: Fixed (V-09 + regression: strict CORS allowlist)

---

## D-38(R-33)

- **ID**: D-38
- **Source**: R-33
- **Severity**: P3
- **Location**: `frontend/src/auth.js`; `frontend/src/api.js`
- **Description**: (1) uploadFiles does not check res.ok, so on a server error res.results is undefined → TypeError → the UI stays stuck on busy with no feedback; (2) in json(), `...opts` is spread after headers, so opts.headers would wholly overwrite the auth header (no caller passes it currently; latent); (3) no request has a timeout; (4) the long-lived refresh token is stored in localStorage (hijackable after XSS); (5) a failed refresh silently signs up a new identity → "appears successful but is actually a new identity", leaving the original owner's tasks unreachable (session mismatch).
- **Verification evidence**: Code review + exception path reasoning.
- **Fix plan**: (1) uploadFiles checks res.ok and throws an error message when not ok (the caller already has a note display channel); (2) the headers spread order is adjusted to opts first and auth headers after (auth headers cannot be overridden); (3) json/upload add a default AbortSignal.timeout(60s); (4)(5) **intentionally retained and documented**: the anonymous identity carries no PII and the token has low value; switching to a new identity after a refresh failure is the established "best-effort availability" trade-off, with the risk and improvement path recorded in the README privacy section and the fix report (backend sessions/HttpOnly cookies are architectural changes, beyond the minimal fix scope).
- **Verification method**: V-10 (upload error visibility — triggered with a file of an unsupported extension); code review retains evidence for (4)(5).
- **Status**: Fixed ((1) upload checks res.ok, (2) auth headers cannot be overridden, (3) 60s timeout; V-10 re-verified); (4)(5) intentionally retained (rationale in the fix plan)

---

## D-39 (newly found)

- **ID**: D-39
- **Source**: Phase 2 new finding (domain C)
- **Severity**: P1 (becomes a functional regression once D-06 is closed out)
- **Location**: `frontend/src/pages.jsx:137(AuditView)`
- **Description**: The audit view uses a bare `fetch('/api/tasks/...')` without an Authorization header; once D-06 owner validation takes effect, viewing the audit of tasks with an owner returns 403, and the error is not caught.
- **Corroborating evidence**: Code review.
- **Fix plan**: Route through the api layer (add audit(taskId, recordId) to api.js with auth headers).
- **Verification method**: V-10 (P3 expanded audit visible).
- **Status**: Fixed (V-10 P3 audit visible)

---

## D-40 (newly found)

- **ID**: D-40
- **Source**: Phase 2 new finding (domain C)
- **Severity**: P1 (becomes a functional regression once D-06 is closed out)
- **Location**: `frontend/src/pages.jsx:197(source document link),315-317(P7 export three links)`
- **Description**: Document download and the three exports are bare `<a href>` links, so browser navigation carries no auth header; tasks with an owner will return 403.
- **Corroborating evidence**: Code review.
- **Fix plan**: Add a `download(path)` helper to api.js (fetch + auth headers + blob + ObjectURL to trigger the download, including the filename); the P3/P7 links become buttons that call the helper. Behavior for tasks without an owner is unchanged.
- **Verification method**: V-10 (all three P7 exports succeed with correct content).
- **Status**: Fixed (V-10 P7 three exports succeed)

---

## D-41 (newly found)

- **ID**: D-41
- **Source**: Phase 2 new finding (domain B)
- **Severity**: P2
- **Location**: `backend/src/services/pipeline.js:49`
- **Description**: Document filtering excludes only discarded, so pending_duplicate documents enter the pipeline; the transition table has no pending_duplicate out-edge, so the first setDocumentStatus('parsing') throws, and every run necessarily produces a document_pipeline_failed error log (the status itself is not corrupted, but the error storm masks real failures).
- **Corroborating evidence**: Code review + transition-table derivation.
- **Fix plan**: Change the filter condition to `d.status !== 'discarded' && d.status !== 'pending_duplicate'`.
- **Verification method**: upload suite (duplicate-document scenario) regression + no failed log when a run is triggered after duplicate upload (evidence retained in Phase 4).
- **Status**: Fixed (pipeline filters pending_duplicate)

---

## D-42 (newly found)

- **ID**: D-42
- **Source**: Phase 2 new finding (domain B)
- **Severity**: P2
- **Location**: `backend/src/services/pipeline.js:203`
- **Description**: needsReview is taken from perDocRecords (the raw extraction objects; normalizeRecord returns new objects and uncertainty_level is written only to the latter) → the raw objects never have that field, so the document-level needs_review status is unreachable (the seven-state machine is missing one state; the P2 status icon never shows needs_review).
- **Corroborating evidence**: Object-identity derivation + post-fix measurement of the demo task's document status distribution.
- **Fix plan**: needsReview is now determined from the normalized recordsOut (the records actually produced for that document); the single-record processing failure path (processing_failed) also sets high uncertainty and is included as well.
- **Verification method**: V-01/V-10 (P2 status presentation) + A-6 (demo end-to-end does not regress).
- **Status**: Fixed (V-10 P2 status distribution)

---

## D-43 (newly found)

- **ID**: D-43
- **Source**: Phase 2 new finding (domain C)
- **Severity**: P3
- **Location**: `frontend/src/pages.jsx:77-78(P2 refresh)`
- **Description**: The polling refresh has no catch; after the task is cleaned up (deleted from local-store), an unhandled Promise rejection occurs every 2.5s, and the UI stays on Documents (0) with no notice.
- **Corroborating evidence**: Code review.
- **Fix plan**: Add a catch to refresh; on failure, clear it and show a one-time error notice (aligning the behavior of each page when local storage points to a deleted task).
- **Verification method**: V-10 walkthrough + evidence of P2 behavior after manually deleting the task.
- **Status**: Fixed (P2 polling has a catch)

---

## D-44 (newly found)

- **ID**: D-44
- **Source**: Phase 2 new finding (domain A)
- **Severity**: P3
- **Location**: `backend/src/server.js:116-125`
- **Description**: /factors with an empty q returns 400 + ERR_INTERNAL — pairing status code 400 with an internal error code is a semantic mismatch; after the frontend fix (D-31 removed the empty call) there is no caller.
- **Fix plan**: **Intentionally retained** — changing the code is an external contract change (verify scripts may assert the current behavior) with low benefit; after the frontend removed the call that always 400s, this path is only reachable through manual mis-invocation.
- **Verification method**: Recorded in the register as evidence.
- **Status**: Intentionally retained

---

## D-45 (newly found, merged into the D-06 related decision)

- **ID**: D-45
- **Source**: Phase 2 new finding (domain A/G)
- **Severity**: P3
- **Location**: `backend/src/errors.js`
- **Description**: The error-code registry lacks ERR_RATE_LIMITED (server.js:107 writes an inline response by hand) and the authorization-denial code; the README error-code list is missing the same entries.
- **Fix plan**: Add ERR_RATE_LIMITED (http 429, message identical to the current inline one) and ERR_FORBIDDEN (http 403, used by D-06) to the registry; server rate limiting now goes through AppError (external bytes unchanged); the README list is synchronized (D-46).
- **Verification method**: V-09 (rate-limit response code) + V-02 (403 code) + errors.test.js regression.
- **Status**: Fixed (registry gains ERR_FORBIDDEN/ERR_RATE_LIMITED)

---

## D-46 (newly found)

- **ID**: D-46
- **Source**: Phase 2 new finding (domain H)
- **Severity**: P2 (documentation credibility)
- **Location**: `README.md` (multiple places)
- **Description**: The README does not match reality — (1) line counts 4,132/6,976/8,771 vs measured 4,335/7,110/8,905 (the baseline itself overruns); (2) "cross-task, cross-identity and forged-header access are all rejected" does not match the current R-03/R-10/R-11 state (it becomes true again after the fix); (3) "async task-queue abstraction selects Cloud Tasks" no longer holds after D-22 removed it; (4) the error-code list lacks ERR_RATE_LIMITED/ERR_FORBIDDEN; (5) the test count 34 needs its composition noted and updated after the fix.
- **Corroborating evidence**: Item-by-item comparison of the README against measurements/code.
- **Fix plan**: In the delivery phase (V-13), revise item by item per the final post-fix measurements: measured values for the three line-count definitions, security-capability descriptions aligned with post-fix behavior, the queue wording changed to inline execution, error codes completed, and the test count annotated with its composition.
- **Verification method**: V-13 documentation reconciliation.
- **Status**: Fixed (V-13 comprehensive README revision)

---

## D-47 (newly found)

- **ID**: D-47
- **Source**: Phase 2 new finding (domain F, named in task brief 5.6.5)
- **Severity**: P3 (repository hygiene)
- **Location**: `scripts/golden/__pycache__/` (3 .pyc files)
- **Description**: Compiled caches are tracked and committed into git.
- **Corroborating evidence**: git ls-files confirms 3 .pyc files are tracked.
- **Fix plan**: `git rm --cached` to remove tracking; add a `__pycache__/` rule to .gitignore (adding a new ignore rule, not the reverse violation of "changing ignores to get files into the repository").
- **Verification method**: git status clean + A-4/A-7.
- **Status**: Fixed (__pycache__ untracked + ignored)

---

## D-48 (newly found)

- **ID**: D-48
- **Source**: Phase 2 new finding (domain H)
- **Severity**: P3
- **Location**: `progress/PROGRESS_SUMMARY.md`
- **Description**: The line counts/test counts/capability statements in the progress summary will change because of this round of fixes; as a historical document its conclusions are not retroactively edited, but an incremental record of this review's fixes must be appended to avoid contradictions between documents.
- **Fix plan**: In the delivery phase, add this round's fix report (in Chinese) under the progress directory, and append a one-line pointer at the top of PROGRESS_SUMMARY (without rewriting history).
- **Verification method**: V-13/V-14.
- **Status**: Fixed (fix report + PROGRESS_SUMMARY pointer)

---

## D-49 (checkpoint 5.5.5: prompt-injection surface)

- **ID**: D-49
- **Source**: Phase 2 (domain E checkpoint 5)
- **Severity**: P2 (attack-surface record)
- **Location**: `backend/src/services/pipelineModelCalls.js:184(extraction prompt),211(boundary:JSON.stringify(record)),234(selection:candidateSummary)`; classification input is file bytes
- **Description**: User- and model-controllable text (item names, locations, supplier names, printed content on documents) is concatenated directly into prompts; a malicious document can carry instruction text that influences model output (e.g., inducing a boundary misjudgment or factor selection). Existing mitigations: all outputs pass structured schema + closed-set validation + retry (out-of-enumeration values are rejected), factor selection is forced to a closed candidate set (AI-204), and numeric validation (after D-15) rejects non-finite values — the reachable injection surface is compressed to "picking the wrong value from a legal enumeration", and every step leaves a trace in ai_traces for audit.
- **Fix plan**: **Intentionally retained (identified + documented)**: no code-level isolation (such as instruction-wrapping markers / sensitive-instruction filtering) is added this round, because any prompt change requires re-running the real-adapter evaluation to prove extraction accuracy does not regress, which is beyond the minimal fix scope; mitigation suggestions (follow-up): wrap the input text in an explicit "the following is untrusted document content" segment with a length cap, and force a review flag on documents containing instruction keywords. Recorded under "not implemented items" in the fix report.
- **Verification method**: This entry is the disposition itself; A-6 evaluation does not regress.
- **Status**: Intentionally retained (with mitigation suggestions)

---

## D-50 (checkpoint 5.7.2: pre-commit secret defense)

- **ID**: D-50
- **Source**: Phase 2 (domain G checkpoint 2)
- **Severity**: P3
- **Location**: `scripts/scan-secrets.sh`
- **Description**: The secret scan only scans "tracked + not ignored" files, which is the right direction (no false positives on a legitimate local .env); but "accidentally staging .env" happens at git add time (when .env is ignored by .gitignore, add is refused, but `git add -f` or a renamed copy has no defense). Assessment: .gitignore already ignores .env and .env.*, so a normal add cannot get them into the repository, and only an explicit -f can bypass it, which is a deliberate human scenario.
- **Fix plan**: **Intentionally retained + documented**: no pre-commit hook is introduced (adding a hook is a new toolchain dependency with marginal benefit); the README secret-discipline section states the red line "never git add -f an ignored file"; scan-secrets stays as is (its git ls-files --others --exclude-standard already covers "new files that are not ignored", and a renamed copy containing secret patterns would be scanned out).
- **Verification method**: A-4 + recorded in the register as evidence.
- **Status**: Intentionally retained

---

## Defect register status summary (Phase 2 close-out)

- To be fixed: P0×4 (D-04/05/06/07), P1×10 (D-08/09/10/11/12/13/14/15/16/17/33/39/40, of which D-33 was raised to P1), P2×9 (D-18/19/20/21/22/26/27/28/29/41/42/46), P3 executed as budget permits.
- Not substantiated: R-20 sub-point (decompression amplification), R-22 sub-point (truncation disclosure), R-27 sub-point (deduplication timing).
- Intentionally retained: D-25, D-35, D-38(4)(5), D-44, D-49, D-50, R-27 linear-search sub-point.
- Baseline defects: D-01 (smoke), D-02 (line counts), D-03 (test-count definition).


---

## D-51 (Phase 4 V-10 new finding)

- **ID**: D-51
- **Source**: Phase 4 V-10 UI walkthrough
- **Severity**: P1 (a second-layer defect exposed after the D-09 fix)
- **Location**: `frontend/src/pages.jsx` (P4 candidate retrieval); `backend/src/server.js` (new candidates endpoint)
- **Description**: P4 is titled "Candidates (recall channel output)", but the implementation uses `/factors?q=<first 6 words joined by commas>` — that endpoint requires every word to match under AND semantics, so a free-text description (such as "Refrigerant HFC-32 top-up for plant HVAC") necessarily returns 0 rows, leaving the match viewer with no candidates to select and making it impossible to complete a manual factor assignment. Previously P4 read `task.records`, which was entirely unreachable, masking this problem.
- **Corroborating evidence**: `/factors?q=refrigerant` → 98 rows; `/factors?q=refrigerant,HVAC` → 0 rows; the candidate table is empty in the measured UI.
- **Fix plan**: Add `GET /api/tasks/:taskId/records/:recordId/candidates`, using the same recall channel as the pipeline (recallCandidates) to return the record's real candidates; the frontend P4 now uses it. Consistent with the page's own title.
- **Verification method**: V-10 (P4 candidates non-empty and one manual factor assignment completed).
- **Status**: Fixed

---

## D-52 (Phase 4 V-10 new finding)

- **ID**: D-52
- **Source**: Phase 4 V-10 visual verification (vision sub-agent)
- **Severity**: P1 (factual numeric error in the delivery report)
- **Location**: `backend/src/services/reportService.js:123`
- **Description**: The formula for the "Share" column in Chapter 2 of the report is `s.value * 1000 / totalKg * 100` — s.value and totalKg are both in kilograms, so the extra ×1000 inflates the share by a factor of one thousand (measured Scope 1/2/3 show 26240.4% / 34201.4% / 39558.2%, whereas the correct values should be 26.24% / 34.20% / 39.56%). Same root cause as R-07 (kg/t confusion) but at a different location, so the R-07 fix did not cover it.
- **Corroborating evidence**: V-10 P7 measured UI + formula derivation; `scripts/verify_consistency.js` only checks factors and emission values and does not cover this percentage column.
- **Fix plan**: Change to `s.value / (totalKg || 1) * 100` (kilograms over kilograms).
- **Verification method**: New regression assertion (the sum of the Scope shares ≈100% and each item ∈[0,100]); V-10 P7 re-verified.
- **Status**: Fixed

---

## D-53 (Phase 4 V-10 new finding)

- **ID**: D-53
- **Source**: Phase 4 V-10 visual verification
- **Severity**: P3 (UI column name does not match actual content, misleading reviewers)
- **Location**: `frontend/src/pages.jsx` (P3 "Factor" column)
- **Description**: The "Factor" column in the P3 table renders `r.match_id.replace('match_','')`, i.e., the record id (such as rec_1c09b706) rather than the factor id actually selected (EF-D26-…), so the column name does not match the actual content.
- **Corroborating evidence**: V-10 P3 measured UI (the column shows rec_1c09b706, while P4 shows the real factor id).
- **Fix plan**: Build a record_id→factor_id mapping from the calcs returned by the dashboard, change the column to show the real factor id, and show — when it is missing.
- **Verification method**: V-10 P3 re-verified (the column shows the EF-D26-… form).
- **Status**: Fixed

---

## D-54 (Phase 4 V-10 new finding)

- **ID**: D-54
- **Source**: Phase 4 V-10 visual verification
- **Severity**: P3 (UI displays raw null)
- **Location**: `frontend/src/pages.jsx` (P3 record-detail per-field table)
- **Description**: The detail table renders `typeof v === 'object' ? JSON.stringify(v) : String(v ?? '—')`; because `typeof null === 'object'`, empty-value fields (origin_location, transport_mode, etc.) display the literal "null" instead of the placeholder.
- **Corroborating evidence**: V-10 P3 measured UI shows "null".
- **Fix plan**: Check for null before checking for object: `v === null ? '—' : …`.
- **Verification method**: V-10 P3 re-verified (empty values show —).
- **Status**: Fixed

---

## D-55 (Phase 4 V-10 observation, inherent to mock)

- **ID**: D-55
- **Source**: Phase 4 V-10 visual verification
- **Severity**: Not substantiated (not a defect)
- **Location**: `backend/src/services/pipelineModelCalls.js` (mockSelection)
- **Description**: Visual verification found that the factors for several records do not match the activity semantics (e.g., "Factory grid electricity" → EF-D26-BUSINESSTRAVELAIR-018).
- **Corroborating evidence**: This phenomenon exists only in the mock adapter: mockSelection is a deterministic keyword-overlap heuristic; per the project policy "accuracy metrics are only ever computed from real-adapter runs", mock is used only for offline development and testing of pipeline connectivity. The real-adapter path is determined by the model plus closed-candidate-set validation (AI-204), and the online demo uses the real adapter.
- **Fix plan**: **No change** — modifying the mock heuristic has no benefit and could disturb existing evaluation evidence; this is expected behavior. Recorded under "mock mode notes" in the fix report.
- **Status**: Not substantiated (with explanation)

---

## D-56 (Phase 4 V-10 observation, appearance)

- **ID**: D-56
- **Source**: Phase 4 V-10 visual verification
- **Severity**: P3 (appearance)
- **Location**: `backend/src/services/calculation.js` (the scope grouping order of aggregate) → the table row order in Chapters 2/4 of the report
- **Description**: The report's Scope table row order is Scope 1, Scope 3, Scope 2 (insertion order by record processing order), not 1/2/3.
- **Corroborating evidence**: aggregate groups with a Map in record order; the worker pool merges back in document order, so the result is deterministic but unsorted.
- **Fix plan**: **Intentionally retained** — purely cosmetic; sorting would change the largest-remainder allocation order of displayConsistent and could disturb the already-validated "aggregate consistency" evaluation evidence, so the benefit does not outweigh the risk. Recorded as a known cosmetic item.
- **Verification method**: Recorded in the register as evidence; A-6 aggregate consistency does not regress.
- **Status**: Intentionally retained (with rationale)

---

## D-57 (Phase 4 V-10 observation, inherent to mock)

- **ID**: D-57
- **Source**: Phase 4 V-10 visual verification
- **Severity**: Not substantiated (not a defect)
- **Location**: `frontend/src/pages.jsx` (P3 detail table third column = per-field confidence)
- **Description**: Visual verification pointed out that the P3 "Fields & per-field confidence" table does not display confidence values.
- **Corroborating evidence**: The column reads `r.field_confidence?.[k]`; records extracted by mock come from the demo's expected_records.json, which itself does not contain field_confidence, so extractRecords falls back to an empty object; the real-adapter path forces field_confidence to be output via EXTRACTION_SCHEMA (the validator additionally requires every value ∈[0,1]).
- **Fix plan**: **No change** — a data dependency, not a code defect; real mode has values. Recorded as a mock note.
- **Status**: Not substantiated (with explanation)

---

## D-58 (Phase 4 second-review new finding)

- **ID**: D-58
- **Source**: Phase 4 second review
- **Severity**: P2 (evidence integrity, same class as R-23/D-28)
- **Location**: `scripts/verify_consistency.js` (evidence write site)
- **Description**: This consistency guard always writes `progress/evidence/T-050/consistency.json`. When `PUBLIC_BASE` points at a local service (an approach explicitly permitted by task brief V-08), it **overwrites the official evidence for the 3 public-network tasks** with local single-task results — this actually happened during this review and has been restored.
- **Corroborating evidence**: `git diff progress/evidence/T-050/consistency.json` shows 4 insertions and 16 deletions; after restoration it was confirmed as PASS for the 3 public-network tasks.
- **Fix plan**: Write the official filename only when `PUBLIC_BASE` is not overridden (i.e., when running against the default public-network target); local runs write `consistency-local.json` instead and print the actual path.
- **Verification method**: A local run confirms `consistency.json` no longer changes and `consistency-local.json` is generated; A-4/A-7 clean.
- **Status**: Fixed

---

## D-59 (Phase 4 self-regression, fixed)

- **ID**: D-59
- **Source**: Phase 4 V-10 walkthrough (P8 edit failure)
- **Severity**: P1 (regression introduced by a fix)
- **Location**: `backend/src/services/reviewQueue.js` (patch validation), `backend/test/regression.test.js`
- **Description**: D-14's patch validation initially required quantity/amount to be `number`, but the review UI (P8) input boxes submit strings, so every P8 edit failed with 422 (ERR_ENUM_INVALID) and the review loop was unusable.
- **Corroborating evidence**: V-10 P8 edit measured 422; console "Error: The model returned a value outside the allowed enumeration."
- **Fix plan**: Change to `normalizePatch`: numeric fields accept a number or a numeric string and are coerced to a number, while non-finite/out-of-range values are still rejected (such as 'abc', Infinity, NaN, 0, -3); what is persisted is always a number. This preserves the D-15 numeric defense while remaining compatible with the UI.
- **Verification method**: Regression assertions (string '5'→5 with typeof number; 'abc'/Infinity/NaN/0/-3 rejected); V-10 P8 re-verified (quantity 21000 persisted as int, and the report refreshes accordingly).
- **Status**: Fixed

---

## Phase 4 second-review conclusions (7.4)

**Method**: Re-review by file from a different angle (server.js → service layer → frontend → scripts), specifically looking for new problems introduced by the fixes themselves, interactions between fixes, and same-class omissions outside the defect register.

**New problems introduced by fixes (found and closed)**:
- During the fixes, D-51 (P4 candidates empty), D-52 (report Share column 1000×), D-53 (P3 factor column), D-54 (P3 null values displayed as null), and D-58 (evidence overwrite) were found, all registered and fixed.
- **D-59 (self-regression, fixed)**: D-14's patch validation initially required quantity/amount to be `number`, while the review UI input boxes submit strings → P8 edits failed with 422. Changed to "coerce numbers or numeric strings to a number, reject non-finite values", and regression assertions were added (string '5' becomes 5, 'abc'/Infinity/0/-3 rejected, persisted as number). Registered as D-59.

**Cross-fix interaction check**:
- D-06 owner validation + frontend D-39/D-40 (audit and download now carry auth headers): the two must take effect in the same batch, otherwise audit/export for tasks with an owner would fail — fixed in the same batch and re-verified via V-10.
- D-33 run serialization + D-05 scenario isolation + D-04 state machine: concurrent re-runs no longer produce half-written ledgers, scenario values are not persisted, and multi-page documents no longer abort — with all three combined, V-08 consistency PASSes.
- D-12 upload limits + verify_upload.js contract: exceeding the limit changed from "per-file error" to "middleware 413", which is a strengthening, and the assertions were synchronized.
- D-21 real recall score + D-15 numeric defense: candidate scores may exceed 1 (keyword + semantic combined), yet the threshold comparison still holds; the ledger contains no non-finite values.
- D-26 pdf-lib counting + documentUnits existing parsing: ingest and splitting each parse the PDF once, a minor overhead of duplicate parsing; correctness takes priority, so this is not considered a defect.

**Cross-check for similar omissions outside the defect register**:
- Re-checked the write targets of the remaining verify_* scripts one by one: `verify_public_faults.js`/`verify_public_perf.js`/`verify_acceptance.js` target the public network and were not run this round (red line: do not perform destructive verification against the public network), so their evidence was left untouched.
- Re-checked all frontend `<a href>` links and bare fetches: only brand links and hash-routed links remain; no leftover API access lacking the auth header.
- Re-checked all backend `store.put` primary keys: scenario paths are already isolated; audit IDs have a random suffix appended; report IDs are unique per task.
- Re-checked all `Number(` call sites and arithmetic entry points across the codebase: config, pipeline concurrency, rate-limit thresholds, patch values, extraction values, conversions, and calculation bases all have finiteness guards added.

---

# Second re-review (round 2): newly found by independent re-verification (D-60 to D-66)

> After phase 4 closed out, an independent re-verifier re-ran everything from a "file-by-file, assertion-by-assertion" perspective (7.4 requires "until zero new additions").
> This round **falsified the previous round's "zero new additions" conclusion**: 7 issues were found that the previous round had missed or left unclosed.
> All were registered before being fixed, each with accompanying regression assertions. The "zero dangling entries" wording in the round-1 conclusion is therefore corrected by this round.

## D-60 (newly found in the round-2 second re-review)

- **ID**: D-60
- **Source**: second re-review (round-2 independent re-verification)
- **Severity**: P1 (data destruction + document permanently stuck; triggerable from the UI's only run entry point)
- **Location**: `backend/src/services/pipeline.js:74-84` (cleanup of old records for non-completed documents) and `backend/src/services/fileService.js:133` (`TRANSITIONS.failed = ['queued']`)
- **Description**: For **all non-completed documents**, `processDocument` first deletes their existing `activity_records`/`calculations`/`matches`/`review_items`, then enters `withStatus(...,'parsing',...)`, whose very first step is `setDocumentStatus(...,'parsing')`. The transition table only allows an outbound edge from `failed` to `queued`, so `failed → parsing` throws `ERR_ENUM_INVALID`. There are two consequences: (1) **failed documents never recover** — no caller anywhere in the codebase resets `failed` back to `queued` (`POST /documents/:docId/status` has zero references in `frontend/src`, `scripts/`, and `backend/test`), so the document is silently excluded from reports from then on; (2) **data destruction** — if the document had already persisted records before failing (e.g. a `completed` document that became `failed` due to a re-verification recomputation failure), the rerun deletes those records first and then throws, leaving the records unrecoverable. Trigger condition: any document in `failed` state is run again (the only UI entry point is the P6 scenario page slider). This violates the explicit requirement in task specification 6.3.3 that "a failed state can be retried from the queued state".
- **Verification evidence**: the independent re-verifier tested: (a) forcing a single-document task into `failed` and rerunning → `records=0`, 0 records in storage; (b) deleting a unit representation file so that run 2 throws ENOENT inside `withStatus` → the existing 1 record + 1 calculation are deleted and the document is set to `failed`; from run 3 onward, `records=0`, `calculations=0`, chapter 5 of the report has 0 rows, and `total_kgco2e=0`. I re-verified the code path: `pipeline.js:76-83` deletes first, `:84` then sets `parsing`; the transition table in `fileService.js` has `failed: ['queued']`.
- **Fix**: (1) add `'parsing'` to `TRANSITIONS.failed` (consistent with the existing comment "processing states may re-enter parsing to support reruns"); (2) move the old-record cleanup to **after a successful rerun**, and delete only record ids not re-produced this time (record ids are randomly generated each time as `rec_<uuid8>`, so this criterion also guarantees no duplication and no accidental deletion).
- **Verification method**: regression assertions (set failed → rerun → record count > 0 and terminal state is not failed; running twice does not double the record count).
- **Status**: fixed

## D-61 (newly found in the round-2 second re-review)

- **ID**: D-61
- **Source**: second re-review (round-2 independent re-verification)
- **Severity**: P3 (hollow test assertion; weakens the regression guardrail)
- **Location**: `backend/test/regression.test.js:305`
- **Description**: `assert.equal(malformed.status, 429 < malformed.status ? malformed.status : malformed.status, …)` compares the value with itself, is always true, and constitutes no assertion at all; the line was intended to mean "a malformed Origin header does not cause a server error".
- **Verification evidence**: both sides of the expression are identical (both ternary branches return the same variable).
- **Fix**: replace with a meaningful assertion `assert.ok(malformed.status < 500, 'malformed origin never causes a server error')`.
- **Verification method**: A-2 (the assertion can actually fail under a malformed-header request).
- **Status**: fixed

## D-62 (newly found in the round-2 second re-review)

- **ID**: D-62
- **Source**: second re-review (round-2 independent re-verification)
- **Severity**: P3 (inconsistent validation across review actions; what D-14 declared as validation for "all actions" is actually "three actions")
- **Location**: `backend/src/services/reviewQueue.js:154-161` (`closeReviewItem`)
- **Description**: `editRecordFields`/`assignFactorManually`/`excludeRecord` all use `getTaskRecord` to validate that "the record belongs to this task", but `closeReviewItem` alone does not: calling `action=close` with an unknown or cross-task recordId returns 200 and writes a `review_closed` audit row (no cross-task data is modified, since the internal loop filters on `item.task_id !== taskId`).
- **Verification evidence**: code comparison (the three actions call `getTaskRecord`; `close` does not).
- **Fix**: add `await getTaskRecord(store, taskId, recordId)` at the start of `closeReviewItem`.
- **Verification method**: regression assertion (calling close with a cross-task recordId throws `ERR_TASK_NOT_FOUND`).
- **Status**: fixed

## D-63 (newly found in the round-2 second re-review)

- **ID**: D-63
- **Source**: second re-review (round-2 independent re-verification)
- **Severity**: P3 (config robustness: invalid values are silently truncated instead of falling back)
- **Location**: `backend/src/config.js:97-101` (`coerce`)
- **Description**: `Number.parseInt`/`Number.parseFloat` accept partial valid prefixes, so `AI_TIMEOUT_SECONDS='60abc'`→60, `BATCH_SIZE='1e3'`→1, `AI_RETRY_COUNT='2.9'`→2, and `CLASSIFICATION_CONFIDENCE_THRESHOLD='0.7junk'`→0.7 are silently adopted, rather than falling back to the default values as intended by 5.6.1.
- **Verification evidence**: called `loadConfig` with invalid environment variables and measured the four values above.
- **Fix**: for int/float, `coerce` now requires the entire string (after trimming whitespace) to be a finite number; otherwise it returns `NaN` and lets the existing range guard fall back to the default value.
- **Verification method**: regression assertions (`'60abc'`/`'1e3'`/`'2.9'` fall back to the defaults 60/10/2 respectively).
- **Status**: fixed

## D-64 (newly found in the round-2 second re-review)

- **ID**: D-64
- **Source**: second re-review (round-2 independent re-verification)
- **Severity**: P3 (dead code; candidate for line-count budget offsetting)
- **Location**: `backend/src/services/factorLibrary.js:84`, `backend/src/store/index.js:97`, `backend/src/services/classification.js:46`, `frontend/src/auth.js:74-78`
- **Description**: four places confirmed as zero-reference/unreachable: (1) `export const FACTOR_LIBRARY_FILE = FACTOR_FILE` appears only on that one line in the whole codebase; (2) `export const STORE_COLLECTIONS = COLLECTIONS` appears only on that one line; (3) the `type` of the `[/blurry|blank/, null]` entry in the `mockClassification` rule table is null, while the consuming loop filters with `if (re.test(n) && type)`, so that entry never takes effect, and `/blurry/` is already handled separately later; (4) `export async function currentIdToken()` has zero calls anywhere (the frontend reads `window.__idToken` directly).
- **Verification evidence**: a codebase-wide reference scan with `grep -rn` (both exports match only their own definition line); reasoning through the rule table's consumption conditions; a codebase-wide occurrence count over all `export function/const/class` (any export whose only match count is 1 is a dead export), which yielded only `currentIdToken`.
- **Fix**: removed the four pieces of dead code above (removing the unreachable rule is behavior-equivalent, since `blank` already falls into the default `other`/0.55 branch).
- **Verification method**: A-2/A-6 (no behavioral regression).
- **Status**: fixed

## D-65 (newly found in the round-2 second re-review)

- **ID**: D-65
- **Source**: second re-review (round-2 independent re-verification)
- **Severity**: P3 (asymmetric numeric guard; currently unreachable with existing data, defense in depth)
- **Location**: `backend/src/services/calculation.js:58,73`
- **Description**: `computeEmission` has a finiteness guard for `basis.value` (D-15), but `factorValue` (including the GWP-converted `co2+ch4+n2o`) and the product `emissionKg` are persisted without validation; if a factor file is overwritten or a storage row is manually rewritten to a non-numeric value, `NaN` will flow through `calculations` into `aggregate` and the report.
- **Verification evidence**: all 743/743 factors in `data/factors/emission_factors.json` have finite numeric `value`, and `gas_breakdown` has no invalid types, so it is currently unreachable; code path comparison confirms there is no guard before persistence.
- **Fix**: after computing `emissionKg` and before constructing `calc`, add a `Number.isFinite(emissionKg)` guard that throws an error the pipeline can downgrade to review.
- **Verification method**: regression assertions (invalid factorValue → throws; existing calculation cases do not regress).
- **Status**: fixed

## D-66 (newly found in the round-2 second re-review)

- **ID**: D-66
- **Source**: second re-review (round-2 independent re-verification)
- **Severity**: P3 (incomplete shape validation of embedding responses)
- **Location**: `backend/src/ai/client.js:238-239,251`
- **Description**: `embedTexts` only validates `parsed.embeddings.length === chunk.length` and does not validate whether each element's `values` is a non-empty array; `recall.js:58` writes into the index by position, and `cosine` silently produces NaN/-1 scores for `undefined` instead of raising an error.
- **Verification evidence**: code path comparison; the D-18 regression covers only one response shape, "insufficient count".
- **Fix**: after the count check passes, validate each `values` entry as a non-empty array, otherwise fail explicitly with `ERR_MODEL_CALL_FAILED`.
- **Verification method**: regression assertions (missing element/empty array → explicit failure).
- **Status**: fixed

## D-67 (newly found in the round-2 second re-review)

- **ID**: D-67
- **Source**: second re-review (round-2 independent re-verification, API-level end-to-end re-verification)
- **Severity**: P2 (data integrity: a rerun can silently empty the existing ledger; in mock mode it can be triggered directly by a caller that omits the flag, and in real mode it can be triggered by a "soft empty extraction")
- **Location**: `backend/src/services/pipeline.js:74-90` (rerun replacement logic for non-completed documents), `backend/src/server.js:228-241` (mock catalog construction for `/run`)
- **Description**: when rerunning a **non-completed** document, the pipeline first finds the document's existing records by `source_ref` prefix and deletes them, then re-extracts. If this rerun's extraction produces nothing (0 records), the old records have been deleted and there are no new ones → the document's ledger is emptied, yet the task still reports `completed` with no error at all. There are two triggerable paths: (1) **mock mode**: when the request body does not contain `useMockCatalog`, the `/run` endpoint passes an empty `Map`; that catalog is the mock extractor's only data source, so 0 records are guaranteed; (2) **real mode**: the same happens when the model softly returns an empty record set (without throwing). Measured (local mock, one-click demo with 20 documents): after the rerun, `activity_records` in storage drops **from 20 records to 2**, `calculations` 20→2, `matches` 20→2, `review_items` 18→0, the report then reflects only the 2 surviving records, yet the task shows as successful.
- **Verification evidence**: (a) local service + one-click demo + a rerun without `useMockCatalog`, reading the collection files under `STORE_ROOT` directly gives counts of 20→2; (b) **attribution test**: using `git checkout 12f1286 -- backend/src/services/pipeline.js backend/src/services/fileService.js` to restore the version before D-60 and rerunning the same scenario also gives 20→2 → confirming it is a **pre-existing defect, not introduced by this round's fixes**; (c) server logs show no `recall_started` event at all in the second run, proving the extraction stage produced nothing and never reached the matching stage.
- **Scope of impact**: the only caller in the repository, `frontend/src/api.js:27`, already passes `useMockCatalog: !window.__REAL_AI__` correctly, so the UI path is unaffected; production deployments using the real adapter are also unaffected. However, "a rerun must not silently shrink the ledger" is the underlying invariant of the idempotent-rerun intent in D-33/V-08, and V-08's automated evidence (`verify_consistency.js` only checks that the report is self-consistent with the **surviving** ledger) is blind to this case — this blind spot is recorded here.
- **Fix**: adopt the most conservative stance — **when the rerun produces nothing while the document's existing records are non-empty, keep the existing records and calculations rather than deleting them, and log a `document_reprocess_empty` warning**, instead of emptying the ledger; only replace old records when the rerun actually produces output.
- **Verification method**: regression assertions (D-67: after a rerun with no catalog, the record count remains 2, the storage count is 2, and the total is > 0).
- **Status**: fixed

## D-68 (newly found in the round-2 second re-review)

- **ID**: D-68
- **Source**: second re-review (round-2 independent re-verification, exit-code contract check of verification scripts per 5.7.5)
- **Severity**: P2 (verification-chain correctness: the script reports PASS yet exits non-zero, so any caller that consumes the exit code treats success as failure)
- **Location**: `scripts/verify_consistency.js:109`, `scripts/verify_acceptance.js:369`, `scripts/verify_public_faults.js:241`, `scripts/verify_public_perf.js:209`
- **Description**: these 4 scripts `fetch` first and then end with `process.exit(code)`. In this project's declared execution environment (Windows + Git Bash, Node v24), when the process has **no other active handles** besides undici's sockets, `process.exit()` triggers the assertion `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c, line 76` during libuv's asynchronous handle-closing process, and the process exits with **127** — even though the script itself has already correctly printed `PASS`. That is, "the result is correct but the exit code is wrong", which directly breaks the exit-code contract (0/1/2) that task specification 5.7.5 requires to be checked, and makes any caller that judges by exit code misjudge success as failure.
- **Verification evidence**: minimal reproduction — `node -e "await fetch(URL).then(r=>r.json()); await fetch(URL).then(r=>r.json()); console.log('ok'); process.exit(0)"` → after printing `ok`, the assertion fires and it exits with 127; the same code **without `process.exit`** exits cleanly with 0. Measured: `PUBLIC_BASE=http://127.0.0.1:8134 node scripts/verify_consistency.js <task>` prints `PASS (20 rows, 0 mismatch(es))` but `exit=127`. Control: `scripts/verify_upload.js`, which also does fetch + `process.exit`, does not trigger the assertion because it holds an active handle from `app.listen()` (three measured runs all exited 0), so only the 4 scripts with "no other handles" are affected; `verify_upload` is out of scope for changes.
- **Scope of impact**: `verify_consistency.js` is the evidence script for V-08; `verify_acceptance.js`/`verify_public_faults.js`/`verify_public_perf.js` target the public network and were **not run** this time (red line: do not perform verification against the public network), and their affectedness is inferred from the minimal reproduction and the shared root cause of "no active handles".
- **Fix**: change the trailing `process.exit(code)` in the 4 scripts to `process.exitCode = code`, letting the process exit with the correct code after handles close naturally (it has been confirmed that these 4 scripts have no active handles other than awaited sleeps, so they will not hang). The early-exit `process.exit(2)` at `verify_consistency.js:30` (the missing-evidence-file path, which occurs before any fetch and has no undici handles) is left untouched.
- **Verification method**: `PUBLIC_BASE=http://127.0.0.1:<port> node scripts/verify_consistency.js <taskId>` → prints PASS with `exit=0`; A-1/A-2/A-3/A-4/A-6 do not regress.
- **Status**: fixed

## Round-2 second re-review conclusion

- **This round added 9 entries (D-60 to D-68), all fixed with accompanying regression assertions**; among them D-60 is P1 (data destruction + permanent lock-up), D-67 and D-68 are P2 (rerun silently empties the ledger; verification-script exit-code contract broken), and the rest are P3.
- **Correction to the round-1 conclusion**: the round-1 wording "zero dangling entries / zero new additions" is not substantiated — D-60 is a same-class issue missed by round 1 (the "failed-state retry" branch of the D-04 state-machine family was not verified), D-61 is a hollow assertion in round 1's own regression tests, D-67 is the D-33 idempotent-rerun intent never having been verified end to end, and D-68 is the 5.7.5 exit-code contract never having been measured on Windows. This defect register takes this round's conclusion as authoritative.
- **A-5 impact**: D-64 reclaims 8 lines; the remaining fixes are net line additions, all folded into the D-02 final account (the over-budget line items have been recorded and accepted per 2.6.2).
