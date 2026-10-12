# CarbonLedger — Scope 3 Carbon Accounting and Disclosure Agent

**Track: Sustainability & Social Impact** (AI Builder Cup 2026 — Google Cloud JAPAC Hackathon)

CarbonLedger compresses the cost of producing a Scope 3 report from "RMB 30,000 + 3 weeks"
to "1 hour + near-zero marginal cost", while making every single number traceable back to
its source document.

Upload mixed-format evidence (PDF including scans, photos, XLSX, CSV), and the agent
classifies each page, extracts activity data, normalizes units and locations, decides the
GHG Protocol boundary, semantically matches public emission factors, grades uncertainty,
computes Scope 1/2/3 emissions, builds three reduction scenarios, and produces a
ten-chapter English report with PDF/CSV exports and a full audit trail.

## Architecture

- **Frontend**: React (Vite) single-page app — nine pages (task creation, upload,
  records, matching viewer, dashboard, scenarios, report reader, review queue, AI traces).
  Deployed to Firebase Hosting.
- **Backend**: Node.js (Express) on **Cloud Run** (autoscaling, scale-to-zero). A storage
  abstraction selects Firebase Storage + Firestore in production and local adapters for
  development, tests and the offline evaluation tool. An async task-queue abstraction
  selects Cloud Tasks in production.
- **AI layer**: every generative call goes through one unified wrapper that enforces
  structured output (response schemas), closed-set validation with retry, timeouts and
  retries from configuration, and records every call (input/output summary, latency, token
  usage, cost estimate) into the `ai_traces` collection.
- **Factor library**: 743 curated factors from public sources, shipped as a static JSON
  file (`data/factors/emission_factors.json`) — loading never touches the network.
  Dual-channel recall: keyword/structured matching + semantic vector search
  (in-process cosine index) over Google official embeddings; each channel can be disabled
  for contrast experiments (`RECALL_CHANNEL`).
- **Data model**: Firestore-style collections exactly per the specification — tasks,
  documents, document_units, activity_records, emission_factors, matches, calculations,
  scenarios, reports, review_items, audit_trail, ai_traces.

## Deep Gen AI usage (Google Cloud toolchain)

- Structured output (`responseSchema`) on **every** generative call — classification,
  extraction, boundary decision, factor selection, report narratives; no free-text
  parsing anywhere in the codebase.
- Gemini model split per task economics: Flash tier (`gemini-2.5-flash`) for
  classification/extraction/boundary, Pro tier (`gemini-2.5-pro`) for factor selection
  reasoning (40+ word comparative rationale, runner-up retained) and report narratives.
- Google official embedding model (`gemini-embedding-001`) for the semantic recall channel.
- Deterministic rule engines where models add no value (uncertainty grading, unit
  self-checks, GWP folding, rounding) — auditable and reproducible by design.
- Hallucination governance: factor ids outside the candidate list are rejected and
  retried (never used); every numeric report conclusion carries a citation anchor that is
  scanned for coverage and validity; dangling references veto the evaluation verdict.

## Data sources (all public, offline-loaded)

| Source | Version | Link |
|---|---|---|
| UK Government GHG Conversion Factors for Company Reporting (DESNZ), full set | 2026 | https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2026 |
| US EPA GHG Emission Factors Hub | 2025 (Jan) | https://www.epa.gov/climateleadership/ghg-emission-factors-hub |
| EPA USEEIO open-source industry-average models | current | https://github.com/USEPA/USEEIO |

Factors cover five industries (electronics manufacturing, apparel/textiles, food
processing, logistics, general office services), each ≥ 40 factors, 743 unique factors
in total. Data years: 2025 (63) and 2026 (680). All factors are AR5-labelled per the
sources; tasks selecting AR6 exercise the cross-version disclosure rule.

## Build and run locally

```bash
npm install          # workspace deps
npm run build        # frontend build + backend syntax pass
npm test             # 30 automated checks (unit + e2e + upload suite)
npm run smoke        # boot /healthz / graceful shutdown
node backend/src/server.js   # start the API (http://localhost:8080)
cd frontend && npm run dev   # dev UI on http://localhost:5173 (proxies /api)
```

