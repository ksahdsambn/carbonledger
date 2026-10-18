# CarbonLedger Progress Summary (2026-10-14)

> **2026-10-14 Full Review and Fixes**: completed an eight-domain system review and fixes per `AUDIT_FIX_PROMPT.md`, with all 67 registered defects closed out (P0×4, P1×19, all P2 fixed). See `progress/FIX_REPORT_2026-10-14.md` (fix report), `progress/DEFECT_REGISTER_2026-10-14.md` (register), and `progress/ACCEPTANCE_RECORD_2026-10-14.md` (acceptance record). **Note**: this review raised the test count to 48 and shifted the line counts across the three metrics (final 4,544/7,708/9,503); the older figures in sections three and four below (tests 34, lines 4,132/6,976/8,771) are pre-review states, and this review's deliverables take precedence.
>
> **Second independent re-review after closeout**: falsified the first round's conclusion of "zero dangling entries"; newly found D-60 (failed documents cannot be retried, and reruns destroy existing records, P1), D-67 (reruns silently clear the ledger, P2), D-68 (verification script exit-code contract, P2), and 9 items in total, all closed out (see section eight of the fix report).

> In one sentence: **T-001 through T-051 are all executed; the evaluation tool passes the full suite 11/11 and is qualified overall, with 0 invalid references; the requirements traceability checklist shows FR 57/57, NFR 21/21, AI 13/13, all "Verified"; "G6 engineering portion passed" has been recorded.**
> Per-task records are in `progress/execution_log.md`, requirement status in `progress/requirements_traceability.md`, and the defect report in `progress/DEFECT_REPORT_T050.md`.

## I. Deliverables

- **Public URL: https://myproject-dc19d.web.app** (Firebase Hosting + Cloud Run asia-southeast1 + Firestore + Cloud Storage + Firebase Auth anonymous sign-in)
- Full judge workflow: automatic anonymous sign-in on entry → one-click loading of 20 documents → 20 records → ten-chapter report (citations 100% / 0 invalid) → PDF/CSV export
- English README, a 13-page English deck script, and a 3-minute English video script (including storyboard and subtitle draft)

## II. Gates

| Gate | Status |
|---|---|
| G0 Engineering baseline | ✅ Pass |
| G1 Data assets | ✅ Pass |
| G2 Field extraction and provenance | ✅ Pass |
| G3 Factor matching and computation | ✅ Pass |
| G4 Report and export | ✅ Pass |
| G5 Deployment readiness | ✅ Pass (evaluation tool 11/11 full suite online) |
| **G6 Engineering portion** | ✅ **Pass** (full PRD G6 additionally requires manually recording the video and exporting the deck PDF) |

## III. Defects fixed in this session (all driven by real-device evidence)

1. **The entire online workflow failed** → Root cause: the monthly spending cap of the AI Studio default project owning the Gemini Key was exhausted (HTTP 429). Fix: created a new Key restricted to `generativelanguage.googleapis.com` only in the deployment project (billing already linked) and injected it at runtime; the repository still holds zero keys.
2. **A single full workflow took 412s (target ≤180s)** → Root cause: two full factor lists per record (743 entries × 3072-dim vectors ≈18MB), and Firestore and Cloud Run were in different regions. Fix: factor library memoized per store (index build 5s→4ms) + bounded document concurrency (default 4, with results merged in document order to guarantee reproducibility). **412s → 61.3s**.
3. **Documents stuck permanently in a non-terminal state (19/20 hung)** → Root cause: `withStatus` did not mark `ERR_ENUM_INVALID` as failed, while model validation failures use the same code. Fix: mark failed on any processing failure; a single record failure no longer brings down the whole document; report narration failures fall back to a deterministic template.
4. **Report inconsistent with the ledger (T-050 acceptance A5 failure)** → Root cause: **report generation was not single-flight**; the lazy-generation path and the pipeline's own assembly ran concurrently, potentially producing a report from a half-written ledger (two reports for the same task, 29ms apart). Fix: one deterministic report document per task + in-flight task tracking, with `GET /report` first waiting for in-flight tasks. **After the fix, all 13/13 task reports are fully consistent with the ledger**.
5. **Anonymous authentication was not truly implemented** → Enabled the Anonymous provider; the frontend signs in anonymously on entry (session persistence + silent renewal); the backend uses firebase-admin to verify the ID token and uses its uid as the task owner, so client-supplied headers are no longer trusted (NFR-301 forged headers rejected).
6. **The single-model policy was not enforced at the code level** → Added `AI_MODEL_ALLOWLIST` (by default only `gemini-3.5-flash-lite` + `gemini-embedding-001`), validated before any real call; other models are rejected outright without issuing a request.

