# Fix Report (Second Full Review) — 2026-10-15

## 1. Review Scope and Method

- **Subject**: HEAD `7635e44` (after the first-round closure 70b6724, three more commits were merged: T-052 frontend enrichment + backend
  incremental APIs, production environment migration to us-central1, site-wide removal of China-specific content + P1 form UI fixes), plus this round's fix closure.
- **Method**: Proceeded through the audit brief's five stages. The stage-two eight-domain review used "first delineate all changes after the previous round's closure
  (`git diff 70b6724..HEAD`), then read all backend/frontend source code, scripts, evaluation tools, and
  deployment configuration file by file, domain by domain", and verified all 33 review findings in Appendix A one by one as to whether their fixes still hold at HEAD; key findings
  were backed by runtime verification (test suite, dataset validation script, scenario script). Mock mode throughout, zero external API
  calls, zero external cost.
- **Defect register**: `progress/DEFECT_REGISTER_2026-10-15.md` (numbering starts at D-101 to avoid conflict with the first round's
  D-01~D-68 — matters not covered by the audit brief were handled in the most conservative way, and this decision is recorded at the top of the register).

## 2. Defect Statistics

| Dimension | Count | Details |
|---|---|---|
| Registered this round | 6 | D-101(P1), D-104(P2), D-103(P3), D-102(P3), D-106(P3), D-105(P3) |
| Fixed | 5 | D-101, D-103, D-104, D-106, D-102 (documentation) |
| Intentionally kept | 1 | D-105 (GET dashboard recompute persistence: deterministic overwrite, stable ids, fulfills the post-review self-healing role; bounded front-end polling amplification) |
| Not substantiated | 0 | — |
| New P0/P1 security defects | 0 | The three new commits introduced no ownership/injection/traversal-class regressions (over-privilege matrix tested over HTTP + code verification) |

Distribution by domain: domain G (test system) 1 (D-101), domains D/B (data storage + factor library) 1 (D-104), domain C (frontend) 1
(D-103), domain F (configuration/scripts) 2 (D-106, D-102), domain A/B boundary 1 (D-105).

## 3. Item-by-Item Fix Summary

1. **D-101 (P1) test isolation defect**: the D-07/V-03 traversal regression case walked the entire OS temp directory and conflicted with concurrent writes from an unrelated local
   process (an external Vite SSR cache writer), producing a "file escaped storage root"
   false positive (the root cause of baseline B-3's failure). Fix: place the storage root three levels below a dedicated sandbox and walk only the sandbox — escapes
   remain detectable and the test is isolated from the machine. Verification: 48/48 × 3 rounds.
2. **D-104 (P2) factor library ghost rows**: `loadFactorLibrary` decided "no refresh needed" by equal counts and only ever added rows without deleting;
   after the data file went 743→741 (removal of China-specific content dropped the china/hong kong/Macau/Taiwan rows), an existing library would retain two
   deleted ghost factors, and same-count content changes were wrongly skipped. Fix: switch to a SHA-256 content fingerprint of the data file
   + delete rows that no longer exist in the file during refresh; the fingerprint is stored in the `_library_meta` document, and `listFactors` filters `_`-prefixed documents. Verification: new regression tests (ghost row cleanup, same-count value change refresh, metadata excluded from the list,
   unchanged skip), suite 49/49; `verify_factor_store.js` PASS.
   **Deployment note**: an existing library (production Firestore) will do one full refresh on first startup and clean up the ghost rows — this is exactly
   the intent of the fix and counts as an expected one-time write amplification.
3. **D-103 (P3) P6 slider recompute silently swallowed errors**: `catch { /* report stays */ }` was changed to a visible
   `role=alert` error prompt ("recompute failed + the numbers below come from the previous run"). Verification: in V-10 the backend was stopped and the prompt was confirmed visible in testing
   (screenshot 10).
4. **D-106 (P3) statistics output misstatement**: `count_lines.sh`'s conclusion line always printed "hard cap met under every
   figure", while C=10,851 already exceeds 10,000. Only the output text was corrected to state the actual figures; the decision logic and statistical basis saw
   zero changes (red line 3.4.4). Verification: A-5's rerun output matches the figures; confirmed no script parses this line.
5. **D-102 (P3) README reconciliation**: test count 48→49; the line counts for the three bases were updated to 5,828/9,049/10,851 and match the
   closure measurements word for word; the NFR-504 section now also cites the second-round defect register.
6. **D-105 intentionally kept**: see the defect register (reasons and impact surface already documented).

## 4. R-01 ~ R-33 Disposition Overview

All 33 review findings were verified (appendix table in the defect register): the first round's fixes **all still hold** at HEAD (including ownership checks and pagination
bounds for the new routes /api/tasks, /units, /candidates, /audit introduced by the three new commits); R-20 "decompression amplification"
retains its "not substantiated" conclusion; the remainder of R-25 (slider error swallowing) was fixed by this round's D-103; R-30/R-33's established retention basis is unchanged.
**No dangling items.**

