# T-004 Evidence — Evaluation Tool Skeleton

Date: 2026-10-12. Tool: `node eval/run.js` (modes: run-all, `--group <name>`).

## Verification 1 — full run shows all 11 metrics with 4 columns: PASS

Command: `node eval/run.js --out eval/results/run`

Output: single table with header `| Metric | Target | Measured | Result |`
followed by 11 metric rows (classification Top-1, field extraction, factor
match Top-1/Top-3, scope decision, calculation correctness, aggregation
consistency, citation coverage, invalid references, E2E P90, cost per
document) and one summary row. All rows currently FAIL with `(not measured)`
measured values, per the skeleton contract.

## Verification 2 — single-group run outputs only the selected group: PASS

Command: `node eval/run.js --group matching`

Output contained exactly the 2 matching-group metric rows and no rows from
other groups. Group set: classification, extraction, matching, boundary,
calculation, report, performance.

## Verification 3 — invalid-reference veto produces overall FAIL: PASS

Injected fake per-metric result files: 10 of 11 metrics set to pass,
`invalid_references` set to measured=1 pass=false. Run output:

```
Overall verdict: FAIL (invalid-reference veto)
```

Control: with `invalid_references` = 0 (pass), verdict was `PASS`. All fake
files were then deleted (`rm eval/results/*.json`); a fresh run reports FAIL
with all metrics not measured. Veto logic confirmed (EV-4).

## Verification 4 — machine-readable + human-readable files, consistent: PASS

`eval/results/run/evaluation.json` and `eval/results/run/evaluation.md` are
written by every run. Cross-check script output:

```
json rows: 11 | md metric rows: 11
summary in md: true
CONSISTENT: true
```

Both files share the same rows, results and summary verdict (EV-6, EV-1..3).
