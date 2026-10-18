# Acceptance Record (Phase Four, 2026-10-14)

> Based on Chapter 7 of `AUDIT_FIX_PROMPT.md`. Each entry gives its ID, execution date, result, evidence location, and failure back-link.
> All scenarios were executed against the **local service only** (mock mode); no injection/traversal/rate-limit/corrupted-file verification was performed against any public deployment.

## 7.1 Automated Acceptance Battery

| No. | Command/Action | Result | Key Output | Evidence |
|---|---|---|---|---|
| A-1 | `npm run build` | ✅ Pass | Frontend 32 modules, dist JS 169.14 kB (gzip 54.07 kB); `BUILD OK` | Terminal output |
| A-2 | `npm test` | ✅ Pass | `backend pass=47 fail=0` + `upload pass=1 fail=0` → **TOTAL passed=48 failed=0** (baseline 34, including the regression tests added this time) | Terminal output |
| A-3 | `npm run smoke` | ✅ Pass | `health response: {"status":"ok"}` → `SMOKE OK` | Terminal output |
| A-4 | `npm run scan-secrets` | ✅ Pass | `SECRET SCAN: PASSED (0 hits)`, exit code 0 | Terminal output |
| A-5 | `bash scripts/count_lines.sh` | ⚠️ Recorded and accepted under clause 2.6.2 | Metric A=4544, B=**7708** (>7000), C=**9503** (<10000 hard cap). The script itself still prints `NFR-504: FAIL`, recorded faithfully; the overage account and rationale are in defect register D-02 "final account" | Defect register D-02 |
| A-6 | `node eval/run.js` | ✅ Pass | `Summary rows=11 passed=11 failed=0` → `Overall verdict: PASS`; consistent with the baseline B-8 metric | `eval/results/run/evaluation.{json,md}` |
| A-7 | `git status` | ✅ Clean (after commit) | Only the expected source/evidence changes; `.env`, `frontend/.env`, `frontend/dist`, `data/.local-store`, `data/.uploads`, `frontend/.playwright-cli` are all ignored | See commit sequence |

**Note on A-5 (no whitewashing)**: Metric B overspends by 708 lines, of which about 393 lines are the acceptance scenarios that the audit brief's section 7.2 explicitly requires to be "consolidated into automated regression tests", and the remainder are the minimal implementations of the P0/P1 security and correctness fixes; 147 lines of dead code confirmed to have no references have all been reclaimed; `count_lines.sh` was not changed by a single character. The conclusion holds under the 2.6.2 escape clause.

## 7.2 Targeted Acceptance Scenarios