## 5. Line Budget Notes

NFR-504 was exempted in writing by the maintainer at T-052 (README + first-round D-02 + execution_log marker +
verify_acceptance C4 exemption recognition). This round's baseline B=8,978 → closure B=9,049 (+71 lines: about +30 for D-104 code,
about +47 for D-101/D-104 regression tests, about +10 for D-103, D-106 output text neutral); C=10,780 →
10,851. All increments are counted in D-102's reconciliation and written into README. A-5 passed under the audit brief's basis of "overage documented in writing and accepted".

## 6. Items Not Implemented and Reasons

- R-33(4)(5) (localStorage anonymous token, switching to a new identity on refresh failure): the first round's established retention basis — the anonymous identity
  carries no PII, a usability tradeoff; README records the improvement path (an HttpOnly cookie is an architectural change).
- D-105: see above.
- Production deployment verification: prohibited by the red line, not executed; D-104's deployment note is stated above.

## 7. Production Deployment Notes (explanatory only, not executed)

1. First startup after the next deployment will trigger a one-time full refresh of the factor library (741-row rewrite + ghost row cleanup + embedding rebuild), causing one transient amplification of the Firestore write quota; this is expected.
2. The default value of `CORS_ORIGINS` contains this project's actual domain (myproject-dc19d.web.app); when changing the hosting domain, this environment variable and firebase.json must be updated in sync.
3. Cloud Run already requires 1Gi memory (the startup OOM conclusion recorded in commit 0b71999); keep it unchanged.

## 8. Conclusion

The audit brief's five stages are complete; all 12 items of the chapter-nine checklist are ticked (see ACCEPTANCE_RECORD_2026-10-15.md and the defect register); A-1~A-7 and V-01~V-14 are all green with evidence retained; the second re-review found zero dangling items.

---

## 9. Pre-Merge Independent Review Addendum (third round, code-reviewer)

After delivery closure and before merging into the main branch, the code-reviewer independent agent reviewed all of this round's code changes and found 5 items
(D-107~D-111, all registered and fixed; 51/51 after regression):

1. **D-107 (P2)**: background run failures remain invisible — after `POST /run` 202 the failure was swallowed and `GET /report`
   returned the old report with 200, so P6 recompute failures stayed silent in real AI mode (D-103 only covered network-layer failures).
   Fix: `taskRuns` persists the most recent failure (cleared on success, cap 1000), the report response carries
   `last_run_error`, and P6 displays and distinguishes "still recomputing (fetch timeout)" from a genuine failure.
2. **D-108 (P2)**: `listFactors`'s check-then-cache pattern, when a refresh invalidation interleaved with a slow read (Firestore network latency),
   could write a stale snapshot back into the cache, bypassing D-104. Fix: generation counting — reads that cross an invalidation do not enter the cache.
3. **D-109 (P3)**: the D-07/V-03 case snapshot was taken after the first malicious upload, so that payload fell outside the detection window.
   Fix: after pre-creating the storage root, take the snapshot first, so all three payloads fall inside the window.
4. **D-110 (P3, pre-existing)**: the `execFileSync` in C4 of `verify_acceptance.js` throws when
   `count_lines.sh` ends with exit code 1 (budget overage), so ever since the T-052 exemption the acceptance script was
   certain to crash and the exemption logic could never run. Fix: catch the non-zero exit and read stdout. Full local rerun: C4
   PASSes with the exemption conclusion and the script runs to completion (B1/B3 are public-network deployment checks; being unreachable under the local BASE is expected).
5. **D-111 (P3)**: a match row polluted before the guard would make dashboard 500. Fix: recalculateTask's
   shape guard skips non-factor rows. Two additional `_`-prefix guards (getFactorById / assignFactorManually)
   block paths that query/write `_library_meta` as a factor (the review confirmed that every legitimate factor row has both its value +
   activity_unit present, so there is no collateral damage).

Verification: `npm test` **51/51** (new D-107/D-108 cases plus D-104/D-111 assertions), `npm run build`
passes, and local verify_acceptance runs end to end with the C4 exemption in effect. The incremental line counts from this round's review changes are folded into
D-102's account (README's basis will be synced at the next reconciliation; the current script measurements are authoritative).
