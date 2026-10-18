# T-005 Evidence — Factor Source Lock (Gate G0)

Date: 2026-10-12.

## Verification 1 — source record with all four elements + accessible links: PASS

`data/factors/SOURCES.md` records three sources (UK DESNZ GHG conversion
factors 2026 full set; US EPA GHG Emission Factors Hub 2025; EPA USEEIO
open-source industry-average models), each with: source name, version year,
public link, acquisition method. Accessibility was verified live:

| URL | HTTP status |
|---|---|
| gov.uk 2026 publication page | 200 |
| DEFRA 2026 full-set XLSX asset | 200 — downloaded, 2,109,334 bytes, valid XLSX (41 sheets incl. Material use, Freighting goods, WTT set, Waste disposal, UK/Overseas electricity, Heat and steam, Water, Refrigerant) |
| EPA hub page | 200 |
| EPA hub 2025 XLSX | 200 — downloaded, 1,014,275 bytes, valid XLSX |
| USEPA/USEEIO GitHub | 200 |

Both raw workbooks are stored at `data/sources/` and ship with the repo; the
factor library will load from local files only (FR-605).

## Verification 2 — initial factor list for each of the 5 industries: PASS

`data/factors/initial_coverage.md` lists a concrete initial factor list per
industry (electronics manufacturing, apparel/textiles, food processing,
logistics/transportation, general office services), grounded in actual
category rows verified inside the downloaded DEFRA 2026 workbook (e.g.
Material use sheet contains Clothing, Food and drink, Electrical items - IT/
large/small, Metals, Plastics: HDPE/LDPE/PET/PP/PS/PVC, Paper and board;
Freighting goods sheet has 234 rows covering road/rail/sea/air). Identified
gaps and supplementary sources (USEEIO) are recorded.

## Verification 3 — G0 gate conditions: PASS → "G0 passed"

| G0 exit condition | Evidence |
|---|---|
| Factor sources determined and documented | `data/factors/SOURCES.md` (this task) |
| Skeleton initialized, locally one-command buildable & runnable | `bash scripts/build.sh` 3x success + `bash scripts/smoke.sh` 3x success (T-003 evidence) |
| Basic self-test script executable | `bash scripts/test.sh` exit 0, pass=8 fail=0, negative control verified (T-003 evidence) |

Conclusion recorded in the execution log: **G0 passed** (2026-10-12).
