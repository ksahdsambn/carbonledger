# T-002 Evidence — Skeleton & Central Configuration

Date: 2026-10-12. All commands run from repo root on the local machine.

## Verification 1 — Config keys match PRD 8.3 (11 items, defaults complete): PASS

Command: `node scripts/print-config.js`

```
key | value | default | overriddenByEnv | description
EXTRACTION_MODEL | gemini-2.5-flash | gemini-2.5-flash | false | Gemini Flash-tier model used for document classification and field extraction
REASONING_MODEL | gemini-2.5-pro | gemini-2.5-pro | false | Gemini Pro-tier model used for factor selection and report generation
EMBEDDING_MODEL | gemini-embedding-001 | gemini-embedding-001 | false | Google Cloud official text embedding model used for semantic recall
BATCH_SIZE | 10 | 10 | false | Number of units processed per batch call
CLASSIFICATION_CONFIDENCE_THRESHOLD | 0.7 | 0.7 | false | Document classification confidence below this routes to manual confirmation
FACTOR_MATCH_CONFIDENCE_THRESHOLD | 0.65 | 0.65 | false | Factor match confidence threshold; below it a record is flagged as having no high-confidence factor
AI_RETRY_COUNT | 2 | 2 | false | Automatic retries for each AI model call before marking the target failed
AI_TIMEOUT_SECONDS | 60 | 60 | false | Timeout in seconds for a single AI model call attempt
DEFAULT_GWP_VERSION | AR6 | AR6 | false | Default GWP version for new accounting tasks (AR5 or AR6)
STORAGE_BUCKET_NAME | carbonledger-files | carbonledger-files | false | Object storage bucket for original uploaded files
GCP_PROJECT_ID | carbonledger | carbonledger | false | Google Cloud project identifier
```

11/11 keys present, one-to-one with PRD 8.3 list (extraction model, reasoning
model, embedding model, batch size, classification threshold 0.7, factor match
threshold 0.65, retry count, timeout seconds, default GWP version, bucket
name, cloud project id). Defaults all non-empty.

## Verification 2 — Environment variable override changes the value: PASS

Command: `EXTRACTION_MODEL=gemini-2.0-flash BATCH_SIZE=3 FACTOR_MATCH_CONFIDENCE_THRESHOLD=0.9 node scripts/print-config.js`

```
EXTRACTION_MODEL | gemini-2.0-flash | gemini-2.5-flash | true | ...
BATCH_SIZE | 3 | 10 | true | ...
FACTOR_MATCH_CONFIDENCE_THRESHOLD | 0.9 | 0.65 | true | ...
```

Values changed accordingly (string, int and float coercion verified by unit
test `backend/test/config.test.js`, 3 tests).

## Verification 3 — Secret pattern scan, zero hits: PASS

Command: `bash scripts/scan-secrets.sh`

```
SECRET SCAN: PASSED (0 hits)
```

Positive control performed: a probe file containing a fake `AIza…` key was
created, the scanner reported `SECRET SCAN HIT [google-api-key]` and exited 1;
the probe was removed and the scan returned to 0 hits. Patterns scanned:
private-key headers, service-account JSON signature, Google API keys
(`AIza…{30,}`), GCP OAuth refresh tokens. Scan covers tracked + untracked
non-ignored files.

## Skeleton contents delivered

- Monorepo: `backend/` (Express, ESM), `frontend/` (Vite + React, light
  theme), `data/` (factors/golden/demo), `eval/`, `deploy/`, `progress/`,
  `scripts/` (build, test, smoke, print-config, scan-secrets).
- Backend: `/healthz` health endpoint, `/config` non-secret config endpoint,
  JSON-lines structured logging, in-process async queue with Cloud Tasks
  adapter slot, collection-oriented store abstraction (LocalFileStore now,
  Firestore adapter slot for T-043) covering all 12 PRD 8.4 collections.
- Error registry `backend/src/errors.js`: 13 machine-readable codes with
  English descriptions covering every known failure type listed in the plan
  (unsupported format, size limit, corrupt file, parse failure, extraction
  failure, model call failure, model timeout, invalid enum, insufficient
  candidates, no confident factor, invalid reference, storage access failure,
  task not found).
- `.gitignore`: secrets (`*.key`, `*.pem`, `service-account*.json`, `.env*`),
  dependencies (`node_modules/`), build artifacts (`frontend/dist/` etc.).
- Unit tests: 8 passing (`node --test`), including config/env-override,
  error registry, queue dispatch/failure accounting, local store
  persistence/reload across the 12 collections.