| No. | Scenario | Result | Execution Method and Evidence |
|---|---|---|---|
| V-01 | Multi-page document full flow | ✅ Pass | Constructed a two-page PDF and ran it through the full flow: the document's final state is completed/needs_review (not failed), both page records exist; rerunning preserves completeness. Consolidated as a regression test in `backend/test/regression.test.js` (D-04/V-01) |
| V-02 | Privilege escalation matrix | ✅ Pass | All task-level endpoints (detail/documents/download/report/export/dashboard/review/audit/trace/trigger run) × three identities (no token/wrong token/correct owner) were verified one by one against tasks **with an owner**: the first two get 403 ERR_FORBIDDEN, the owner passes; **unowned** tasks are accessible to all three identities (for script and demo compatibility). Consolidated as a regression test (D-06/V-02); the token validator supplies mock identities via injection |
| V-03 | Path traversal | ✅ Pass | Traversal segments, backslash variants, absolute-path filenames on upload: all normalized, no new files of any kind created outside the storage root (before/after directory tree comparison assertion); out-of-bounds key reads throw ERR_STORAGE_ACCESS. Consolidated as a regression test (D-07/V-03) |
| V-04 | Scenario isolation | ✅ Pass | Ran baseline → ran three scenarios → re-fetched report and export: the baseline totals are exactly identical to before the scenarios (463.047 t still identical after the double trigger), and the persisted accounting and audit records were not overwritten by the scenarios. Consolidated as a regression test (D-05/V-04) |
| V-05 | Report anchor values | ✅ Pass | Range breakdown anchor tonnage equals dashboard aggregate tonnage item by item (regression assertion compares item by item), and per-record anchors are also exact. Consolidated as a regression test (inside D-04/V-01) |
| V-06 | CSV formula injection | ✅ Pass | Via the review edit path, wrote product names such as `=SUM(A1:A9)*cmd` and `+1|@ping|-2`; on both CSV exports, dangerous prefixes are neutralized by a prepended single quote, numeric columns remain numeric, and the column structure is unchanged. Consolidated as a regression test (D-11/V-06) |
| V-07 | Numeric defenses | ✅ Pass | Via the review edit endpoint and the mock extraction path, injected non-numeric/infinite/zero/negative values respectively: all rejected (ERR_ENUM_INVALID) or safely degraded; the ledger, aggregates, and report contain no non-finite values (regression assertion). Consolidated as a regression test (D-14/D-15/V-07) |
| V-08 | Concurrent runs | ✅ Pass | Triggered a run twice in succession during report polling: only one consistent report is ultimately produced, and the report values agree with the ledger recomputation. Evidence: on the local service, `PUBLIC_BASE=http://127.0.0.1:8080 node scripts/verify_consistency.js` → `1/1 tasks consistent -> PASS` (20 rows, 0 mismatches); also consolidated as a regression test (D-33) |
| V-09 | Rate limiting and origin protection | ✅ Pass | Over-threshold requests get 429 ERR_RATE_LIMITED; forged forwarding headers can no longer reset the rate-limit buckets (keyed by socket address by default); non-whitelisted origins get no cross-origin headers; malformed Origin headers do not cause server errors (exact string comparison, no URL parsing). Consolidated as a regression test (D-13/D-37/V-09) |
| V-10 | UI full-flow walkthrough | ✅ Pass | Local backend 8080 + frontend 5173; the browser walked through P1→P9 in sequence: create task → one-click demo (20 documents, status completed/needs_review) → P3 record table non-empty, expandable detail and audit → P4 enter the matching viewer from a record and complete one manual factor assignment → P5 dashboard values → P6 three scenarios (after the slider is at 50%, the S-2 savings are exactly halved, proving the ratio really takes effect) → P7 ten chapters + PDF + two CSV downloads with correct content → P8 edit (quantity 21000 persisted, the report refreshes accordingly) → P9 172 traces. The 9 screenshots were independently visually verified by a vision sub-agent, and all finally PASS | `progress/evidence/audit-2026-10-14/v10-screenshots/*.png` (9 files), `.../carbonledger-report.pdf`, `.../activity-detail.csv`, `.../category-summary.csv` |
| V-11 | Upload defenses | ✅ Pass | Empty file → per-file ERR_FILE_CORRUPT; disguised extension (executable content named .pdf) → ERR_FILE_CORRUPT; corrupted file → ERR_FILE_CORRUPT; oversize (11MB) → middleware 413 ERR_FILE_TOO_LARGE (no longer fully loaded into memory); over single-request file count (51) → 422 ERR_ENUM_INVALID. The upload suite covers this in sync |
| V-12 | Embedded batch defenses | ✅ Pass | The mock embedding interface returned fewer vectors than inputs: the client retried once and then failed explicitly (ERR_MODEL_CALL_FAILED), and missing vectors were not written to the index. Consolidated as a regression test (D-18/V-12) |
| V-13 | Documentation reconciliation | ✅ Pass | README revisions: test count (44 and its composition), the three metrics' line counts and current NFR-504 status, error codes (added ERR_FORBIDDEN/ERR_RATE_LIMITED, 15 in total), identity/privacy and rate-limit metrics, the queue wording changed to inline execution, the runtime switches supplemented with TRUST_PROXY, and a new 2026-10 hardening subsection; the T-050 report adds an Addendum confirming its fix still holds after scenario isolation |
| V-14 | Defect register closure | ✅ Pass | All 67 defect register entries are closed: **58 fixed** (each citing a passing verification method), **1 handled per 2.6.2** (D-02, with the overage account and rationale), **6 intentionally retained** (D-25/D-35/D-44/D-49/D-50/D-56, each with rationale), **2 not substantiated** (D-55/D-57, with verification explanations); no entry is "to be fixed" without a decision note |

## 7.5 Second Review Round (independent reviewer, rerun after closure)

> The first round's conclusion of "zero dangling entries" was **falsified** by this round: 9 missed/unclosed issues (D-60 through D-68) were found, all registered, fixed, and accompanied by regression assertions. See the defect register's "secondary re-examination (second round)".
> Of these, D-67 and D-68 were found by **end-to-end/exit-code testing**, and both were confirmed by attribution against the old version code to be pre-existing defects.

