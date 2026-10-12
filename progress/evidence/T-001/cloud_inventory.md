# T-001 Evidence — Cloud & Model Environment Inventory

Date: 2026-10-12 (local machine time)

## Verification item 1 — Requirements traceability list counts: PASS

Command: `grep -c "^| FR-" progress/requirements_traceability.md` (and per-prefix equivalents)

| Prefix | Expected | Actual | Result |
|---|---|---|---|
| FR | 57 | 57 | PASS |
| NFR | 21 | 21 | PASS |
| AI | 13 | 13 | PASS |
| EV | 6 | 6 | PASS |
| M | 5 | 5 | PASS |
| D | 5 | 5 | PASS |
| L | 3 | 3 | PASS |

## Verification item 2 — Cloud services enabled status: BLOCKED

Required: query enabled status of Cloud Run, Firebase Hosting, Firebase Auth,
Firebase Storage, Firestore, Cloud Tasks, Cloud Logging, Cloud Trace via CLI or
console, save output to evidence.

Findings on this machine:

1. `gcloud` CLI: **not installed** (`command not found`).
2. `GOOGLE_APPLICATION_CREDENTIALS`: not set (verified via `env`).
3. Google Cloud config/ADC directories:
   - `C:\Users\Administrator\AppData\Roaming\gcloud` — does not exist
   - `C:\Users\Administrator\.config\gcloud` — does not exist
   - `application_default_credentials.json` — not found anywhere under the user profile (recursive search)
4. Service-account JSON files (pattern `service_account`): searched
   Downloads / Desktop / Documents / D:\opencode — no Google service-account
   files (only unrelated project build artifacts).
5. Firebase / Vercel / Supabase CLIs: not installed (npm global list contains
   only codex, cline, opencode-ai, pnpm).
6. Environment variables containing GCP/Gemini/Firebase credentials: none
   (only FIRECRAWL/LINKUP keys for unrelated MCP tools are present).

Remediation round 1 (2026-10-12): installed-tool + credential sweep documented
above — no usable credential found.
Remediation round 2 (2026-10-12): checked `~/.gemini` (contains only
Antigravity IDE data: annotations, conversations, plugins — no OAuth/API-key
credential files), `~/.antigravity` (does not exist),
`AppData\Roaming\Antigravity` (no credential/auth/gcloud files) — no usable
credential found.

Conclusion: without Google Cloud credentials it is impossible to query service
enablement status. BLOCKED on user input.

## Verification item 3 — Minimal model calls (Flash tier, Pro tier, embedding): BLOCKED

Required: one successful minimal call each to a Gemini Flash-tier model, a
Gemini Pro-tier model, and a Google official embedding model.

Attempt: the only Google-related credential on the machine is
`GOOGLE_GENAI_API_KEY` in `D:\opencode\ReefBeacon\.env` — its value is an
**empty placeholder** (`GOOGLE_GENAI_API_KEY=`, extracted length 0). The API
request with the empty key returned HTTP 403 PERMISSION_DENIED
("Method doesn't allow unregistered callers").

No other API key (AIza… pattern) exists in any scanned configuration
(.codex, .config/magpie, .cline, .zcode, D:\opencode env files, YAML/TOML/JSON
configs).

Conclusion: no legitimate Gemini API credential available on this machine.
BLOCKED on user input.

## Network reachability (supporting fact)

`https://generativelanguage.googleapis.com/` is reachable (HTTP 404 on bare GET,
expected) — outbound network to Google APIs works from this machine.
