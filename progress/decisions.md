# Decision Record — CarbonLedger

Engineering decisions required by T-001. All model ids are centralized later in
the config file created in T-002 (backend config module); this record is the
authoritative source for the initial values.

| # | Decision area | Value | Rationale |
|---|---|---|---|
| D-1 | Extraction/classification model (Gemini Flash tier) | `gemini-2.5-flash` | High volume, highly structured tasks (PRD 6.1 assigns Flash tier to classification + extraction) |
| D-2 | Reasoning/selection/report model (Gemini Pro tier) | `gemini-2.5-pro` | Factor selection rationale and report generation need deep semantic reasoning (PRD 6.1 assigns Pro tier) |
| D-3 | Embedding model (Google official text embedding) | `gemini-embedding-001` | Google Cloud official embedding model, used for semantic recall channel only (no generative use) |
| D-4 | Default GWP version | AR6 | Latest IPCC assessment report; selectable per task (AR5/AR6), AR6 default |
| D-5 | Deployment region (Cloud Run / Firebase) | `asia-east2` (Hong Kong) | JAPAC region, low latency for target users; Firebase resources created in the same region where possible |
| D-6 | Frontend framework | React (Vite) SPA | Responsive single-page app required by PRD 8.1/9 |
| D-7 | Backend framework | Node.js (Express) | Runs on Cloud Run, shared language with unified model-call wrapper |
| D-8 | Task queue | In-service async queue abstraction, Cloud Tasks adapter for production (PRD 8.1 "Cloud Tasks or equivalent managed service") | Local/dev runs use the in-process queue; production uses Cloud Tasks via the same interface |
| D-9 | Storage | Firebase Storage (objects) + Firestore (structured data) | PRD 8.1 mandates |
| D-10 | Auth | Firebase Auth anonymous sign-in | PRD 3.2 / 10.3: judges must complete the flow with zero registration |
| D-11 | Vector index | In-process vector store (factor library ≤1,200 rows, PRD 8.1 allows in-process) | No extra paid services (PRD 8.2) |

## Cloud environment inventory status (T-001 item 2)

Checked on this machine: gcloud CLI **not installed**, no `GOOGLE_APPLICATION_CREDENTIALS`,
no service-account JSON, no `gcloud` directory under user profile. Detailed evidence:
see `progress/evidence/T-001/cloud_inventory.md` and blocker report in
`progress/execution_log.md`.
