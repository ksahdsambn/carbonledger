# Acceptance Record (Second-Round Comprehensive Review) — 2026-10-15

> HEAD range under review: `7635e44` (three commits after the first-round wrap-up) → this round's fix wrap-up.
> Environment: Node v24.12.0 / Git Bash (win32) / mock mode throughout, zero external API calls (zero cost).
> Evidence directory: `progress/evidence/audit2-2026-10-15/`.

## 7.1 Automated Acceptance Battery

| Item | Command | Result | Key Notes |
|---|---|---|---|
| A-1 | `npm run build` | ✅ Pass | Frontend 37-module build + backend syntax check OK |
| A-2 | `npm test` | ✅ Pass | **49/49** (all 48 baseline items retained + 1 new D-104 regression; includes the post-D-101-fix D-07/V-03 cases) |
| A-3 | `npm run smoke` | ✅ Pass | SMOKE OK (health 200, structured logs, no residual listeners on shutdown) |
| A-4 | `npm run scan-secrets` | ✅ Pass | 0 hits, exit code 0 |
| A-5 | `bash scripts/count_lines.sh` | ✅ Pass (exemption on file) | A=5,828 / B=9,049 / C=10,851. B exceeds 7,000 and C exceeds 10,000, per the T-052 maintainer's written exemption (README + first-round D-02 + execution_log marker + verify_acceptance C4 exemption recognition); this round's increments are recorded in D-102. After the D-106 fix, the conclusion line states the actual scope C overage factually |
| A-6 | `node eval/run.js` | ✅ Pass | All 11 metric groups PASS, summarizing existing evidence files only (the result file diff contains only the run_at timestamp) |
| A-7 | `git status` | ✅ Pass | Clean; `.env`/`frontend/.env`/dist/local storage not committed (verified with zero hits via `git ls-files`) |

## 7.2 Targeted Acceptance Scenarios

