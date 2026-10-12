# Emission Factor Sources (locked record — PRD FR-601, plan task T-005)

All factor data is downloaded once, curated into the local factor library file
(`data/factors/emission_factors.json`, built in T-006) and shipped with the
repository. The pipeline never fetches these sources at runtime (FR-605).

| # | Source name | Version year | Public link | Acquisition method |
|---|---|---|---|---|
| S1 | UK Government GHG Conversion Factors for Company Reporting (DESNZ) — full set | 2026 (v1.0, published June 2026) | https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2026 | Direct XLSX download: https://assets.publishing.service.gov.uk/media/6a29392bade52dc0882218a8/ghg-conversion-factors-2026-full-set.xlsx (stored at `data/sources/ghg-conversion-factors-2026-full-set.xlsx`, 2.1 MB) |
| S2 | US EPA GHG Emission Factors Hub | 2025 (January 2025 edition) | https://www.epa.gov/climateleadership/ghg-emission-factors-hub | Direct XLSX download: https://www.epa.gov/system/files/other-files/2025-01/ghg-emission-factors-hub-2025.xlsx (stored at `data/sources/ghg-emission-factors-hub-2025.xlsx`, 1.0 MB) |
| S3 | EPA USEEIO open-source models — supply-chain industry-average factors for US industries and commodities | current master (USEEIO v2.0 model generation) | https://github.com/USEPA/USEEIO | Clone/download of public repository data files (indicator tables and commodity/industry demand vectors); used to seed industry-average factors for electronics manufacturing, apparel and food processing where S1/S2 have no direct factor |

## Link accessibility verification (2026-10-12)

| URL | HTTP status |
|---|---|
| https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2026 | 200 |
| https://assets.publishing.service.gov.uk/media/6a29392bade52dc0882218a8/ghg-conversion-factors-2026-full-set.xlsx | 200 (2,109,334 bytes, valid XLSX) |
| https://www.epa.gov/climateleadership/ghg-emission-factors-hub | 200 |
| https://www.epa.gov/system/files/other-files/2025-01/ghg-emission-factors-hub-2025.xlsx | 200 (1,014,275 bytes, valid XLSX) |
| https://github.com/USEPA/USEEIO | 200 |

## License basis (public availability, PRD assumption A-1)

- S1: published under the Open Government Licence v3.0 (stated on the gov.uk page).
- S2: US EPA public data (US Government work, public domain).
- S3: public repository (US EPA, MIT license).

## GWP note

S1 and S2 publish factors in kgCO2e using AR5-based GWP values (S1 states
AR5 GWP; S2 references IPCC AR5). Where both AR5 and AR6 variants are needed
for the cross-version matching rule (PRD 4.5), the library stores the source
GWP label per factor and marks curated AR6 variants derived per the same
sources' documentation as such; no non-official GWP conversion is invented.