| Item | Result | Notes |
|---|---|---|
| New defects | 9 (D-60…D-68) | D-60 is P1 (failed documents cannot be retried + rerun destroys existing records), D-67/D-68 are P2 (rerun silently clears the ledger; verification script exit-code contract), the rest P3 |
| All fixed | ✅ | Each is accompanied by a regression assertion; `npm test` 44 → **48** all green |
| Review battery rerun | ✅ | A-1/A-2/A-3/A-4/A-6/A-7 all green; A-5 recorded and accepted per 2.6.2 (B=7708, C=9503) |
| Repo-wide dead export scan | ✅ | Only 4 hits, all reclaimed (D-64, −8 lines) |
| **V-08 local re-verification** | ✅ | After two consecutive concurrent reruns of the one-click demo task, the records still number **20**; `PUBLIC_BASE=local node scripts/verify_consistency.js` → `PASS (20 rows, 0 mismatch(es))` |
| **V-08 evidence blind spot** | ⚠️ Recorded | `verify_consistency.js` only checks that "the report is self-consistent with the **surviving** ledger", and will still PASS after the ledger is cleared; D-67 has blocked this path, and the blind spot itself is on record |
| **D-68 exit-code testing** | ✅ | `verify_consistency.js` prints PASS and `exit=0` (three times); before the fix it was 127 |
| Defect register closure | ✅ | All 67 entries have explicit dispositions, zero "to be fixed" |

## 7.3 No-Regression Confirmation

- All 34 baseline cases still pass; **all 14 new regression cases pass** (48 in total).
- The demo dataset end-to-end (mock): 20 records, a ten-chapter report, 100% citation coverage, 0 invalidation, consistent with the baseline.
- All pre-existing verification scripts that do not depend on keys or the public network run and their conclusions do not degrade:
  - `verify_units.js` → RESULT: PASS (7 units, 5 samples traceable)
  - `verify_traceability.js` → RESULT: PASS (30/30 parsed, 0 invalidation, 3/3 negative controls detected)
  - `verify_factor_store.js` → RESULT: PASS (743 factors, year-distribution totals consistent)
  - `verify_upload.js` (via the `npm test` upload suite) → PASS
  - `verify_consistency.js` (pointed at local) → PASS (1/1, 20 rows, 0 mismatches)
- Five real adapter scripts: four scripts gained key guards; run without keys they exit 2 and write no result file.

## 7.4 Secondary Re-examination

Completed (see the defect register's "phase four secondary re-examination conclusion"): re-reviewed file by file from a fresh perspective, newly finding and closing D-51, D-52, D-53, D-54, D-58, D-59; checked interactions between fixes (owner + frontend auth header, serialization + scenario isolation + state machine, upload limits + existing assertions, real recall scores + numeric defenses, PDF dual parsing); cross-checked similar omissions outside the defect register item by item (the other verify scripts' write targets, leftover unauthenticated frontend API access, backend primary-key conflicts, repo-wide numeric entry points). **Zero dangling entries**.

## Appendix A Final Disposition of Doubts (R-01 through R-33)

| Doubt | Disposition |
|---|---|
| R-01 | Substantiated → fixed (D-04) |
| R-02 | Substantiated → fixed (D-05) |
| R-03 | Substantiated → fixed (D-06) |
| R-04 | Substantiated → fixed (D-07) |
| R-05 | Substantiated → fixed (D-08) |
| R-06 | Substantiated → fixed (D-09) |
| R-07 | Substantiated → fixed (D-10); a same-source Share column error (D-52) was also found and fixed |
| R-08 | Substantiated → fixed (D-11) |
| R-09 | Substantiated → fixed (D-12) |
| R-10 | Substantiated → fixed (D-13); a cross-cutting middleware that did not cover early routes was also found (folded into D-13) |
| R-11 | Substantiated → fixed (D-14) |
| R-12 | Substantiated → fixed (D-15) |
| R-13 | Substantiated → fixed (D-16/D-17) |
| R-14 | Substantiated → fixed (D-19) |
| R-15 | Substantiated → fixed (D-20) |
| R-16 | Substantiated → fixed (D-21) |
| R-17 | Substantiated → removed under 5.4.3 authorization (D-22) |
| R-18 | Substantiated → fixed (D-18) |
| R-19 | Substantiated → fixed (D-24) |
| R-20 | Partially not substantiated (no local decompression path) → intentionally retained and documented (D-25) |
| R-21 | Risk substantiated (0 deviation in current data) → switched to pdf-lib exact counting (D-26) |
| R-22 | Substantiated (the truncation disclosure sub-point is not substantiated) → fixed (D-27) |
| R-23 | Substantiated → fixed (D-28) |
| R-24 | Substantiated → fixed (D-29) |
| R-25 | Substantiated → fixed (D-30) |
| R-26 | Substantiated → fixed (D-31) |
| R-27 | Partially substantiated (audit ID collision) → fixed (D-32); the deduplication timing and linear-search sub-points are not substantiated / intentionally retained |
| R-28 | Substantiated → fixed (D-33) |
| R-29 | Substantiated → fixed (D-34) |
| R-30 | Difference confirmed → intentionally retained with a difference table (D-35) |
| R-31 | Substantiated → fixed (D-36) |
| R-32 | Substantiated → fixed (D-37) |
| R-33 | Substantiated → (1)(2)(3) fixed (D-38); (4)(5) intentionally retained and documented |

