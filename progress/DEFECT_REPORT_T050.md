# Defect report — report/ledger consistency (blocks T-050 sign-off)

Date: 2026-10-14
Status: **OPEN — root cause partially identified, fix not applied (protocol: no guessing)**

## What was observed

While executing the T-050 acceptance checklist, item A5 ("a review edit recalculates and
refreshes the report") failed. Investigation showed a wider problem: **a report produced by
the pipeline can disagree with the ledger it was built from.**

Concrete numbers (task `task_e5ffb6b8`, public deployment):

| Source | Total |
|---|---|
| Stored report (pipeline) | 501.367 t CO2e |
| Recalculation from stored records + matches (`GET /dashboard`) | 646.551 t CO2e |
| Difference | **145.184 t** |

Per record, the report's chapter 5 "Factor" column frequently names a **different factor**
than the one stored in `matches` for the same record:

| Record | Report chapter 5 factor | Stored match `selected_factor_id` | Model's recorded selection (ai_traces) |
|---|---|---|---|
| `rec_2da02823` "Rigid truck, 6,800 kg cargo, 130 km" | `EF-D26-ROADFREIGHT-022` (rail, 0.02583) | `EF-D26-ROADFREIGHT-009` (HGV, 0.19947) | `EF-D26-ROADFREIGHT-009` |
| `rec_2dd9c041` "Line 1: PET film, food grade" | `EF-D26-MATERIALUSE-056` (LDPE, 1095.58) | `EF-D26-MATERIALUSE-057` (PET, 3861.58) | `EF-D26-MATERIALUSE-057` |

Across one task: **14 of 20 rows disagreed with the stored matches** (only 6 agreed).

## What has been ruled out

- **Factor data is correct.** Firestore `emission_factors`: 743 documents, 743 unique
  `factor_id`, **0** documents where the document id differs from the `factor_id` field.
  Values match `data/factors/emission_factors.json` exactly.
- **The factor cache is not corrupted.** 807 factors read through the cached path
  (`GET /factors?q=…`) were compared field-by-field against the data file: 0 inconsistencies.
- **No code mutates a factor object.** No assignment to any factor property exists anywhere
  in `backend/src`; the only `emission_factors` writer is `saveFactors`, which keys each row
  by `row.factor_id`.
- **The model's selections are correct.** `ai_traces` (`stage=factor_selection`) record the
  ids shown in the third column above; each is a member of that record's candidate list.
- **A guard placed at the resolution point never fires.** `selection_factor_mismatch`
  (comparing `factor.factor_id` against `selection.selected_factor_id`, logged with
  `library_size`) produced **zero** log entries during a run whose report *does* show
  mismatched factors. So the resolution is correct at that moment, yet the calculation ends
  up carrying a different factor id.
- **Reports are internally consistent.** Chapter 5's per-record values agree with the
  citation anchors in every case (0 mismatches), so the report faithfully describes its own
  `calcs` array — the divergence is between that array and the stored `matches`.

## Root cause identified so far (partial)

**Report generation is not single-flight.** For task `task_2a5d3796` the `reports`
collection holds **two documents for the same task**, written **29 ms apart**:

```
rep_task_2a5d3796_1791917858400  generated_at 18:57:38.400Z  total_t 550.431
rep_task_2a5d3796_1791917858429  generated_at 18:57:38.429Z  total_t 485.583
```

One comes from the pipeline's own `assembleReport`; the other from the lazy self-healing
path in `GET /api/tasks/:taskId/report`, which fires when no report exists yet. When a
client polls the report while the pipeline is in its final phase, both paths assemble and
persist a report, and `latestReport()` (newest by `generated_at`) can then serve a report
built from a **partially written ledger**.

This is a real defect on its own: exactly one report per task should exist, and the lazy
path must never run concurrently with an in-flight pipeline run. **However, this does not
by itself explain a row naming a *different but valid* factor id** (a partially written
ledger would yield a missing value, not a wrong one). The mechanism that pairs a correct
selection with a different factor id inside the calculation is **not yet identified**.

## Reproduction

```
node scripts/verify_public_perf.js --runs 3      # or any repeated demo loads
```

The mismatch is intermittent and appears after several demo tasks have run in the same
Cloud Run instance (reproduced on the 3rd consecutive run). Verify with:

```bash
node -e "…"   # see progress/evidence/T-050/ for the exact comparison scripts used
```

## Consequence for the delivery

- `e2e_latency_p90`, `ai_cost_per_document` and every accuracy metric are unaffected.
- **FR-805 / FR-902 consistency and AI-201 anchor integrity are affected**: a served report
  can show per-record values that do not follow from the stored matches, and the totals then
  disagree with any recalculation.
- T-050 cannot be signed off while this is open. The acceptance checklist item A5 fails as a
  direct consequence.

## Recommended next steps (not yet applied)

1. Make report persistence single-flight: one deterministic document id per task
   (`rep_${taskId}`), written under a per-task mutex; `GET /report` must wait for an
   in-flight pipeline run instead of generating concurrently.
2. Add a reconciliation assertion to the pipeline: for every record, the `calculations`
   document must carry the same `factor_id` as `matches`, and the report total must equal the
   recomputation within display tolerance. Fail the record loudly on mismatch (this is the
   AI-204 contract) rather than persisting an inconsistent report.
3. Re-run the online battery and the T-050 checklist once (1) and (2) are in place.

Per the execution protocol, no fix has been applied while the mechanism is unresolved.
