# Baseline Snapshot (Second Round of Comprehensive Review) — 2026-10-15

> The audit brief: `AUDIT_FIX_PROMPT.md` (same source as the first round on 2026-10-14). This round targets HEAD `7635e44`
> (three more commits after the first round was closed out: T-052 frontend enrichment + backend incremental APIs, production environment migration
> to us-central1, and site-wide de-Sinicization + P1 form UI fixes).
> Environment: Node v24.12.0 / npm 11.6.2 / Git Bash (win32). Mock mode throughout, zero external API calls.

## Baseline Command Results (B-1 ~ B-8)

| No. | Command | Result | Key Notes |
|---|---|---|---|
| B-1 | `npm install` | Passed | 0 vulnerabilities, no high-severity warnings |
| B-2 | `npm run build` | Passed | 37 frontend modules, 3 dist output files; backend syntax check OK |
| B-3 | `npm test` | **Failed** | 48 items in total (backend: 46 passed, 1 failed + upload: 1 passed). Failed item: `D-07/V-03 traversal filenames…` (regression.test.js:154), see D-101 |
| B-4 | `npm run smoke` | Passed | health 200, structured logs contain server_started, port unresponsive after shutdown |
| B-5 | `npm run scan-secrets` | Passed | 0 hits, exit code 0 |
| B-6 | `bash scripts/count_lines.sh` | Script verdict: FAIL | A=5,791 / B=8,978 / C=10,780 (Python 1,802). B exceeds the 7,000 target and C exceeds the 10,000 cap; caused by the T-052 maintainer exemption (recorded in the README and the first-round register D-02), see D-102 |
| B-7 | Start server + health check + shutdown | Passed | `/healthz` and `/config` both return 200; port released cleanly. Note: Git Bash cannot deliver SIGINT to Windows native processes (platform characteristic); SIGTERM shutdown has already been verified by the B-4 smoke |
| B-8 | `node eval/run.js` | Passed | All 11 metric groups PASS; result files generated in `eval/results/run/` (summary of existing files only, no overwrite) |

## Differences from the Audit Brief's Expectations

1. **Test count basis**: the brief expected "README claims 34 / measured 33". The current README claims 48 and the measured value is 48,
   consistent, so this does not constitute a documentation defect (the brief's information is based on the older state before the first round).
2. **Line count budget**: the brief states "B=6,976, cap 7,000, margin of 24 lines". The actual B=8,978: when the T-052 commit was made the
   maintainer granted a written exemption for NFR-504 (README lines 217-222 + first-round register D-02). This round treats it as an "exemption
   already on record" rather than a new defect; however, the final net change of newly added code must still be registered (see D-102).
3. **B-3 baseline failure**: the D-07/V-03 regression test failed; the root cause is a test isolation defect (not a real path traversal),
   registered as D-101; it will be fixed with priority in Phase 3 to restore a green baseline.

## Baseline Reference Values (anchors for subsequent non-regression checks)

- Automated tests: 48 items (47 passed / 1 failed); after fixing D-101 all 48 should pass; after this round's new regression tests the total will only increase.
- Line counts: A=5,791 / B=8,978 / C=10,780.
- Evaluation: 11 metric groups PASS; the `evaluation.json` details are a summary of mock/existing evidence files.
- Demo dataset (mock end-to-end) record count and section count: subject to the Phase 2 re-test values (see acceptance record V-10).
