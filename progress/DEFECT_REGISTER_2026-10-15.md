# Defect Register (Second-Round Comprehensive Review) — 2026-10-15

> Numbering decision (matters not covered by the audit brief, handled in the most conservative way): the first-round register `DEFECT_REGISTER_2026-10-14.md` already occupied D-01…D-68. To avoid cross-round numbering ambiguity, this round numbers from **D-101** onward; when citing a first-round defect, write "first-round D-xx". This decision is recorded here in the header.

---

## D-101

- **Source**: Stage 1 baseline (B-3 failure)
- **Severity**: P1 (blocks the mandatory acceptance gate `npm test`)
- **Location**: `backend/test/regression.test.js:154-171` (D-07/V-03 case)
- **Description**: To prove that "traversal filenames do not escape the storage root", this case traverses the **entire OS temp directory** twice before and after (2,100+ entries on this machine currently), asserting that in the symmetric difference of the two traversals there are no new files other than those inside the storage root. This machine has resident processes unrelated to this repository (Vite SSR cache writer; artifacts contain `__vite_ssr_import__`, `requestSocialBalanceProgram`, none of which are symbols of this repository, and it is still writing after the test run ends) that write new files into the temp directory between the two traversals, triggering the `file escaped storage root` false positive. The defense logic itself (`safeFilename`, `LocalFileStorage#path` containment check) passed all assertions beforehand; it is not a real escape.
- **Verification evidence**: `npm test` reproduces stably (backend suite 46 pass, 1 fail); the birthtime of the escape path `Temp\rx-vNgq-y-GZJg-GdcO_k\ssr\<sha1>` falls within the test run window, and the file content is a Vite SSR transform cache; `grep -rn 'requestSocialBalanceProgram|__vite_ssr' backend frontend scripts eval data` returns zero hits.
- **Fix plan**: Change the test to create the storage root inside a dedicated sandbox directory, traversing only the sandbox directory — preserving the "escape is detectable" semantics (a traversal would still land outside the sandbox and be assertable), but isolating it from other processes on the machine.
- **Verification method**: `npm test` fully green (48 items); 3 repeated runs without flakiness.
- **Status**: Fixed (2026-10-15, test changed to a dedicated sandbox `reg-tvs-`, storage root placed three levels below the sandbox, escapes still detectable; measured 48/48 × 3 rounds)

## D-102

- **Source**: Stage 1 baseline (B-6)
- **Severity**: P3 (documentation reconciliation)
- **Location**: `README.md:217-222` (Code size section)
- **Description**: README records B=8,944 / C=10,739; the current measured values are B=8,978 / C=10,780 — after the last commit (7635e44) added about 34/41 lines, the figures were not synced. The NFR-504 overrun itself has a written waiver from the maintainer (T-052) and is not a new defect; the line-count changes fixed this round must also be synced in this section at wrap-up.
- **Verification evidence**: `bash scripts/count_lines.sh` measured values vs README text comparison.
- **Fix plan**: Update to the final measured values during V-13 documentation reconciliation, and note the increment from the second-round review.
- **Verification method**: V-13 (README reconciliation).
- **Status**: Fixed (2026-10-15, README test count 48→49, the three figures 5,828/9,049/10,851 match the closing measured values verbatim, the NFR-504 section adds a citation to the second-round register; V-13 passed)

## D-103