## IV. Key Measured Metrics

| Metric | Measured | Target |
|---|---|---|
| Classification Top-1 | 29/30 (96.7%) | ≥28/30 |
| Five-field extraction average | 100% (quantity/unit 100%) | ≥95% / ≥98% |
| Factor matching Top-1 / Top-3 | 34/40 (85%) / 39/40 (97.5%) | ≥34/40 / ≥38/40 |
| Boundary scope / category | 9/10 / 12/12 | ≥9/10 / ≥11/12 |
| Computation accuracy | 10/10 zero tolerance | 100% |
| Citation coverage / invalid | 100% / **0** | 100% / 0 |
| 20-document end-to-end P90 | **61.3s** | ≤180s |
| First screen (average of 5) | **76ms** | ≤3000ms |
| 3 concurrent | **3/3 completed with no errors** | 3/3 |
| AI cost per document | **$0.00058** | ≤$0.03 |
| Self-developed lines of code | Application 4,132 / with JS tooling 6,976 / with Python data toolchain 8,771 | ≤7,000 (hard cap 10,000) |
| Automated tests | **34/34 passed** | — |

## V. Cost (cap $3)

- Gemini API cumulative ≈ **$0.72** ($0.00058 per document; includes multiple rounds of online/local verification in this session)
- Google Cloud ≈ **$0.10** (Cloud Build build + Cloud Run run; service `minScale=0`, zero cost when idle)
- **Total ≈ $0.82, remaining budget about $2.18**
- Hard circuit-breaker recommendation: set a spend cap for the project at https://ai.studio/spend (a console operation, not performed on your behalf)

## VI. Manual Items (7 items, all listed with execution notes)

See `progress/evidence/T-050/acceptance.md`: 4 video acceptance items, the NFR-401 real-person 5-second usability test, the final English check of video subtitles, deck PDF export, and video upload.

## VII. Notes

- Chinese content exists only in `progress/` (internal working records, whose working language the README previously declared) and in a Chinese alias table used for data parsing (for parsing Chinese source documents, not output copy). All user-visible output is in English. (Working records were translated to English on 2026-10-18; the alias table is functional data and stays.)

---

## Second Full Review (2026-10-15)

- Based on the same audit brief, performed a full re-review of the three commits after the previous closeout (T-052/migration/China-specific removal): all R-01~R-33 fixes
  re-verified as still holding, newly registered D-101~D-106 (4 fixed + 1 retained + 1 documentation reconciliation), zero P0/P1 security regressions.
- Key fixes: D-101 sandboxing of the traversal regression tests (restored 48→49 all green), D-104 factor-library content fingerprinting + ghost-row
  cleanup (production data freshness), D-103 P6 slider error swallowing made visible, D-106 statistics output made truthful.
- Acceptance: A-1~A-7 and V-01~V-14 all green with evidence retained (`progress/evidence/audit2-2026-10-15/`,
  including 12 vision verification screenshots); README test count/line-count reconciliation 49 and 5,828/9,049/10,851.
- This round ran entirely on mock, with zero external API calls (cost $0; see FIX_REPORT_2026-10-15.md).
- **Pre-merge re-review (third round) and final closeout**: the code-reviewer re-review added D-107~D-111 (background-run
  error visibility, factor cache generation, traversal detection window, acceptance-script C4 fault tolerance, contaminated match protection + `_` prefix
  guard), suite 51/51; README reconciliation updated to **51 cases / 5,870 / 9,149 / 10,951**. Final
  HEAD `a56d9bc` re-verified A-1~A-7 all green, with all 12 items on the chapter-nine checklist ticked (see
  ACCEPTANCE_RECORD_2026-10-15.md, final closeout re-verification section), zero Gemini/Google Cloud costs.
