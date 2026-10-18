# Baseline Snapshot (Stage 1, B-1 to B-8)

- **Execution date**: 2026-10-14
- **Environment**: Windows 10 x64 (Git Bash), Node v24.12.0, npm 11.6.2, Python 3.12.13 (argus-venv)
- **Mode**: mock mode (no real keys used; .env contents not viewed)

| No. | Command | Result | Key notes |
|---|---|---|---|
| B-1 | `npm install` | ✅ Success | 0 vulnerabilities; only 59 package funding notices |
| B-2 | `npm run build` | ✅ Success | Frontend: 32 modules, dist JS 168.46 kB (gzip 53.88 kB); backend syntax check passed, output BUILD OK |
| B-3 | `npm test` | ✅ 34 passed / 0 failed | Backend suite: 33 node:test cases + upload script suite counted as 1 aggregated case, totaling 34. README claims 34, consistent with the runtime; the task spec's "source count 33" is a count of `test(` in backend/test; both counts coexist → registered as documentation defect (D-03) |
| B-4 | `npm run smoke` | ❌ Failed | SMOKE FAIL: first-line log assertion branch triggered; root cause: mktemp returns an MSYS path, and native Windows Python cannot open it → registered D-01 |
| B-5 | `npm run scan-secrets` | ✅ Passed | 0 hits, exit code 0 |
| B-6 | `bash scripts/count_lines.sh` | ❌ NFR-504 FAIL | Basis A=4335, **Basis B=7110 (>7000 limit, over by 110 lines)**, Basis C=8905 (<10000 hard cap). The baseline 6,976 stated in the task spec does not match the measured value → registered D-02 |
| B-7 | `node backend/src/server.js` + health check | ✅ (with notes) | Port 8080 `/healthz` returns `{"status":"ok"}`; under Git Bash, `kill $PID` cannot terminate node (Windows signal semantics); `taskkill //F` is required, and the clean-exit item will be re-verified via smoke after D-01 is fixed |
| B-8 | `node eval/run.js` | ✅ Success | In mock mode, all 11 metric groups collected, overall PASS; artifacts `eval/results/run/evaluation.{json,md}` |

## Baseline Failure Handling

- B-4 → defect D-01 (smoke script Windows portability).
- B-6 → defect D-02 (line-count budget Basis B over by 110 lines; status: FAIL at baseline).

## Subsequent "No Regression" Reference

- Test cases: 34 (33 + 1), all passed.
- Line counts: A=4335, B=7110, C=8905.
- Evaluation: all 11 metric groups PASS, overall PASS.
- Build: BUILD OK; secret scan: 0 hits.
