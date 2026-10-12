# T-006 Evidence — Factor Library Data File

Date: 2026-10-12. Builder: `scripts/build_factor_library.py`; output:
`data/factors/emission_factors.json` (619 factors, static local JSON).

Raw source rows are extracted programmatically from the locked public
workbooks (DEFRA 2026 full set, 19 sheets parsed; EPA Hub 2025, stationary +
mobile combustion tables). Column semantics (variant/boundary/fuel groups)
were read from the workbooks' own label rows, not guessed.

## Verification 1 — 50-factor random sample, 13 attributes 100% complete: PASS

`scripts/check_factor_library.py` (fixed seed 20261012): `50/50 complete`.
The 13 FR-603 attributes checked: factor_id, name, description,
activity_type, emission_unit, activity_unit, value, ghg_coverage,
system_boundary, gwp_version, data_year, source_name, source_reference.
Optional helper fields (industries, priority, gas_breakdown, location) are
additions, not replacements.

## Verification 2 — industry counts and total cap: PASS

```
electronics_manufacturing: 326   apparel_textiles: 325
food_processing: 333             logistics_transportation: 407
general_office_services: 437     total unique factors: 619
```

Every industry >= 40 (FR-602); total 619 <= 1,200. Industry is a membership
tag list per factor (a factor may legitimately serve several industries);
counts are membership counts, no duplicate factor records are created.

## Verification 3 — factor_id globally unique: PASS

`duplicate_factor_ids=0` (builder also asserts uniqueness at build time).

## Verification 4 — offline load: PASS

The library is a plain local JSON file. The checker installs a socket guard
(`socket.socket.connect` raises) before loading, then parses the file:
`offline_load=OK (619 factors)` — loading performs zero network access
(FR-605).

## Value audit (extraction fidelity vs raw workbooks)

| factor_id | name (truncated) | value | matches raw workbook |
|---|---|---|---|
| EF-D26-MATERIALUSE-001 | Materials — Construction/Aggregates — Primary material production (t) | 7.80307 | DEFRA Material use row 22 col D = 7.8031 ✓ |
| EF-D26-FREIGHTINGOODS-001 | Freight — Vans/Class I — Diesel (t.km) | 0.87948 | DEFRA Freighting goods row 26 col D = 0.87948 ✓ |
| EF-E25-FUEL-001 | Fuel — Anthracite (Stationary Combustion, per MMBtu) | 104.422 | 103.69 + 11×28/1000 + 1.6×265/1000 = 104.422 ✓ (AR5 GWP folding, breakdown preserved in gas_breakdown) |

## Library design notes (PRD 7.2)

- Boundary-caliber pairs exist as real data: e.g. `Fuels` (tank-to-wheel /
  direct combustion) vs `WTT- fuels` (well-to-tank upstream) per fuel — the
  "boundary caliber" difficulty class of Golden group 3 uses these.
- Multi-variant material factors (primary / re-used / open-loop /
  closed-loop) and waste-treatment routes (7 disposal variants) are separate
  factors with distinct boundaries.
- All factors carry `gwp_version: AR5` per both sources' documentation
  (DEFRA Introduction sheet states AR5 100-year GWPs; EPA Hub GWP table is
  AR5). Tasks selecting AR6 exercise the cross-version rule (PRD 4.5).
- Location labels use ISO alpha-2 (hotel/electricity country rows) where the
  source is country-specific.
- Priority: DEFRA = 1, EPA = 2 (multi-source same-semantics rule, PRD 7.2).