- **Fourth-round re-verification (2026-10-16, HEAD `6809059`)**: fully re-ran
  B-1~B-8 / A-1~A-7 against the final closeout HEAD, all green (51/51, line counts 5,870/9,149/10,951 matching verbatim, 11/11 metrics,
  zero key hits, clean working tree); the 33 entries of the R-01~R-33 disposition table re-verified as closed, and spot checks confirmed the key fix points
  (owner guard / formula neutralization / filename sanitization / scenario isolation) in place, zero new defects. Fully mock,
  incremental cost $0. Task completion status confirmed (see ACCEPTANCE_RECORD_2026-10-15.md, fourth-round re-verification section).
- **Fifth-round independent re-review (2026-10-16, HEAD `1253890`)**: without referencing existing records, each of R-01~R-33
  was re-located at the source level with fix evidence (33/33 consistent with the register); V-02/V-03/V-09/V-11
  — four security-critical scenarios — were fully re-run on a local HTTP service with an injectable token validator (the 16-route × 3-identity
  privilege-escalation matrix exact, zero escapes in the sanitization of 5 malicious filenames, rate limiting / forged headers / CORS / malformed Origin all conforming,
  and correct error-code semantics across the five upload paths). Zero new defects, zero dangling entries, incremental cost $0. Task completion status
  finally confirmed (see ACCEPTANCE_RECORD_2026-10-15.md, fifth-round independent re-review section).

---

## Multilingual SEO Asset Completion (2026-10-18)

- Completed the full SEO surface for the production site: a complete head on the root page (title/description/canonical/robots/OG+Twitter/
  JSON-LD/favicon/manifest/theme-color), added 9 language landing pages (zh/ja/ko/de/fr/es/pt/ru/ar,
  with ar as RTL) forming a reciprocal hreflang cluster of 10 languages + x-default, one localized 1200×630 OG card per language,
  a full favicon set (SVG/ICO 16+32+48/PNG/apple-touch/192/512/maskable), and robots.txt plus a sitemap.xml containing
  hreflang.
- All assets are reproducibly generated by `scripts/seo/generate.js` from `scripts/seo/locales.json` (the 9-language translations produced by the translator subagent); `scripts/seo/verify.js` runs 150 assertions against the build output, all green
  (including bidirectional hreflang reciprocity, JSON-LD, image dimensions, and link integrity), and has been wired into `npm run build`.
- Verification chain: verify 150/150; local HTTP all routes 200; `npm test` regression 51/51; the vision subagent verified all
  10 OG cards + icons + zh/ar landing-page screenshots (and, based on its findings, fixed bidi reordering on the ar card: pure-Latin
  segments explicitly `dir="ltr"`).
- Line-count reconciliation: A 5,870 unchanged; B 9,909 / C 11,711 (+760 tool lines, continuing to use the NFR-504 exemption, README
  already synced). Zero API costs. Not deployed (see the execution_log entry for that day for the release command).

### Three-round Review Closeout (added the same day, 2026-10-18)

- Round 1 self-review fixed 4 items (escaping/sizes/probe-channel determination, etc.); rounds 2 and 3 were both independent code-reviewer
  re-reviews (round 2 concluded "no functional defects", round 3 "no P0/P1, ready to commit"). Cumulative further fixes:
  P1×1 (line-count reconciliation) + P2×4 (public file counting, inline-script deployment narrative, verify wired into the build gate,
  README "ships" tense) + P3×7 (JSON-LD `<` escaping, domain derived from SITE, hardened temporary-directory cleanup,
  verify guards against empty/malformed crashes, landing-page heading hierarchy and aria-hidden, landing-page manifest links).
- Final-state verification: SEO acceptance built into `npm run build` **150/150**; `npm test` **51/51**; line counts
  A 5,870 / B 9,909 / C 11,711 (+760). The parallel deck working files (deliverables/** and
  acceptance.md changes) were not included in this round's commit.

---

## Repository internationalization (2026-10-18, second round)

- GitHub metadata refreshed in English (description, homepage, 12 topics); README
  gained the OG promo banner and now documents the English-only state; social
  preview asset identified for manual upload (`frontend/public/og/og-en.png`).
- All 16 Chinese Markdown documents (~440 KB) translated to English by translator
  subagents (chunked, entity-normalized, identifiers preserved); C4 waiver marker
  made dual-language before translation; figure C resynced to 12,365 for the
  parallel deck commit.
- Remaining Chinese is functional only (currency aliases, CJK-detection regexes,
  fixtures, zh landing page/locale data, one verbatim evidence snapshot).
- Gates: build+SEO 150/150, tests 51/51, line counts unchanged, secrets 0.
