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
  development, tests and the offline evaluation tool. Pipeline runs execute inline on the
  instance (CPU is always allocated) and are tracked per task so a second trigger queues
  behind the run in flight.
- **AI layer**: every generative call goes through one unified wrapper that enforces
  structured output (response schemas), closed-set validation with retry, timeouts and
  retries from configuration, and records every call (input/output summary, latency, token
  usage, cost estimate) into the `ai_traces` collection.
- **Identity**: entering the site completes a Firebase Authentication *anonymous* sign-in,
  so a judge reaches the whole flow with no registration and no credential. The SPA sends
  its ID token with every API call; the backend verifies it with Firebase Authentication
  and the verified uid owns the task, so one visitor can never read another visitor's files
  or records. Requests without a token stay allowed but unowned, which keeps the API usable
  from scripts and offline runs.
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
- Gemini model split per task economics: A single mandated Flash-Lite model (`gemini-3.5-flash-lite`) serves classification,
  extraction, boundary decisions, factor-selection reasoning (40+ word comparative
  rationale, runner-up retained) and report narratives.
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

## Live demo

**Public site: https://myproject-dc19d.web.app** — open it, click "Load demo dataset
(one click)" on P2, and watch the 20-document pipeline run to a ten-chapter report with
PDF/CSV exports. No registration required.

## Build and run locally

```bash
npm install          # workspace deps
npm run build        # frontend build + backend syntax pass
npm test             # 48 automated checks (47 unit/e2e cases + 1 upload suite)
npm run smoke        # boot /healthz / graceful shutdown
node backend/src/server.js   # start the API (http://localhost:8080)
cd frontend && npm run dev   # dev UI on http://localhost:5173 (proxies /api)
```

Without `GEMINI_API_KEY` the AI layer runs a deterministic mock adapter so the whole
pipeline works offline; every trace is labelled `adapter: mock`, and accuracy metrics are
never computed from mock runs.

## Deployment (Cloud Run + Firebase)

1. Backend to Cloud Run. CPU must stay allocated because the pipeline continues after the
   HTTP response returns:

   ```bash
   gcloud run deploy carbonledger-backend --source . --region asia-southeast1 \
     --allow-unauthenticated --no-cpu-throttling --min-instances 0 --max-instances 3 \
     --set-env-vars "GEMINI_API_KEY=<key>,STORE_KIND=firestore,STORAGE_KIND=firebase,\
   STORAGE_BUCKET_NAME=<bucket>,GCP_PROJECT_ID=<project>,AI_TIMEOUT_SECONDS=60,DEFAULT_GWP_VERSION=AR6"
   ```

2. Firebase: enable Hosting, Firestore, Storage and the **Anonymous** sign-in provider.
3. Build the frontend with the public Firebase web configuration. It is injected at build
   time from a gitignored `frontend/.env`, so no key material is ever committed:

   ```bash
   # frontend/.env
   VITE_FIREBASE_API_KEY=<public web api key>
   VITE_FIREBASE_AUTH_DOMAIN=<project>.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=<project>
   npm run build --workspace carbonledger-frontend
   firebase deploy --only hosting
   ```

   Without that file the SPA still runs, just without an anonymous identity.
4. `firebase.json` rewrites `/api/**` and `/factors/**` to the Cloud Run service. Every
   secret is injected at runtime only — the repository contains none (`npm run scan-secrets`).

## Environment variables (11 PRD 8.3 parameters + 1 policy knob)

