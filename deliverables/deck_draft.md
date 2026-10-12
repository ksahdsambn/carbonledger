# CarbonLedger — Proposal Deck Draft (10–14 pages, English)

Export target: PDF, 10–14 pages. Track on the cover, verbatim value proposition.

## Page 1 — Cover
- Title: **CarbonLedger — Scope 3 Carbon Accounting and Disclosure Agent**
- Track: **Sustainability & Social Impact**
- Value proposition (verbatim): CarbonLedger compresses the cost of producing a Scope 3
  report from "RMB 30,000 + 3 weeks" to "1 hour + near-zero marginal cost", while making
  every single number traceable back to its source document.
- Team + hackathon branding.

## Page 2 — The problem
- SMEs face three barriers: evidence scattered across scans, photos and spreadsheets;
  factor selection is semantic reasoning ("air-freighting 1,200 kg of temperature-sensitive
  goods from Hong Kong to Tokyo" is not a string-match problem); consultant reports cost
  RMB 20,000–50,000 and are repeated every year.
- Numbers: manual compilation 2–3 weeks per report; hard for auditors to verify.

## Page 3 — The solution
- Upload mixed-format documents; the agent classifies, extracts, normalizes, matches
  public emission factors semantically, grades uncertainty, computes Scope 1/2/3, builds
  three reduction scenarios and generates a ten-chapter GHG-Protocol report.
- Every number carries a citation anchor that jumps back to the source document.

## Page 4 — Why Gen AI is the product (semantic factor matching)
- Three-stage pipeline: dual-channel recall (keyword + official embeddings, 5–15
  candidates, threshold relaxation) → Pro-model selection with a 40+ word comparative
  rationale and retained runner-up → rule-based uncertainty grading with unit-caliber
  self-checks.
- Remove the model and the system cannot run: rule engines cannot choose between
  boundary calibers; this is the core differentiator, not a wrapper.

## Page 5 — Anti-hallucination engineering
- Structured output on every call; closed enums validated and retried, never silently
  accepted; factor ids outside the candidate list are treated as failed calls.
- 100% citation coverage with anchor scanning; a single dangling reference vetoes the
  whole evaluation verdict.

## Page 6 — Pipeline and data
- Eleven-step journey from task creation to review closure; uncertainty routing to a
  human review queue; every AI call traced (latency, tokens, cost).
- 743 public factors (DEFRA 2026 + EPA 2025 + USEEIO) shipped offline; five industries.

## Page 7 — Architecture
- React SPA on Firebase Hosting; Node/Express on Cloud Run (scale-to-zero);
  Firebase Auth anonymous; Storage + Firestore; Cloud Tasks; Cloud Logging/Trace.
- Local adapters let the identical code run offline for tests and evaluation.

## Page 8 — Evaluation (results from the evaluation tool run)
- Insert the evaluation tool's final table: classification Top-1 ≥ 93%, extraction
  quantity/unit ≥ 98%, factor Top-1 ≥ 85%, Scope decisions ≥ 90%, calculation 100%,
  citations 100%, invalid references 0, P90 ≤ 3 min, cost ≤ $0.03/document.
- (Fill with the T-047 output before export.)

## Page 9 — Scenario intelligence
- S-1 mode shift, S-2 supplier swap, S-3 material substitution — auto-computed,
  hand-recomputable, adjustable ratio; zero-applicable scenarios stated honestly.

## Page 10 — Human-in-the-loop by design
- Review queue sorted by uncertainty; field edits and manual factor overrides are
  labelled and audited; exclusions require reasons and appear in the report.

## Page 11 — Impact
- Cost and time comparison table (consultant vs CarbonLedger); SMEs self-serve a
  previously outsourced compliance artifact; reusable every reporting period.

## Page 12 — Roadmap & team
- More industries via data-only factor additions (zero code change); supplier-specific
  factor intake; assurance-ready exports.

## Page 13 — Closing
- Track restated: Sustainability & Social Impact.
- Call to action + demo URL + repo link.