| Item | Scenario | Result | Notes and Evidence |
|---|---|---|---|
| V-01 | Multi-page document full flow | ✅ Pass | Real gold-standard four-page GD-09: 4 units → 1 record per page (page=1..4) → status needs_review (compliant) → ten-chapter report with 6 anchors. The automated regression (generated two-page PDF) is the same D-04/V-01 case within the suite. Evidence: `v01_multipage.json` |
| V-02 | Authorization matrix | ✅ Pass | 15 task-level routes × 3 identities (HTTP verified): owned tasks return 403 ERR_FORBIDDEN for anonymous/wrong token, the owner is fully allowed (business 4xx counts as pass); unowned tasks are open to all three identities; the task list hides tasks owned by others. Evidence: `v02_v03_v08_v11.json` |
| V-03 | Path traversal | ✅ Pass | 5 malicious file names (`../../`, `..\..\`, `C:\abs\`, `/abs/`, `sub/../../`) are all sanitized to basename via HTTP upload, with zero directory-tree escapes inside or outside the sandbox. Evidence: `v02_v03_v08_v11.json` |
| V-04 | Scenario isolation | ✅ Pass | Regression case D-05/V-04 (persist:false, ledger and audit write nothing); in the V-08 full flow the report anchor equals the dashboard recomputed value |
| V-05 | Report anchor values | ✅ Pass | Regression case (anchors equal the dashboard tonnage values item by item, including per-record anchors); V-08 measured anchor_total_t=report_total_t=306.893 |
| V-06 | CSV formula injection | ✅ Pass | Regression case D-11/V-06 (`=+@-` prefix neutralized, negatives stay numeric) |
| V-07 | Numeric defenses | ✅ Pass | Regression cases D-14/D-15/V-07 (NaN/∞/0/negative/string all rejected across paths) |
| V-08 | Concurrent runs | ✅ Pass | Double trigger 202/202 + in-run polling 200 → single consistent report; `verify_consistency.js` (PUBLIC_BASE points locally) 20 lines, 0 mismatches, PASS. Evidence: `v02_v03_v08_v11.json`, `v08_consistency_local.json`, `v08_consistency_console.txt` (T-050 original evidence backed up and restored) |
| V-09 | Rate limiting and origin protection | ✅ Pass | Rate limit 3/min instance: forged X-Forwarded-For is not bucketed separately (4th request 429 ERR_RATE_LIMITED), healthz exempted, malicious Origin has no CORS header, localhost echoed, malformed Origin has no 5xx. Evidence: `v09_rate_cors.json` |
| V-10 | UI full-flow walkthrough | ✅ Pass | Browser page-by-page verified: P1 create task → P2 one-click demo with 20 documents (4 completed/16 needs_review) → P3 table with 20 non-empty rows + expandable detail + audit steps → P4 manual assignment of the suboptimal factor (API review confidence=1.0) → P5 four KPIs + donut chart → P6 slider at 50% gives S-2 savings −200.905→−100.453 exactly halved → P7 ten chapters + citation coverage 100% + PDF/two CSVs (content verified: PDF magic number, CSV header and manual-factor row 148.8t=12kg×12400) → P8 edit quantity 21000 persisted and report 454.301→459.994 refreshed → P9 176 traces with 0 failures. Also verified D-103: after stopping the backend, slider recomputation failure shows a clear alert. 12 screenshots verified by the vision sub-agent over two rounds, 12/12 PASS. Evidence: `v10-screenshots/*.png` (12 files), `carbonledger-report.pdf`, `activity-detail.csv`, `category-summary.csv` |
| V-11 | Upload defenses | ✅ Pass | Empty file / disguised extension / corrupted PDF → 200 with per-file ok:false (ERR_FILE_CORRUPT / ERR_FILE_FORMAT_UNSUPPORTED, consistent with the PRD 3.2 batch semantics); 11MB → middleware 413 ERR_FILE_TOO_LARGE (streamed rejection); 51 files → 422 ERR_ENUM_INVALID. Evidence: `v02_v03_v08_v11.json` |
| V-12 | Embedding batch defenses | ✅ Pass | Regression cases D-18/V-12 + D-66 (explicit failure after short-response retry) |
| V-13 | Documentation reconciliation | ✅ Pass | README revision: test count 48→49 (48 unit/e2e + 1 upload), the three-caliber line counts 5,828/9,049/10,851 match the measurements verbatim, and the NFR-504 section adds a second-round defect register citation; the 741 factors/commands/error codes/environment variables table rechecked for consistency |
| V-14 | Defect register closure | ✅ Pass | `DEFECT_REGISTER_2026-10-15.md`: 6 entries D-101~D-106, 4 fixed (each citing passing verification), 1 intentionally retained (D-105 with rationale), 1 documentation fix (D-102); every row of the R-01~R-33 verification table is closed; no "to be fixed" items and no decision-less entries |

## 7.3 No-Regression Confirmation

- All 48 baseline items retained and passing (after the D-101 fix, 48/48 stable across 3 rounds); 49/49 after adding the new regression.
- Demo dataset end-to-end (mock): 20 documents → 20 records → 20 calculations → ten-chapter report, citation coverage 100%, 0 invalid anchors, consistent with the baseline.
- Verification scripts that need no keys or public network were actually run this round: `verify_factor_store.js` PASS, `verify_consistency.js` (local) PASS, four dataset validation scripts PASS, `verify_upload` suite (within test.sh) PASS. The five real-adapter scripts were only guard-checked (including the exit 2 precheck) and were not run in the keyless environment.

## 7.4 Secondary Review

- Reverse review of each of this round's four code fixes: D-101 (the snapshot timing is after the first upload, the ancestor directories are already in the baseline set, and the criterion remains "escapes are detectable"); D-104 (the cache-invalidation chain is complete: saveFactors → delete → write fingerprint → invalidate again; metadata documents do not enter the factor list; verify_factor_store compatibility); D-103 (recompute with a pre-cleared empty error state, converging on both success and failure); D-106 (no script parses that line, the decision logic and caliber are unchanged).
- Horizontal scan for similar issues: `tmpdir()` traversal across the repo appears in only one place, the D-07 case (already isolated); frontend silent catch review (auth degradation falls under the established caliber, and library deep-link failure has a graceful fallback that does not block the main flow); the static-file loading set covers only the factor store. Zero new findings.
- Conclusion: **zero dangling entries**.

## Red-Line Self-Check

No deployment commands; no keys printed or committed; no test or decision logic weakened (D-106 only corrects output text); no statistical caliber changed; the model allowlist not expanded; no new runtime dependencies introduced; acceptance results recorded faithfully (the A-5 overage truthfully marks the exemption chain).

---

## Final Wrap-Up Re-verification (pre-merge third-round review wrap-up HEAD `a56d9bc`, 2026-10-16)

> The tables in 7.1/7.2 were produced at the second-round wrap-up (the 49-case era); the subsequent
> pre-merge review (D-107~D-111, see the defect register appendix and section 9 of the fix report)
> was merged into the final commit `a56d9bc`. This section re-runs the entire automated acceptance
> battery on the **final HEAD** and checks the audit brief's chapter-9 checklist item by item. Mock
> mode throughout (no `GEMINI_API_KEY` injected, the five real-adapter verification scripts not
> run), **zero Gemini / Google Cloud API calls, incremental cost $0**.

### A-1 ~ A-7 Re-run Results on HEAD `a56d9bc`

| Item | Result | Key Notes |
|---|---|---|
| A-1 `npm run build` | ✅ | Frontend 37 modules + backend syntax check OK |
| A-2 `npm test` | ✅ | **51/51** (backend 50 + upload 1; includes the new D-107/D-108 cases and the D-104/D-111 assertions) |
| A-3 `npm run smoke` | ✅ | SMOKE OK (health 200, port released with no residual listeners after SIGTERM shutdown) |
| A-4 `npm run scan-secrets` | ✅ | 0 hits, exit code 0 |
| A-5 `bash scripts/count_lines.sh` | ✅ (exemption on file) | A=5,870 / **B=9,149** / **C=10,951** (+42 lines versus the second round, from the D-107~D-111 fixes and their regression tests, already folded into the D-102 ledger); the T-052 exemption chain unchanged; README synced to the same values (verbatim check) |
| A-6 `node eval/run.js` | ✅ | 11/11 PASS, summarizing existing evidence only (this run changed only the run_at timestamp, already restored) |
| A-7 `git status` | ✅ | Clean; `git ls-files` shows zero hits for .env / frontend/.env / dist / local storage |

B-7 recheck: local start → `/healthz` returns `{"status":"ok"}` → after SIGTERM shutdown port 8080 is
released with no residual processes (manual `kill -INT` not being delivered to native processes
under Git Bash/win32 is an environment semantic; the smoke script's SIGTERM shutdown verification
is authoritative).

### Review of Third-Round Changes (a56d9bc)

A file-by-file reverse review of all D-107~D-111 code changes: `last_run_error` is an appended
response field and `GET /report` remains inside the `requireTaskOwner` guard (authorization-matrix
semantics unchanged); the factor-cache generation counter (record g before reading, compare
before writing) is logically correct and its `_` prefix guard reuses an existing error code;
`lastErrors` has an upper bound of 1000 with messages truncated to 200 characters;
`verify_acceptance.js` C4 tolerates only the exit code and still throws when there is no output.
No new issues found; the code paths that produced the HTTP-level evidence for
V-02/V-03/V-08/V-09/V-11 had their semantics unchanged by this commit.

### Item-by-Item Confirmation of the Audit Brief's Chapter-9 Checklist (HEAD `a56d9bc`)

- [x] Phase-one baseline snapshots archived (`BASELINE_SNAPSHOT_2026-10-14.md`, `BASELINE_SNAPSHOT_2026-10-15.md`, with B-1~B-8 fully recorded)
- [x] R-01~R-33 verified one by one with disposition conclusions recorded (all 33 rows of the 2026-10-15 defect register appendix closed, no dangling)
- [x] All eight-domain checkpoints completed (two rounds of REVIEW_PHASE2/FIX_REPORT; this round's third-round change review as a supplement)
- [x] All P0s fixed, each with passing regression verification (four first-round P0s, D-04~D-07, with regressions passing in the 51/51 suite)
- [x] All P1s fixed, each with passing regression verification (including second-round D-101)
- [x] P2s fixed or with disposition decisions recorded (second-round D-104 and third-round D-107/D-108 fixed; the rest carry rationale in the first/second-round defect registers)
- [x] Every P3 has an explicit decision (D-102/D-103/D-105/D-106/D-109/D-110/D-111, etc., either fixed or retained with rationale)
- [x] A-1~A-7 automated acceptance all green (the table above in this section, re-run on the final HEAD)
- [x] V-01~V-14 all passing with evidence retained (the 7.2 table + `progress/evidence/audit2-2026-10-15/`; the automated parts V-01~V-07/V-09/V-11/V-12 re-run and pass in the 51/51 suite on the final HEAD; the V-10 twelve-screenshot evidence was produced at the second-round wrap-up, after which only the P6 error path changed and it was re-verified separately per D-103/D-107)
- [x] Secondary review complete with zero dangling (section 7.4 + the third-round code-reviewer review of D-107~D-111 fully closed + this section's third-round change review)
- [x] All five deliverables in place (the 2026-10-15 defect register including the third-round additions, the fix report including section 9, README reconciled to 51/5,870/9,149/10,951, this acceptance record including this section, and the commit sequence per git log)
- [x] No red lines crossed throughout (two rounds of records + this section's re-verification: no deployment, zero key output, zero test weakening, zero caliber changes, zero new dependencies; mock mode throughout at zero cost)

**Conclusion**: All five phases of the audit brief complete; on the final HEAD `a56d9bc` A-1~A-7
are all green, all 12 checklist items are ticked, and the defect register (D-01~D-68 +
D-101~D-111) has zero dangling entries. Task complete.

---

## Fourth-Round Re-verification (post-wrap-up, HEAD `6809059`, 2026-10-16)

> Per the audit brief's execution instructions, an overall re-verification of the final wrap-up
> HEAD: re-run all baseline/acceptance batteries, check the defect register and R-01~R-33
> disposition closure, and spot-check that key fixes are in place. Mock mode throughout (no
> `GEMINI_API_KEY` injected, the five real-adapter verification scripts not run, no deployment of
> any kind), **zero Gemini / Google Cloud API calls, incremental cost $0**. Environment Node
> v24.12.0 / Git Bash (win32).

### Baseline and Automated Acceptance Battery Re-run Results

| Item | Result | Key Notes |
|---|---|---|
| B-1 `npm install` | ✅ | 0 vulnerabilities |
| B-2/A-1 `npm run build` | ✅ | Frontend 37 modules + backend syntax check OK |
| B-3/A-2 `npm test` | ✅ | **51/51** (backend 50 + upload 1), consistent with the third-round wrap-up |
| B-4/A-3 `npm run smoke` | ✅ | health `{"status":"ok"}`, SMOKE OK |
| B-5/A-4 `npm run scan-secrets` | ✅ | 0 hits, exit code 0 |
| B-6/A-5 `bash scripts/count_lines.sh` | ✅ (exemption on file) | A=5,870 / B=9,149 / C=10,951, verbatim-consistent with the third round; the T-052 exemption chain unchanged |
| B-7 health check | ✅ | `/healthz` 200 → clean SIGTERM exit, no residual listeners |
| B-8/A-6 `node eval/run.js` | ✅ | 11/11 PASS (existing evidence summarized only; the run_at timestamp drift already restored) |
| A-7 `git status` | ✅ | Clean; `git ls-files` shows zero hits for .env / frontend/.env / dist / local storage / __pycache__ |

### Closure and In-Place Spot Checks

- **Defect register**: all 33 entries in the R-01~R-33 disposition table in appendix A of
  `DEFECT_REGISTER_2026-10-15.md` are closed (32 with fixes intact / the "not applicable"
  conclusions maintained; the R-25 residual and R-30/R-33 retained under the established caliber
  with rationale), with no "to be fixed" items and no decision-less entries.
- **Regression cases in place**: V-01~V-07, V-09, V-12 (corresponding to D-04~D-08/D-10/D-11/D-13~D-16/D-18/
  D-19/D-21/D-24/D-34/D-37) are all in the suite and pass with the 51/51; V-08/V-10/V-11/V-13/V-14 reuse
  the second/third-round HTTP-level and browser-level evidence (their code paths have not changed
  since a56d9bc).
- **Key fix spot checks**: the `requireTaskOwner` route guard in 18 places (server.js); CSV formula-injection
  neutralization (3 places in exportService); `safeFilename` + storage key sanitization (fileService.js:26,83);
  scenario `persist:false` isolation (scenarios.js:16-17). All in place.

### Conclusion

The fourth-round re-verification shows **A-1~A-7 all green, zero dangling, zero new defects**.
The third-round wrap-up conclusion holds: all 12 items of the audit brief's chapter-9 checklist
are ticked, all five deliverables are in place, and the task-complete status is confirmed.

---

## Fifth-Round Independent Review (post-wrap-up, HEAD `1253890`, 2026-10-16)

> An independent review that cites no prior records and relies solely on source code and HTTP
> measurements: (1) re-locating the fix evidence for R-01~R-33 one by one at the source level;
> (2) re-running the full matrix for the four security-critical scenarios V-02/V-03/V-09/V-11
> on a local HTTP service using an injectable token verifier (`buildApp({verifyToken})`).
> Mock mode throughout, zero external API calls, zero deployment, **incremental cost $0**.
> The verification scripts ran in a system temporary sandbox (`%TEMP%/r5-audit-*`), do not
> enter the repository, and are not counted against the line budget.

### Item-by-Item Source-Level Verification of R-01 ~ R-33 (all consistent with the defect register dispositions)

| Concern | Code evidence independently verified this round |
|---|---|
| R-01 | `fileService.js:128-129` conversion table contains self-loops/retry edges; the `pipeline.js:89-92` extracting status is set outside the unit loop, once per document |
| R-02 | `scenarios.js:16-17` `persist:false`, scenarios compute only and do not persist |
| R-03 | All 16 task-level routes in `server.js` (detail/documents×4/units/duplicate/status/run/dashboard/report×2/review×2/candidates/audit/traces) carry `requireTaskOwner`; the `/api/tasks` list filters tasks owned by others (194-204) |
| R-04 | `server.js` token verifier is injectable (58); `storage/index.js:16-18` key containment check (after resolve, must be inside the root) |
| R-05 | `ai/client.js:72` two redactParts calls; upstream error bodies do not enter exceptions (188-190 comment + implementation) |
| R-06 | `pages/core.jsx:317-321` P3 takes `api.dashboard().records`; `pages/analysis.jsx:14-18` P4 takes `api.candidates()` (the fix still holds under the new structure after the T-052 split) |
| R-07 | `reportService.js:90-97` anchor() performs a single kg→t conversion, with range breakdown / per-record / total / scenario anchors sharing one path |
| R-08 | `exportService.js` csvEscape prefix neutralization (3 references) |
| R-09 | `server.js:27` multer `fileSize:10MB, files:50` streamed rejection; 442-443 LIMIT_* → structured error codes |
| R-10/R-32 | `server.js:77-91` CORS exact-string comparison whitelist (malformed Origin does not crash); 102-105 rate-limit socket key + explicit TRUST_PROXY + bucket cap of 10000 + illegal threshold fallback of 60 |
| R-11 | `reviewQueue.js:13` getTaskRecord double-checks all actions (edit/assign/exclude/close); 127 `_` prefix guard (D-111) |
| R-12 | `reviewQueue.js:81-82` patch numeric finiteness + positivity checks; `pipelineModelCalls.js:52-58` extraction validates finite; `calculation.js` accounting guard (test-covered) |
| R-13 | `config.js:85-122` coerce + RANGES out-of-range fallback; `pipeline.js:259` concurrency NaN/0 guard; `ai/client.js` retry classification (fatal is not retried) |
| R-14 | `reportService.js:258-269` scenario anchors validated against the existence of the task's scenario set |
| R-15 | `store/index.js:41` corrupted-file warning; 52-57 write-then-rename atomic write |
| R-16 | `recall.js:34-47` real keyword scores flow through (priority bonus 0.02), no hardcoded confidence |
| R-17 | `backend/src/queue` directory does not exist, no references across the repo |
| R-18 | `ai/client.js:224-252` timeout + vector count validation + element shape validation + explicit failure after a single retry |
| R-19 | `normalization.js:109-114` word-boundary code table recognition, honest null for unsupported currencies |
| R-20 | Disposition "not applicable" recheck: the server does not decompress XLSX (substring check only + 10MB cap), the original conclusion maintained |
| R-21 | `fileService.js:61` pdf-lib parse count, rejected if corrupted |
| R-22 | `exportService.js:39-44` error→reject with no hanging; 122-123 60-line truncation disclosure |
| R-23 | All five `*_real.js` scripts include the GEMINI_API_KEY precheck + exit 2 guard |
| R-24 | `Dockerfile:20` HEALTHCHECK; `firebase.json:12-16` nosniff/DENY/HSTS/CSP all present |
| R-25 | `server.js:286-287` ratio 0..1 validation into /run |
| R-26 | `vite.config.js:9-10` proxy includes /factors; api.js encodeURIComponent in 2 places |
| R-27 | `pipelineModelCalls.js:198`, `documentUnits.js:30` record/unit identifiers via randomUUID |
| R-28 | `server.js:372-375` review actions synchronously recalculate + generateReportForTask rebuild |
| R-29 | `taskService.js:12-16` type/length/ISO date/order/enum validation |
| R-30/R-33(4)(5) | Intentionally retained caliber unchanged (recorded in the diff table and README) |
| R-31 | Empty loops/dead branches removed, no dead exports found in this round's repo-wide scan |

### Independent Re-run of HTTP-Level Security Scenarios (local service, mock mode)

| Item | Result | Measured Record |
|---|---|---|
| V-02 authorization matrix | ✅ | 16 routes × 3 identities × {owned, unowned}: owned tasks return 403 ERR_FORBIDDEN for anonymous/wrong token, the owner is allowed (business 4xx counts as pass); unowned tasks allow all three identities |
| V-03 path traversal | ✅ | 5 malicious names (`../` chains, `..\..\`, `C:\abs\`, `/abs/`, `sub/../../`, each with a legal .pdf suffix + real PDF bytes) all sanitized to basename on disk (escape1..5.pdf), all 5 files inside the storage root, zero escape artifacts in the sandbox and %TEMP% |
| V-09 rate limiting/CORS | ✅ | RATE_LIMIT=3 instance: the 4th request returns 429 ERR_RATE_LIMITED; forged X-Forwarded-For=9.9.9.9 is not bucketed separately and still 429; evil Origin has no ACAO header; localhost:5173 echoed exactly; malformed Origin `http://[::invalid` returns 200 with no 5xx |
| V-11 upload defenses | ✅ | Empty file / disguised extension (.txt carrying PDF bytes) / corrupted PDF → 200 + per-file ok:false; 11MB → 413 ERR_FILE_TOO_LARGE (streamed rejection); 51 files → 422 ERR_ENUM_INVALID |

### Incidental Observations (no fix required)

- A malicious file name with an **illegal extension** (e.g., `../evil.txt`) is rejected at the
  extension validation layer (ok:false ERR_FILE_FORMAT_UNSUPPORTED, not written to disk) —
  equally satisfying the V-03 "reject or normalize" caliber; with a legal extension it goes
  down the storage path and is sanitized to basename. Both paths are covered.
- The libuv assertion (`UV_HANDLE_CLOSING`) at verification-script process exit is the Windows
  environment semantic already recorded in D-68 and unrelated to business behavior.

### Conclusion

Fifth-round independent review: **33/33 of the R-01~R-33 source-code evidence consistent,
4/4 HTTP-level security scenarios passing, zero new defects, zero dangling**. The
third/fourth-round conclusions hold, and the audit brief's completed status is finally confirmed.