| Variable | Default | Meaning |
|---|---|---|
| EXTRACTION_MODEL | gemini-3.5-flash-lite | Gemini Flash-tier model for classification/extraction/boundary |
| REASONING_MODEL | gemini-3.5-flash-lite | Model for selection reasoning and report narratives (same model under the single-model mandate) |
| EMBEDDING_MODEL | gemini-embedding-001 | Google official embedding model for semantic recall |
| BATCH_SIZE | 10 | Units per batch call |
| CLASSIFICATION_CONFIDENCE_THRESHOLD | 0.7 | Below this a unit routes to manual confirmation |
| FACTOR_MATCH_CONFIDENCE_THRESHOLD | 0.65 | Below this a record has "no high-confidence factor" |
| AI_RETRY_COUNT | 2 | Retries per AI call before failing the target |
| AI_TIMEOUT_SECONDS | 60 | Timeout per AI call attempt |
| DEFAULT_GWP_VERSION | AR6 | Default GWP version for new tasks (AR5/AR6) |
| STORAGE_BUCKET_NAME | carbonledger-files | Object storage bucket for originals |
| GCP_PROJECT_ID | carbonledger | Google Cloud project id |
| AI_MODEL_ALLOWLIST | gemini-3.5-flash-lite,gemini-embedding-001 | Models a real call may use. A generative call naming anything else is refused before a request is made (single-model mandate); widening it is a configuration change, never a code change |

Additional runtime switches: `AI_MODE` (real/mock), `RECALL_CHANNEL` (both/keyword/semantic),
`STORE_KIND`/`STORAGE_KIND` (local/firestore/firebase), `STORE_ROOT`/`STORAGE_ROOT`,
`RATE_LIMIT_PER_MIN` (per-IP request budget on the public deployment, default 60),
`TRUST_PROXY` (set to `1` behind a trusted reverse proxy so the rate limiter honours the
forwarded client address; otherwise the socket address is used), `PIPELINE_CONCURRENCY`
(documents processed in parallel, default 4), `AI_PRICES_JSON`
(price-table override), `FACTOR_FILE` (factor data file), `CORS_ORIGINS`, and the
build-time `VITE_FIREBASE_*` trio described under Deployment.

## Error codes (machine-readable)

ERR_FILE_FORMAT_UNSUPPORTED, ERR_FILE_TOO_LARGE, ERR_FILE_CORRUPT, ERR_PARSE_FAILED,
ERR_EXTRACTION_FAILED, ERR_MODEL_CALL_FAILED, ERR_MODEL_TIMEOUT, ERR_ENUM_INVALID,
ERR_CANDIDATES_INSUFFICIENT, ERR_NO_CONFIDENT_FACTOR, ERR_REFERENCE_INVALID,
ERR_STORAGE_ACCESS, ERR_TASK_NOT_FOUND, ERR_FORBIDDEN, ERR_RATE_LIMITED — each with an
English description (`backend/src/errors.js`). `ERR_FORBIDDEN` (403) is returned when a
request reaches a task owned by another identity; `ERR_RATE_LIMITED` (429) when the
per-IP request budget is exhausted.

## Evaluation

Command line: `node eval/run.js` (all metric groups) or `node eval/run.js --group
<classification|extraction|matching|boundary|calculation|report|performance>`.
Output contract: single table (metric / target / measured / PASS-FAIL), summary row, and a
one-vote veto on any invalid reference; machine-readable JSON and human-readable markdown
are written side by side.

**Full run on the real adapter and the public deployment — 11/11 PASS, overall verdict
`PASS`, 0 invalid references.** Machine-readable and human-readable output:
`eval/results/run-online/`.

| Metric | Target | Measured | Result |
|---|---|---|---|
| Document classification accuracy (Top-1) | ≥ 93% (≥ 28/30) | 29/30 documents (96.7%), pages 32/33 | PASS |
| Field extraction accuracy | average ≥ 95%; quantity/unit ≥ 98% | average 100.0%, quantity 100.0%, unit 100.0% | PASS |
| Factor matching accuracy (Top-1) | ≥ 85% (≥ 34/40) | 34/40 (85.0%) | PASS |
| Factor matching accuracy (Top-3) | ≥ 95% (≥ 38/40) | 39/40 (97.5%) | PASS |
| Scope decision accuracy | ≥ 90% on both subsets | scope 9/10, category 12/12 | PASS |
| Calculation correctness | 100% | 10/10 exact at 3-decimal display | PASS |
| Aggregation consistency | 0 inconsistencies | 0 (four dimensions, display-consistent parts) | PASS |
| Report citation coverage | 100% | 100% | PASS |
| Invalid reference count (veto) | 0 | 0 | PASS |
| End-to-end latency, 20 documents (P90) | ≤ 3 minutes | 61.3 s (P90 of 10 public one-click runs) | PASS |
| AI processing cost per document | ≤ USD 0.03 | $0.00058 (102 model calls, $0.0117 per 20-document run) | PASS |

