# Defect report — report/ledger consistency (T-050)

Date: 2026-10-14
Status: **RESOLVED — fixed, verified over 13 consecutive tasks**

## What was observed

While executing the T-050 acceptance checklist, item A5 ("a review edit recalculates and
refreshes the report") failed. Investigation uncovered a wider defect: **a report produced
by the pipeline could disagree with the ledger it was built from.**

Concrete numbers (task `task_e5ffb6b8`, public deployment):

| Source | Total |
|---|---|
| Stored report (pipeline) | 501.367 t CO2e |
| Recalculation from stored records + matches (`GET /dashboard`) | 646.551 t CO2e |
| Difference | **145.184 t** |

Per record, the report's chapter 5 "Factor" column named a **different factor** than the one
stored in `matches` for the same record, while the model's recorded selection agreed with the
match:

| Record | Report factor | Stored match | Model's recorded selection |
|---|---|---|---|
| `rec_2da02823` "Rigid truck, 6,800 kg cargo, 130 km" | `EF-D26-ROADFREIGHT-022` (rail) | `EF-D26-ROADFREIGHT-009` (HGV) | `EF-D26-ROADFREIGHT-009` |
| `rec_2dd9c041` "Line 1: PET film, food grade" | `EF-D26-MATERIALUSE-056` (LDPE) | `EF-D26-MATERIALUSE-057` (PET) | `EF-D26-MATERIALUSE-057` |

14 of 20 rows in that task disagreed with the stored matches.

## Investigation

Ruled out with evidence:

- **Factor data integrity** — Firestore `emission_factors` holds 743 documents, 743 unique
  `factor_id`, **0** documents where the document id differs from the `factor_id` field, and
  values identical to `data/factors/emission_factors.json`.
- **Factor cache integrity** — 807 factors read through the cached path
  (`GET /factors?q=…`) compared field-by-field against the data file: 0 inconsistencies.
- **Factor mutation** — no assignment to any factor property exists anywhere in
  `backend/src`; the only `emission_factors` writer keys every row by `row.factor_id`.
- **Model selection quality** — `ai_traces` (`stage=factor_selection`) record ids that agree
  with the stored matches, and each is a member of its record's candidate list.
- **A guard at the resolution point never fired** — `selection_factor_mismatch` (comparing
  `factor.factor_id` with `selection.selected_factor_id`, logging `library_size`) produced
  zero entries during a run whose report did show mismatched factors, so resolution was
  correct and the divergence happened later.
- **Reports are internally consistent** — chapter 5's per-record values agree with the
  citation anchors in every case, so a report faithfully describes its own `calcs` array; the
  divergence is between that array and the persisted `matches`.

## Root cause

**Report generation was not single-flight.** For task `task_2a5d3796` the `reports`
collection held **two documents for the same task**, written **29 ms apart**:

```
rep_task_2a5d3796_1791917858400  generated_at 18:57:38.400Z  total_t 550.431
rep_task_2a5d3796_1791917858429  generated_at 18:57:38.429Z  total_t 485.583
```

One came from the pipeline's own `assembleReport`; the other from the lazy self-healing path
in `GET /api/tasks/:taskId/report`, which fired because no report existed yet at that instant.
When a client polled the report while the pipeline was in its final phase, both paths
assembled and persisted a report, and `latestReport()` (newest by `generated_at`) could then
serve a report assembled from a **partially written ledger** — records already persisted,
their calculations not yet written. That is exactly the observed shape: a report whose
per-record factors do not follow from the stored matches.

## Fix

1. **One deterministic report document per task** (`rep_${taskId}`), so a second assembly
   replaces the previous report instead of leaving two for `latestReport()` to choose between.
2. **Single-flight report generation.** `backend/src/services/taskRuns.js` tracks the pipeline
   run per task; both run endpoints register their run, and `GET /report` waits for a run in
   flight before reading or lazily generating. The lazy path can no longer execute
   concurrently with the run that is about to persist the report.
3. **Invariant check kept** — `selection_factor_mismatch` logs (with the resolved id and
   library size) if the factor used for a calculation is ever not the one the selection named
   (FR-702 / AI-204).

## Verification

- **Reproduction before the fix:** three consecutive demo runs in one warm instance —
  run 3 showed 7 mismatched factor ids.
- **After the fix:** three consecutive demo runs — 0 mismatches; then a full 10-run battery
  plus the 3 reproduction tasks — **13/13 tasks report-consistent**.
- `scripts/verify_consistency.js` is the permanent regression guard. It checks, per task,
  that every report row's factor and emission equal the recomputation from the stored ledger,
  that the report total matches the ledger total, that excluded records carry no factor and
  are disclosed in chapter 10, and that every excluded ledger record appears there.
  Evidence: `progress/evidence/T-050/consistency.json`.
- T-050 acceptance re-run: functional 8/8 (including A5), compliance 5/5, engineering 5/5,
  accessibility NFRs 2/2 → PASS.

## Note on the T-044 latency evidence

The earlier T-044 battery that recorded 9/10 runs was affected by the same race (one run
reported 19/20 documents terminal). With the fix the battery records **10/10 runs passed,
P90 = 61.3 s**. See `progress/evidence/T-044/public_runs.json`.

## Addendum — 2026-10 audit re-check

The 2026-10 full audit re-examined this fix and confirms it still holds and has been
strengthened:

- **One deterministic report document per task** (`rep_${taskId}`) — unchanged.
- **Single-flight report generation** — unchanged, and now extended: `POST /run` and
  `POST /api/demo/load` queue a second trigger behind the run in flight (defect D-33), so a
  concurrent re-run can no longer assemble a report from a partial ledger at all. The
  regression battery (`backend/test/regression.test.js`) covers the re-run completeness and
  the report/ledger consistency path.
- **Scenario isolation** (defect D-05) closes a related contamination route this report did
  not cover: scenario recomputation used to write through the same `calc_<record_id>` keys as
  the baseline ledger, so a stored report could read what-if values. `computeEmission` now
  takes `persist:false` on the scenario path and the baseline ledger is never overwritten.

The consistency guard `scripts/verify_consistency.js` remains the permanent regression check
and passed 1/1 against a local service during the audit (20 rows, 0 mismatches).