- **Source**: Stage 2 new finding (domain C, residual from the R-25 fix)
- **Severity**: P3 (errors invisible, violating PRD 9.2 "every error has a recovery path")
- **Location**: `frontend/src/pages/analysis.jsx:187` (P6 ratio slider onBlur)
- **Description**: When the P6 slider loses focus it triggers a recalculation at the new ratio (`api.runPipeline(taskId, ratio)` + re-fetch report), but `catch { /* report stays */ }` silently swallows all failures: when the recalculation fails the page shows no indication, the numbers remain the old-ratio result, and the user has no way to know. The previous independent review fixed the **initial load** path (`load`'s setErr/Err rendering); the silent swallowing on the onBlur recalculation path was not covered.
- **Verification evidence**: Code check (analysis.jsx:185-190); comparison with the "P6 swallows report errors" item in the execution_log T-052-S2 review sheet, which only covered the load path.
- **Fix plan**: Change the onBlur catch to write the error message into a visible note/error line (consistent with the page's existing `note` pattern), keeping the old report data.
- **Verification method**: V-10 manual walkthrough (P6 step: stop the backend to trigger a recalculation failure, confirm the page shows an error).
- **Status**: Fixed (2026-10-15, the onBlur catch changed to `setRunErr` and displays a "recalculation failed + the numbers below come from the previous run" error line below the slider with `role=alert`; build passed; V-10 re-verified)

## D-104

- **Source**: Stage 2 new finding (domain D/B, data freshness)
- **Severity**: P2 (production stored-data correctness: ghost rows left after factor library content update)
- **Location**: `backend/src/services/factorLibrary.js:69-76` (`loadFactorLibrary`)
- **Description**: The idempotence condition of `loadFactorLibrary` is only count equality (`existing.length === raw.factors.length` means skip), and on refresh it only upserts, never deleting rows already removed from the file. Two consequences: (1) after a **factor deletion** (which actually happened in the de-Sinicization commit: 743→741, removing the china/hong kong/Macau/Taiwan rows), an existing library (production Firestore or a long-lived local library) retains 2 ghost factors already deleted from the data file, and recall and selection can still hit them; (2) a **content change with unchanged count** (e.g., a rename) is misjudged by count equality as "no refresh needed".
- **Verification evidence**: Code check (saveFactors only puts, no delete; skip condition is count only); the actual change in `data/factors/emission_factors.json` from 743→741 factors in git log `0c86ed4..7635e44`; the 4 data validation scripts only verify "file self-consistency" and do not cover the "old library refresh" path.
- **Fix plan**: At load time, use a SHA-256 fingerprint of the data file content to decide whether a refresh is needed; on refresh, upsert the full set and **delete rows that no longer exist in the file**; store the fingerprint in a metadata document inside the collection prefixed with an underscore, and have `listFactors` filter out `_`-prefixed documents so they do not appear in the factor list.
- **Verification method**: New regression test (pre-seed a library containing a deleted factor / same-count old value → reload → ghost rows cleared, changed values refreshed, the metadata document does not enter the list).
- **Status**: Fixed (2026-10-15, `loadFactorLibrary` switched to content-fingerprint determination + deletes rows no longer in the file on refresh; `listFactors` filters `_`-prefixed metadata documents; regression test D-104 passed, suite 49/49, `verify_factor_store.js` PASS. Deployment note: an existing library will do a full refresh once and clean up ghost rows on first startup due to the missing fingerprint — this is exactly the intent of the fix)

## D-105

- **Source**: Stage 2 new finding (domain A/B boundary, observation item)
- **Severity**: P3
- **Location**: `backend/src/server.js:315-317` (GET dashboard → `recalculateTask` → persisted accounting)
- **Description**: Every call to `GET /api/tasks/:id/dashboard` rewrites the `calculations` accounting audit rows with deterministic ids via `computeEmission` (values unchanged, timestamp refreshed). A side-effecting GET is not HTTP-semantic; each access on Firestore produces 2N writes. The frontend useData only fetches once on mount, with no polling, so the amplification is bounded; this behavior also serves the function of "self-healing ledger after review changes" (intentionally designed).
- **Verification evidence**: Code path check (reviewQueue.recalculateTask calls computeEmission with default persist=true; no dashboard polling on the frontend).
- **Fix plan**: Do not modify the code. Disposition: **intentionally retained** — the recalculation is deterministic (same input, same output), the ids are stable (overwrite rather than grow), and the post-review ledger self-healing semantics are preserved; if polling is introduced in the future, change it to "persist only when the value changes".
- **Verification method**: This entry is itself the disposition (no code verification required); V-04/V-05 regression continues to cover accounting consistency.
- **Status**: Intentionally retained

---

## D-106

- **Source**: Stage 4 new finding (discovered during A-5 execution)
- **Severity**: P3 (script output misrepresents facts, not a judgment error)
- **Location**: `scripts/count_lines.sh:40`
- **Description**: The conclusion line unconditionally prints `hard cap met under every figure`, regardless of the actual values — C=10,851 has now exceeded the 10,000 hard cap, yet the output claims "the hard cap is met under every figure" while reporting FAIL, misleading audit readings. The judgment logic (STATUS computation) itself is correct.
- **Verification evidence**: A-5 measured output vs the values.
- **Fix plan**: Only correct the output text to state the actual figures (`figure C $EVERYTHING vs 10,000 hard cap: met/exceeded`); zero changes to the judgment logic and statistical basis (red line 3.4.4).
- **Verification method**: Re-run A-5, output consistent with the values.
- **Status**: Fixed (2026-10-15, the conclusion line states the actual values; review confirmed no other script parses this line, and the C4 parsing in verify_acceptance.js parses the B./C. data lines and is unaffected; A-5 re-run output consistent)

---

## Appendix A: Item-by-item verification conclusions for review findings R-01 ~ R-33 (second round, HEAD 7635e44)

> Verification method: read-through of all source code domain by domain (see the "review scope" of the fix report) + running the existing regression tests + the 4 data validation scripts. The first-round numbering column is for traceability in this round. Meaning of conclusions: **fix intact** = the first-round fix still holds at HEAD; **not substantiated** = the finding was disproven by verification; **intentionally retained** = documented and retained per the first-round established criteria.

| Finding | First-round number | This-round verification conclusion |
|---|---|---|
| R-01 Multi-page state machine self-loop crash | D-04 | Fix intact (extracting set only once per document; transition table includes a retry edge; regression tests D-04/V-01 pass) |
| R-02 Scenario pollutes the official ledger | D-05 | Fix intact (computeEmission persist:false; regression tests pass) |
| R-03 Task-level endpoint privilege escalation | D-06 | Fix intact (requireTaskOwner covers routes including T-052's new /units /candidates /audit /api/tasks; regression tests pass) |
| R-04 Path traversal | D-07 | Fix intact (safeFilename + storage containment check); the isolation defect in the regression test itself is filed separately as D-101 |
| R-05 Traces leak document bytes / upstream response body | D-08 | Fix intact (redactParts; upstream body not in errors; regression tests pass) |
| R-06 P3/P4 take numbers from the wrong field | D-09 | Fix intact (P3/P4 take numbers from the dashboard/candidates endpoints) |
| R-07 Range anchor unit conversion error | D-10 | Fix intact (anchor converted only once; regression asserts anchor = dashboard tonnage) |
| R-08 CSV formula injection | D-11 | Fix intact (csvEscape prefix neutralization; regression tests pass) |
| R-09 Unrestricted upload middleware | D-12 | Fix intact (multer fileSize/files limits + authentication before buffering) |
| R-10 Rate-limit keys forgeable / buckets unbounded / malformed Origin | D-13 | Fix intact (socket keys + explicit TRUST_PROXY; bucket cap 10000; exact string comparison whitelist; regression tests pass) |
| R-11 Review actions across tasks | D-14/D-62 | Fix intact (getTaskRecord + requireTaskOwner dual validation; regression tests pass) |
| R-12 Non-finite values across the full chain | D-14/D-15/D-65 | Fix intact (three layers: extraction validation, patch validation, accounting guard; regression tests pass) |
| R-13 Illegal configuration values | D-16/D-63 | Fix intact (strict coerce + range fallback; concurrency guard; regression tests pass) |
| R-14 Scenario anchor existence | D-19 | Fix intact (validated against the scenario set within the task; regression tests pass) |
| R-15 Local storage atomicity / silent reset | D-20 | Fix intact (write-then-rename + warning log on parse failure) |
| R-16 Candidate confidence hardcoded | D-21 | Fix intact (real scores from the recall channel flow into evaluation; distribution keys fixed to three tiers; regression tests pass) |
| R-17 Queue abstraction dead code | D-23 | Fix intact (removed entirely, no references repo-wide; this round's review confirmed the directory no longer exists) |
| R-18 Embedding batch short response | D-18/D-66 | Fix intact (count + element shape dual validation; explicit failure after one retry; regression tests pass) |
| R-19 Currency identification order | D-22 (identification table rewritten in the de-Sinicization commit) | Fix intact (word-boundary code table, honest null for unsupported currencies, bare ¥ lowest priority; regression tests pass) |
| R-20 XLSX decompression amplification | D-25 | Not substantiated (the server does not decompress XLSX, only substring validation + 10MB cap; first-round conclusion upheld) |
| R-21 Page count byte regex | D-26 | Fix intact (pdf-lib parse counting, reject on corruption; regression tests pass) |
| R-22 PDF generation hangs / division by zero / truncation | D-27 | Fix intact (error→reject, empty table header guard, 60-row truncation disclosure) |
| R-23 Validation scripts lack a key guard | D-24/D-28 | Fix intact (all five real scripts have exit 2 guards; collectors reject mock evidence; reviewed one by one this round) |
| R-24 Container health check / managed security headers | D-29/D-37 | Fix intact (HEALTHCHECK node fetch, CSP/HSTS/frame protection/sniffing protection all present; us-central1 migration consistent) |
| R-25 P6 slider dead functionality | D-30 | Fix intact (ratio passed to /run and validated 0..1); residual onBlur silent swallowing → this round's D-103 |
| R-26 Proxy does not cover factor endpoints / URL encoding | D-39/D-41 | Fix intact (vite proxy includes /factors; factorDetail/traces encodeURIComponent) |
| R-27 Deduplication timing / audit identifier collision | D-32 | Fix intact (audit id random suffix); the deduplication timing sub-point upholds the first-round "not substantiated / negligible impact" conclusion |
| R-28 Stale calculation residue | D-33 | Fix intact (review actions rebuild the report synchronously; completed documents reload records; reruns replace old ids) |
| R-29 Shallow task creation validation | D-34 | Fix intact (string/length/ISO date/order/enum; regression tests pass) |
| R-30 Adapter behavior differences | D-35 | Intentionally retained (difference table already listed in the first round; this round confirms firestore.js has not been modified again, and the differences have not widened) |
| R-31 Report empty loop / trace dead branches | D-23/D-31/D-64 | Fix intact (removed; this round's full reference scan confirmed no new dead exports) |
| R-32 CORS wildcard | D-37 | Fix intact (exact whitelist, default includes this project's actual domain myproject-dc19d.web.app, consistent with .firebaserc) |
| R-33 Frontend token storage / request layer | D-38 | Fix intact ((1)(2)(3) timeout / res.ok / header order); (4)(5) localStorage anonymous token and refresh degradation are intentionally retained per the first-round criteria (anonymous identity has no PII, a usability trade-off, documented in README) |

---

## Second Re-review Conclusion (Second-Round Wrap-up)

- This round registered D-101 ~ D-106, 6 items in total, closure status: **4 fixed** (D-101 test isolation, D-103 P6 error swallowing, D-104 factor library ghost rows, D-106 statistics output misrepresentation, all with regression tests or acceptance scenarios), **1 intentionally retained** (D-105 side-effecting GET, with reasons), **1 documentation fix** (D-102 README reconciliation). No "to be fixed" items.
- The reverse review of the four code fixes and the horizontal scan of similar issues (detailed in acceptance record 7.4): zero new, zero dangling.
- All findings R-01 ~ R-33 were verified item by item with final dispositions (see the table above): 32 fix-intact/not-substantiated conclusions upheld, the R-25 residual and the R-30/R-33 established retention criteria unchanged, where the new D-103 this round is the R-25 residual fix.

---

## Independent Re-review Before Merge (code-reviewer, 2026-10-15 third round)

> An independent review after delivery wrap-up and before merging into the main branch, re-examining all code changes this round (including uncommitted guards); the following issues were found and all handled to closure (numbered continuing from D-107).

## D-107

- **Source**: Pre-merge re-review (code-reviewer findings #1/#3)
- **Severity**: P2 (the D-103 fix is ineffective against its main failure mode)
- **Location**: `backend/src/server.js` (GET /report swallows run errors), `frontend/src/pages/analysis.jsx` (P6)
- **Description**: `POST /run` returns 202 immediately; background pipeline failures are swallowed and logged by `launchRun`; `GET /report` executes `running.catch(() => {})` for in-flight run rejections and then returns the **old report** with HTTP 200. In real AI mode, both awaits for the P6 slider recalculation background failure succeed → the catch is not entered → it is still a silent old value (D-103 only fixed the one mode of "network-layer failure"). Additionally: a report request's 60s timeout misreports "still recalculating" as "recalculation failed".
- **Fix plan**: GET /report captures in-flight run errors and returns `last_run_error` with the response; P6 reads this field after recalculation and displays it; the catch distinguishes timeout (prompts "still recalculating") from genuine failure.
- **Verification method**: Local mock service live test (deliberately causing a background failure: upload a corrupted storage state to trigger a run failure) + `npm test` no regression + V-08/V-10 evidence chain re-check.
- **Status**: Fixed (2026-10-15, taskRuns adds lastErrors (cleared on success, capped at 1000); GET /report response carries last_run_error; P6 displays this error and distinguishes "still recalculating" from genuine failure. Regression case D-107 (successful run null → failed run error returned with report) passed; suite 51/51)

## D-108

- **Source**: Pre-merge re-review (code-reviewer finding #2)
- **Severity**: P2 (only triggerable in the production Firestore form)
- **Location**: `backend/src/services/factorLibrary.js` (listFactors post-check caching)
- **Description**: `listFactors` is a check-then-set cache: a concurrent read that resolves after the last invalidation of the refresh flow writes the **mid-refresh snapshot** back to the cache and nothing invalidates it again — the instance-level factor list retains ghost rows / old values / `embedding:null` (the semantic channel degrades to sim=-1). The local LocalFileStore completes within a microtask, so only Firestore network latency can trigger this in practice; but the fix semantics of D-104 would be bypassed by this race in production.
- **Fix plan**: Generation counting (generation): +1 on each invalidation; `listFactors` writes to the cache only when the generation has not crossed an invalidation.
- **Verification method**: New/extended regression assertions (concurrent reads after invalidation do not cache the old snapshot); `npm test` no regression.
- **Status**: Fixed (2026-10-15, generation counting: +1 on invalidation, listFactors reads across an invalidation do not write to the cache. Regression case D-108 passed; suite 51/51)

## D-109

- **Source**: Pre-merge re-review (code-reviewer finding #4)
- **Severity**: P3 (test detection window defect)
- **Location**: `backend/test/regression.test.js` (D-07/V-03 case)
- **Description**: The `before` snapshot is taken only **after** the first malicious upload (`../../escape plan.pdf`); that payload's escape (if safeFilename regressed) is already in the baseline set and the assertion lets it through — the first payload is not within the detection window.
- **Fix plan**: Take the before snapshot immediately after pre-creating the storage root directory, bringing all three malicious uploads into the differential window (the storage root is three levels below the sandbox, escapes still land inside the sandbox but outside the root, detectable).
- **Verification method**: `npm test` (case passes) + an optional temporary validation by manually removing safeFilename.
- **Status**: Fixed (2026-10-15, snapshot taken first after pre-creating the storage root, all three malicious payloads enter the detection window; case passed)

## D-110

- **Source**: Pre-merge re-review (code-reviewer finding #6, pre-existing defect, exposed this round)
- **Severity**: P3 (acceptance chain correctness)
- **Location**: `scripts/verify_acceptance.js:273` (C4 execFileSync without try/catch)
- **Description**: `count_lines.sh` ends with exit code 1 (budget FAIL), and `execFileSync` throws on a non-zero exit → the acceptance script crashes at C4, and its built-in waiver recognition logic cannot execute. After the T-052 budget waiver (B>7,000), this script necessarily crashes in this repository; the C4 waiver evidence cited in the first round was produced when the budget was not exceeded.
- **Fix plan**: C4 catches the non-zero exit and reads stdout for determination (determination condition unchanged: either meeting the target or the waiver mark).
- **Verification method**: `PUBLIC_BASE=<local service> node scripts/verify_acceptance.js` runs fully and C4 correctly gives the waiver conclusion.
- **Status**: Fixed (2026-10-15, C4 catches the non-zero exit and reads stdout, still throwing when there is no output. Local full re-run of verify_acceptance: C4 PASS with the waiver conclusion, the script runs through to OVERALL completely (only B1/B3, the two public deployment checks, FAIL due to the local BASE being unreachable, as expected; the rest: functional 8/8 + compliance 3/5 + engineering 5/5, B4/N1/N2 all pass). Output archived as verify_acceptance_local.txt)

## D-111

- **Source**: Pre-merge re-review (code-reviewer finding #5b, defense in depth)
- **Severity**: P3 (the current store has no contaminated rows; it is a potential path)
- **Location**: `backend/src/services/reviewQueue.js` (recalculateTask)
- **Description**: Match rows contaminated before the guard fix (`selected_factor_id` pointing to a non-factor document) make `recalculateTask` throw in `computeEmission` → dashboard/review endpoints return 500 and cannot self-heal. The current `data/.local-store/matches.json` has 60 rows checked with zero suspicious; it is a potential path.
- **Fix plan**: recalculateTask skips the record when the factor shape (numeric value + activity_unit) fails validation (it is not included in aggregation), and the endpoint no longer returns 500.
- **Verification method**: Regression assertion (pre-seed a contaminated match → dashboard 200, no accounting for that record).
- **Status**: Fixed (2026-10-15, recalculateTask skips non-factor rows (no numeric value or no activity_unit). Regression assertion (contaminated match → does not throw, calcs=0) passed; suite 51/51)