## Final Closure Re-verification (audit brief Chapter Nine checklist, 2026-10-14)

> After the second review round's closure commit (b587f07) and before final delivery, the entire automated acceptance battery was rerun once on the same HEAD, and the Chapter Nine checklist was confirmed item by item. Mock mode throughout (`GEMINI_API_KEY` was not injected into the process environment and `.env` was not loaded — the project has no dotenv dependency, and keys are read only from the process environment), **this re-verification initiated no real Gemini / Google Cloud API calls, and the incremental cost is 0**; the "$0.00058/document" in the evaluation table is an archived metric from a historical real-adapter round, not current spend.

**A-1 through A-7 actual measurements (rerun on the closure HEAD)**:

| Item | Result | Measured Output |
|---|---|---|
| A-1 `npm run build` | ✅ | 32 modules, dist JS 169.14 kB (gzip 54.07 kB), BUILD OK |
| A-2 `npm test` | ✅ | backend pass=47 fail=0 + upload pass=1 fail=0, TOTAL **48/48** |
| A-3 `npm run smoke` | ✅ | `{"status":"ok"}` → SMOKE OK |
| A-4 `npm run scan-secrets` | ✅ | PASSED (0 hits), exit code 0 |
| A-5 `bash scripts/count_lines.sh` | ✅ (per clause 2.6.2) | A=4544, B=7708, C=9503; the script faithfully prints FAIL; the overage account is in defect register D-02's final account (including the second round's additions) |
| A-6 `node eval/run.js` | ✅ | All 11 metric groups PASS, Overall verdict: PASS; compared with the previous run only the `run_at` timestamp differs, and the 11 values are word-for-word identical (verified with `git diff`, then the file was restored) |
| A-7 `git status` | ✅ | Clean (0 entries) |

**Chapter Nine checklist, confirmed item by item**:

- [x] Phase one baseline snapshot archived (`BASELINE_SNAPSHOT_2026-10-14.md`), with records for all of B-1 through B-8 (including the two baseline failure items B-4/B-6 and their defect back-links D-01/D-02)
- [x] Appendix A doubts R-01 through R-33 verified one by one and their dispositions registered (this file's appendix table has 33 rows, none dangling)
- [x] All eight domain checkpoints completed (`REVIEW_PHASE2_NOTES_2026-10-14.md` "each domain's checkpoint status", with new findings registered as D-39 through D-50)
- [x] All P0 defects fixed, each with passing regression verification (D-04/05/06/07; A-2 includes the corresponding cases)
- [x] All P1 defects fixed, each with passing regression verification (D-08…D-17, D-33, D-39, D-40, D-51, D-52, D-59, D-60)
- [x] P2 defects fixed or with recorded disposition decisions (D-02 recorded in writing per 2.6.2 and accepted; D-18…D-29, D-58, D-67, D-68 fixed)
- [x] Each P3 defect has an explicit decision (intentionally retained: D-25/D-35/D-44/D-49/D-50/D-56 and D-38(4)(5), each with rationale; the rest fixed)
- [x] A-1 through A-7 automated acceptance all green (see the table above; A-5 is judged under the audit brief 7.1's own clause of "overage recorded in writing and accepted")
- [x] V-01 through V-14 targeted acceptance all pass with evidence retained (7.2 table + `progress/evidence/audit-2026-10-14/`: nine V-10 screenshots, PDF/CSV exports, V-08 local consistency result; V-01/02/03/04/05/06/07/09/12 are all consolidated as `regression.test.js` cases, and a closure spot-check confirmed 17 cases correspond one-to-one to the numbers)
- [x] Secondary re-examination completed with zero dangling entries (two rounds: the first round D-51…D-59; the second round D-60…D-68 and correction of the first round's "zero new" statement; the defect register has no "to be fixed" status entries — the only occurrence of the phrase "to be fixed" belongs to the historical snapshot section of "phase two closure" and has since been superseded by a later summary)
- [x] All five deliverables in place: the defect register, the fix report (including the second round's additions), the updated README (reconciled against measurements: test count 48=47+1, and the three metrics 4544/7708/9503 word-for-word identical to `count_lines.sh` measurements), the acceptance record (this file), and the git commit sequence (one commit per defect/phase)
- [x] No Chapter Three red lines violated throughout: no deployment commands; `.env`/`frontend/.env` not committed and not output (zero `git ls-files` hits); both `.gitignore` changes were additive only (both diffs at 42c7849/70b6724 checked); `count_lines.sh` unchanged by a single character and overage printed faithfully; no test weakening (48/48 all pass); `AI_MODEL_ALLOWLIST` not expanded; no new runtime dependencies

**Conclusion**: All five phases of the audit brief are complete, all 12 items of the Chapter Nine checklist are checked, and the acceptance record is all green. The task is complete.
