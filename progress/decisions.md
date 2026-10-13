# Decision Record — CarbonLedger

Engineering decisions required by T-001. All model ids are centralized later in
the config file created in T-002 (backend config module); this record is the
authoritative source for the initial values.

| # | Decision area | Value | Rationale |
|---|---|---|---|
| D-1 | Extraction/classification model | `gemini-3.5-flash-lite` | User mandate: a single Gemini model for every generative call. `gemini-2.5-flash-lite` was retired for new users (HTTP 404), so the Flash-Lite successor is used. |
| D-2 | Reasoning/selection/report model | `gemini-3.5-flash-lite` | Same single-model policy as D-1; structured output plus a validator enforces the 40-word comparative rationale and narrative requirements. |
| D-3 | Embedding model (Google official text embedding) | `gemini-embedding-001` | Google Cloud official embedding model, used for semantic recall channel only (no generative use) |
| D-4 | Default GWP version | AR6 | Latest IPCC assessment report; selectable per task (AR5/AR6), AR6 default |
| D-5 | Deployment region | Cloud Run `asia-southeast1` (Singapore); Firestore and Cloud Storage `asia-east2` (Hong Kong) | JAPAC region for the target users. The data services were provisioned in `asia-east2`; the resulting cross-region reads were removed from the hot path by the factor-library memoization in T-044 (see D-12). |
| D-6 | Frontend framework | React (Vite) SPA | Responsive single-page app required by PRD 8.1/9 |
| D-7 | Backend framework | Node.js (Express) | Runs on Cloud Run, shared language with unified model-call wrapper |
| D-8 | Task queue | In-service async queue abstraction, Cloud Tasks adapter for production (PRD 8.1 "Cloud Tasks or equivalent managed service") | Local/dev runs use the in-process queue; production uses Cloud Tasks via the same interface |
| D-9 | Storage | Firebase Storage (objects) + Firestore (structured data) | PRD 8.1 mandates |
| D-10 | Auth | Firebase Auth anonymous sign-in | PRD 3.2 / 10.3: judges must complete the flow with zero registration |
| D-11 | Vector index | In-process vector store (factor library ≤1,200 rows, PRD 8.1 allows in-process) | No extra paid services (PRD 8.2) |
| D-12 | Factor library access | Memoized per store (WeakMap), invalidated on write | A full list carries one 3072-dimension vector per factor; re-reading it per record was the dominant cost of the 20-document run (T-044) |
| D-13 | Document processing concurrency | Bounded worker pool, `PIPELINE_CONCURRENCY` default 4, results merged in document order | Documents are independent; this keeps the run inside the 3-minute budget while the report stays reproducible |
| D-14 | Generative serving path | Gemini API with a project-scoped key created in the deployment project (`myproject-dc19d`), injected as a runtime environment variable | The AI Studio default project hit its monthly spend cap (HTTP 429). The deployment project is billing-enabled and uncapped. Vertex AI is enabled as a documented alternative serving path (PRD M-2). |
| D-15 | Cloud Run CPU allocation | `--no-cpu-throttling` (CPU always allocated) | The pipeline runs after the HTTP response, so throttled CPU would stall it |

## Cloud environment inventory status (T-001 item 2)

Checked on this machine: gcloud CLI **not installed**, no `GOOGLE_APPLICATION_CREDENTIALS`,
no service-account JSON, no `gcloud` directory under user profile. Detailed evidence:
see `progress/evidence/T-001/cloud_inventory.md` and blocker report in
`progress/execution_log.md`.

Later, during T-043/T-044, the gcloud CLI was found at `/c/gcloud-sdk/google-cloud-sdk/bin`
(installed outside `PATH`) and used to deploy Cloud Run and read Cloud Logging. See the
T-043/T-044 entries in `progress/execution_log.md`.