Without `GEMINI_API_KEY` the AI layer runs a deterministic mock adapter so the whole
pipeline works offline; every trace is labelled `adapter: mock`, and accuracy metrics are
never computed from mock runs.

## Deployment (Cloud Run + Firebase)

1. `gcloud run deploy carbonledger-backend --source backend/ --region asia-east2 --set-env-vars "GEMINI_API_KEY=<key>,GCP_PROJECT_ID=<project>,STORAGE_BUCKET_NAME=<bucket>" --allow-unauthenticated --min-instances 0 --max-instances 10`
2. `firebase init` (Hosting + Auth anonymous + Storage + Firestore), then `firebase deploy` from `frontend/` with rewrites pointing at the Cloud Run service URL.
3. Environment variables are injected at runtime only — no secrets live in the repository.

## Environment variables (11, PRD 8.3)

| Variable | Default | Meaning |
|---|---|---|
| EXTRACTION_MODEL | gemini-2.5-flash | Gemini Flash-tier model for classification/extraction/boundary |
| REASONING_MODEL | gemini-2.5-pro | Gemini Pro-tier model for selection reasoning and narratives |
| EMBEDDING_MODEL | gemini-embedding-001 | Google official embedding model for semantic recall |
| BATCH_SIZE | 10 | Units per batch call |
| CLASSIFICATION_CONFIDENCE_THRESHOLD | 0.7 | Below this a unit routes to manual confirmation |
| FACTOR_MATCH_CONFIDENCE_THRESHOLD | 0.65 | Below this a record has "no high-confidence factor" |
| AI_RETRY_COUNT | 2 | Retries per AI call before failing the target |
| AI_TIMEOUT_SECONDS | 60 | Timeout per AI call attempt |
| DEFAULT_GWP_VERSION | AR6 | Default GWP version for new tasks (AR5/AR6) |
| STORAGE_BUCKET_NAME | carbonledger-files | Object storage bucket for originals |
| GCP_PROJECT_ID | carbonledger | Google Cloud project id |

Additional runtime switches: `AI_MODE` (real/mock), `RECALL_CHANNEL` (both/keyword/semantic),
`STORE_KIND`/`STORAGE_KIND` (local/firestore/firebase), `STORE_ROOT`/`STORAGE_ROOT`.

## Error codes (machine-readable)

ERR_FILE_FORMAT_UNSUPPORTED, ERR_FILE_TOO_LARGE, ERR_FILE_CORRUPT, ERR_PARSE_FAILED,
ERR_EXTRACTION_FAILED, ERR_MODEL_CALL_FAILED, ERR_MODEL_TIMEOUT, ERR_ENUM_INVALID,
ERR_CANDIDATES_INSUFFICIENT, ERR_NO_CONFIDENT_FACTOR, ERR_REFERENCE_INVALID,
ERR_STORAGE_ACCESS, ERR_TASK_NOT_FOUND — each with an English description
(`backend/src/errors.js`).

## Evaluation

Command line: `node eval/run.js` (all metric groups) or `node eval/run.js --group
<classification|extraction|matching|boundary|calculation|report|performance>`.
Output contract: single table (metric / target / measured / PASS-FAIL), summary row, and a
one-vote veto on any invalid reference; machine-readable JSON and human-readable markdown
are written side by side.

**Current status (honest)**: the evaluation tool is fully wired; the accuracy, latency and
cost metrics require the real Gemini adapter and are executed when `GEMINI_API_KEY` is
present. All pipeline mechanics (classification routing, extraction schema, closed enums,
recall window, uncertainty rules, zero-tolerance calculations, aggregation consistency,
citation coverage, veto logic) are covered by 30 automated tests that run offline.

## Privacy

User-uploaded documents and all derived data are used only to produce the user's own
report. **No user data is used for model training.** Uploaded files are isolated per
accounting task; cross-task access is rejected.

## Repository layout

`backend/` API + engines · `frontend/` SPA · `data/factors` factor library ·
`data/golden` Golden dataset (30 docs + answers + 40 matching cases) · `data/demo`
one-click dataset · `eval/` evaluation tool · `scripts/` build/verify scripts ·
`progress/` execution log and evidence (working language: Chinese).