Supporting measurements, each with its own evidence file:

- **Reliability and security** (`scripts/verify_public_faults.js`,
  `progress/evidence/T-046/public_faults.json`): a 20-file batch with 3 corrupt files ingests
  the other 17 with `ERR_FILE_CORRUPT` per rejection; a timed-out model call is retried
  exactly twice and then marked failed with a machine-readable code, while a fatal upstream
  answer (4xx) is not retried at all; all 15 error codes are documented below; cross-task,
  cross-identity and forged-header access are all rejected; the public URL returns HTTP 429
  after 44 rapid requests.
- **2026-10 audit hardening** (`progress/DEFECT_REGISTER_2026-10-14.md`,
  `backend/test/regression.test.js`): conditional task-ownership enforcement on every
  task-scoped route (`ERR_FORBIDDEN` when a task has an owner and the caller is someone
  else), filename sanitization plus storage-root containment for uploads, upload size/count
  limits enforced by the middleware before buffering, CSV formula-injection neutralization,
  finite-number guards across extraction/normalization/calculation/review, scenario
  recomputation isolated from the stored ledger, socket-address rate-limit keys, an explicit
  CORS allowlist, document-byte redaction in AI traces, and a 17-case regression battery
  (V-01…V-12 scenarios, plus the second-review defects D-60/D-62/D-63/D-65/D-66/D-67).
- **Report/ledger consistency** (`scripts/verify_consistency.js`,
  `progress/evidence/T-050/consistency.json`): every report row's factor and emission equals
  the recomputation from the stored ledger, across 13 consecutive tasks.
- **Final acceptance checklist** (`scripts/verify_acceptance.js`,
  `progress/evidence/T-050/acceptance.md`): PRD 10.3 functional 8/8, compliance 5/5,
  engineering 5/5, plus keyboard access and colour-independence NFRs.
- **Code size** (`scripts/count_lines.sh`): application code 4,544 lines; with all first-party
  JavaScript verification and build tooling 7,705 lines; including the offline Python dataset
  toolchain 9,500 lines (hard cap 10,000). Figure B currently **exceeds** the 7,000-line
  NFR-504 target: the 2026-10 audit added a mandatory regression battery and security
  middleware faster than dead code could be recovered; the overage is recorded in the defect
  register (`progress/DEFECT_REGISTER_2026-10-14.md`, D-02) and figure C remains within the
  hard cap.

Video acceptance (4 items), the real-person 5-second usability check, and the deck PDF /
video production steps remain manual; they are listed with instructions in
`progress/evidence/T-050/acceptance.md`.

## Privacy

User-uploaded documents and all derived data are used only to produce the user's own
report. **No user data is used for model training.** Uploaded files are isolated per
accounting task: the task owner is the uid of the verified Firebase anonymous session, and
a request from another identity is rejected with `ERR_FORBIDDEN` (a task with no owner
stays open so scripts and the one-click demo keep working). Upload filenames are sanitized
and every stored object is confined to the storage root. AI traces record only summaries —
document bytes are never written to a trace. The public deployment also applies a per-IP
rate limit keyed by the connection's socket address (`ERR_RATE_LIMITED`); set
`TRUST_PROXY=1` only when running behind a trusted reverse proxy so the forwarded client
address can be honoured.

## Repository layout

`backend/` API + engines · `frontend/` SPA · `data/factors` factor library ·
`data/golden` Golden dataset (30 docs + answers + 40 matching cases) · `data/demo`
one-click dataset · `eval/` evaluation tool · `scripts/` build/verify scripts ·
`progress/` execution log and evidence (working language: Chinese).
