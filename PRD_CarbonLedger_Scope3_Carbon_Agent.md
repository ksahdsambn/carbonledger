# Requirements Specification: CarbonLedger — Scope 3 Carbon Accounting and Disclosure Agent

| Item Metadata | Content |
|---|---|
| Document Version | v1.2 (2026-10-12) |
| Project Name | CarbonLedger · Scope 3 Carbon Accounting and Disclosure Agent |
| Competition Track | Sustainability & Social Impact |
| Target Event | AI Builder Cup 2026 (Google Cloud JAPAC Hackathon) |
| Delivery Deadline | 2026-10-18 23:59 (time zone specified on the official event website) |
| Eligibility | Teams of 2 to 4 people; aged 21 or above; JAPAC region; working professionals only, students may not enter |
| Recommended Team Size | 2 to 4 people |
| In-House Code Size Constraint | 4,000 to 7,000 lines, with a hard upper limit of 10,000 lines |
| Intended Audience | AI developers or engineering teams executing the development tasks |
| Document Status | Sole authoritative source of requirements; in the event of conflict with any technical decision, this document prevails |

---

## 0. Reading Instructions

### 0.1 How to Use This Document

This document is a complete task specification for the party executing the development. Developers should be able to independently complete all development, deployment, evaluation, and delivery work based on this document without asking any supplementary questions.

This document contains no code implementation whatsoever. All technical conventions are expressed in natural language, parameter tables, field tables, and process steps. Developers have discretion at the implementation level, but must satisfy all constraints and acceptance thresholds specified herein, and must pass all acceptance gates defined in Chapter 10 of this document.

If internal contradictions or non-executable provisions are discovered in this document during execution, progress must be stopped immediately and the matter reported to the requirements owner; developers must not guess at a resolution on their own.

### 0.2 Glossary

| Term | Exact Meaning in This Project |
|---|---|
| GHG Protocol | Greenhouse Gas Protocol, the sole standard followed for this project's accounting and reporting structure |
| Scope 1 | Direct emissions from emission sources owned or controlled by the reporting entity |
| Scope 2 | Indirect emissions from purchased electricity, steam, heating, or cooling consumed by the reporting entity |
| Scope 3 | All other indirect emissions occurring in the value chain, 15 categories in total |
| Activity data | Quantified data extracted from documents that is used to multiply emission factors |
| Emission factor | Greenhouse gas emissions corresponding to one unit of activity data |
| Factor matching | The process of mapping one activity data record to the most suitable emission factor; this project's core AI capability |
| cradle-to-gate | Factor boundary type, from raw material extraction to factory gate |
| well-to-tank / tank-to-wheel | Fuel factor boundaries; the former includes upstream production and transport, the latter covers combustion only |
| GWP | Global Warming Potential, the coefficient used to convert non-carbon-dioxide greenhouse gases into carbon dioxide equivalent |
| AR5 / AR6 | GWP value versions published in the IPCC Fifth or Sixth Assessment Report; one of the two is selected when a task is created and applies to the entire task; where an individual record can only be matched with a factor across versions, it is explicitly annotated and disclosed in accordance with Section 4.5 |
| Uncertainty level | A custom three-tier evaluation system defined by this project: high, medium, low |
| Review Queue | Manual review queue for low-confidence or anomalous records |
| Golden Case | A test case set constructed in advance with known correct answers |
| Citation anchor | A citation marker attached to numerical conclusions in reports that can be clicked to jump to the source document or factor entry |
| Audit trail | Verifiable operation records left by the system for each key action (conversion, matching, calculation, review, etc.) |

### 0.3 Scope Boundaries

**In Scope**

1. Upload, parsing, classification, and structured extraction of multi-format documents
2. Normalization, unit conversion, and gap identification of activity data
3. Semantic factor matching based on public emission factor libraries
4. Emission calculation and aggregation for Scope 1, Scope 2, and Scope 3
5. Automatic construction and comparative calculation of at least three emission reduction scenarios
6. Generation of English emission reports conforming to the GHG Protocol structure, with PDF and CSV export
7. Generation and disclosure of uncertainty statements
8. Full-chain traceability of each calculation result back to the original documents
9. Manual review queue and review closure loop
10. Automated evaluation suite and acceptance execution

**Explicitly Out of Scope; Investing Time Is Strictly Prohibited**

1. Payment, subscription, or multi-tenant billing systems (anonymous or email login via Firebase Auth is sufficient)
2. Carbon credit trading, carbon neutrality certification, carbon asset financialization
3. Real-time data streams or direct IoT device connectivity
4. Native mobile applications (responsive Web application only)
5. Interfaces in languages other than English (product UI, reports, and documentation must all be in English)
6. Third-party review processes for self-built emission factors
7. Blockchain, NFT, or points incentive modules

---

## 1. Project Background and Objectives

### 1.1 Problem Statement

SMEs face three obstacles when preparing Scope 3 emission reports.

First, data is scattered and unstructured. Emission evidence is scattered across paper invoices, scanned photographs, supplier spreadsheets, logistics waybills, and utility bills in mutually incompatible formats; manually compiling one mid-sized enterprise report takes 2 to 3 weeks.

Second, factor selection requires professional expertise. For the same transport activity — "air freight of 1,200 kg of temperature-controlled cargo from Long Beach to Tokyo" — which factor should be applied depends on transport mode granularity, cargo temperature-control status, leg distance conventions, and factor boundary definitions. This is not a string matching problem but a semantic reasoning problem; rule engines can never achieve complete coverage.

Third, external consulting costs are high. A compliant Scope 3 report outsourcing quote typically ranges from US$20,000 to US$50,000, and the fee is paid again the following year when the report is updated.

### 1.2 Target Users

| Role | Description | Core Need |
|---|---|---|
| Primary user: SME ESG specialist | A specialist responsible for sustainability reporting within a manufacturing or trading company, usually holding multiple roles with no professional carbon accounting background | Produce a credible, disclosable, and traceable report from scratch within hours |
| Secondary user: sustainability consultant | An external consultant serving multiple clients | Rapidly complete preliminary accounting and concentrate effort on high-value emission reduction strategies |
| Evaluation-scenario user: event judges | Google Cloud and industry experts | Understand the product, verify authenticity, and assess the depth of Gen AI within 3 minutes |

### 1.3 Value Proposition

The external statement must be used verbatim on the first slide of the deck and at the beginning of the video:

> CarbonLedger compresses the cost of preparing one Scope 3 report from "US$30,000 + 3 weeks" to "1 hour + near-zero marginal cost", while making every number clickable and traceable back to the original documents.

### 1.4 North Star Metrics

| Metric | Target Value | Measurement Method |
|---|---|---|
| End-to-end processing time | No more than 3 minutes for 20 mixed-format documents | P90 of 10 runs |
| AI processing cost per document | Not higher than US$0.03 | Token usage accumulated at public unit prices |
| Factor matching Top-1 accuracy | Not lower than 85% | Golden Case automatic comparison |
| Key field extraction accuracy | Average of quantity, unit, amount, date, and currency not lower than 95%, with quantity and unit not lower than 98% | Golden Case automatic comparison |
| Report citation coverage | 100% | Parser scans citation anchors |
| Traceability hallucination rate | 0 occurrences of citations pointing to non-existent objects | Evaluation suite verifies citation validity |

---

## 2. Event Compliance Requirements (Mandatory, Item-by-Item Verification)

The following clauses are taken directly from the official Themes page and homepage rules of the event; all are hard requirements.

### 2.1 Technology Stack Compliance

| No. | Requirement | Implementation Approach in This Project | Acceptance Method |
|---|---|---|---|
| M-1 | Must use Gemini or Gemma series models | All generative AI capabilities are provided by Gemini series models; semantic vector recall uses the official Google Cloud embedding model | Global search confirms no third-party model dependencies |
| M-2 | Or use an agent platform such as Agent Platform, Antigravity, or AI Studio | Alternate compliance path; if adopted, it must be stated explicitly in the documentation | README explanation |
| M-3 | Must be deployed on Google Cloud, using Cloud Run or Firebase | Backend deployed on Cloud Run, frontend hosted on Firebase Hosting, data and files stored in Firestore and Firebase Storage respectively | Provide a publicly accessible URL |
| M-4 | Demonstrate deep use of the Google Cloud AI toolchain | Use model structured output capabilities, batch inference channels, and Cloud Run automatic scaling | Explanation in README and deck |
| M-5 | The prototype must be an actually runnable functional implementation; the event explicitly does not accept presentations-only or static prototypes | Deliver a publicly accessible Web application where judges can upload documents themselves and run the full workflow | A judge account can independently complete one full accounting cycle in an anonymous state |

### 2.2 Deliverable Compliance

| No. | Requirement | This Project's Output |
|---|---|---|
| D-1 | English proposal PDF | 10- to 14-page English deck exported to PDF |
| D-2 | Runnable functional prototype | Publicly accessible Web application where judges can upload documents for testing |
| D-3 | 3-minute demo video with a public YouTube, Vimeo, or public Google Drive link | English voiceover and English subtitles |
| D-4 | Complete engineering documentation | English README, including architecture description, deployment steps, and evaluation results |
| D-5 | Clearly indicate the track entered; the event requires the problem statement being addressed to be declared upon submission | Unified English full name marked in three places — deck first slide, README hero section, and video end card: Sustainability & Social Impact |

### 2.3 Language Compliance

| No. | Requirement |
|---|---|
| L-1 | All submission materials must be in English, including code comments, README, deck, video voiceover and subtitles, and product UI copy. This document is a Chinese-language internal working document |
| L-2 | Product UI copy is in English; descriptions in this document serve illustrative purposes only |
| L-3 | The user-visible report body generated by the system is in English |

### 2.4 Mapping to Judging Weights

The event judging is weighted across four dimensions, each containing specific scoring sub-items. Developers must prepare directly inspectable evidence for every sub-item, rather than only preparing an overall demo.

| Judging Dimension and Sub-item | Weight | Corresponding Evidence in This Project |
|---|---|---|
| Technology: meaningfulness of Gen AI use | Main item within 40% | Semantic factor matching engine whose output directly affects the correctness of accounting results; removing the model degrades the system into an inoperable empty shell |
| Technology: completeness of technical implementation | Main item within 40% | Three-stage pipeline, dual-channel recall, unit convention self-check, failure retry and degradation, complete audit trail |
| Technology: scalability and sustainability | Main item within 40% | Decoupling of factor library and code, centralized model configuration, zero code changes to add new factors, repeatable evaluation suite |
| Fit: problem alignment | Main item within 25% | Directly solves the SME Scope 3 preparation problem that surveys cannot even cover, strictly following the GHG Protocol structure |
| Fit: potential impact | Main item within 25% | Quantified comparison of cost and time; outputs can be used directly by external enterprises rather than for demo purposes |
| Innovation: originality and differentiation | Main item within 25% | Factor matching paradigm that replaces rule mapping with semantic reasoning; automatic uncertainty grading and disclosure |
| Innovation: innovativeness of Gen AI application | Main item within 25% | Having the model explain why the runner-up candidate was not chosen; explicitly degrading uncertain areas instead of forcing a calculation |
| Experience: usability and accessibility | Main item within 10% | Main interaction understood in 5 seconds, main workflow completable with keyboard only, levels not conveyed by color alone |
| Experience: overall experience and integration | Main item within 10% | Extraction, matching, calculation, scenario, report, and review — six components with fully synchronized data and state |

Weight total verification: Technology dimension 40%, Fit dimension 25%, Innovation dimension 25%, Experience dimension 10%, totaling 100%. Notations such as "main item within 40%" indicate that the row is a main scoring sub-item under the corresponding dimension; specific sub-item scores are determined by the event judging.

---

## 3. Core User Journey

### 3.1 Main Workflow Steps

**Step 1, create an accounting task.** The user fills in three pieces of information: the name of the reporting entity, the time period covered, and the GWP version used for accounting (AR5 or AR6, choose one). The system generates a unique task identifier.

**Step 2, upload documents.** The user drags or selects files to upload any number of documents at once. Supported formats: PDF (including image-only scanned PDF), JPG, PNG, XLSX, CSV. Recommended 5 to 20 files per batch. The system performs format validation, page count statistics, and content hash deduplication for each file.

**Step 3, batch parsing and classification.** Each file first has its document type determined; the type value is restricted to one of seven categories: supplier invoice, purchase order, logistics waybill, utility bill, travel reimbursement voucher, packing list, other. Multi-page PDFs are judged page by page, and one file may contain multiple types. Records with classification confidence below 0.7 go to manual confirmation.

**Step 4, activity data extraction.** Each document can produce zero, one, or multiple activity records, each accompanied by per-field confidence.

**Step 5, normalization and gap identification.** Perform unit conversion, currency identification, date standardization, and administrative-region normalization of transport origins and destinations. For fields required for calculation that are missing, explicitly list the gaps and prompt the user to supply them.

**Step 6, boundary determination.** Determine whether each record belongs to Scope 1, Scope 2, or Scope 3; if it belongs to Scope 3, it must be refined to one of the 15 categories, and the interface displays both the number and the name.

**Step 7, semantic matching of emission factors.** The system retrieves candidate factors for each record, after which the reasoning model selects the best one and provides a rationale, confidence, and key semantic features.

**Step 8, calculation and aggregation.** Calculate using a unified formula, and aggregate across four dimensions: Scope, category, supplier, and month.

**Step 9, scenario analysis.** Automatically construct three emission reduction scenarios, with user-adjustable parameters.

**Step 10, report generation and export.** Generate the English report and export PDF and CSV.

**Step 11, review closure loop.** The user corrects fields or re-specifies factors in the review queue; after correction, recalculation must occur immediately and the report and all charts must be refreshed synchronously.

### 3.2 Exception Branches

| Branch Scenario | Behavior the System Must Have |
|---|---|
| Unsupported format uploaded | Reject the file with an English message, without affecting other files |
| Blurry document or low scan quality | Confidence naturally decreases; the record enters the review queue; silent discarding is strictly prohibited |
| Required calculation field missing | Flag the missing item; count it as "excluded from accounting" in the report and explain the reason |
| All candidate factor confidences below the configured confidence threshold (default 0.65, adjustable via environment variable) | Flag as "no high-confidence factor"; the interface may suggest the highest-valued candidate as a conservative reference, but it must be manually confirmed before adoption, and the record is forced into the review queue |
| Same document uploaded twice | Automatically identify and prompt; the user decides whether to keep it |

---

## 4. Functional Requirements Specification

All functional requirements in this chapter are mandatory: no MVP, no phasing, and no priority-based trimming. All must be implemented and pass their respective acceptance criteria at delivery; failure to implement or pass acceptance for any single item constitutes delivery failure.

### 4.1 File Intake Module

| No. | Requirement | Acceptance Criterion |
|---|---|---|
| FR-101 | Support upload of five formats: PDF, JPG, PNG, XLSX, CSV | One sample of each of the five formats is all successfully parsed and stored |
| FR-102 | Support drag-and-drop multi-file upload in one action, displaying each file's status in real time (queued, parsing, extracting, matching, completed, needs review, failed) | Upload 20 files simultaneously; all statuses advance correctly with no freezing |
| FR-103 | Split multi-page PDFs page by page and determine type per page | A 4-page PDF containing 3 document types is correctly split with all types correct |
| FR-104 | Deduplication detection based on file content hash | Uploading the same file twice triggers a deduplication prompt |
| FR-105 | Single file limit of 10 MB; give a clear English message when exceeded | An 11 MB file is rejected with a message |
| FR-106 | Original files persistently stored and openable for viewing at any time throughout the workflow | Any calculation result can jump to view the corresponding region of the original file |

### 4.2 Document Classification Module

| No. | Requirement | Acceptance Criterion |
|---|---|---|
| FR-201 | Determine each page unit as one of seven document types and output confidence | Classification accuracy of 30 Golden documents not lower than 93% (at least 28 correct) |
| FR-202 | Type must be a closed enumeration set; models are prohibited from freely generating category names | Repeated calls on the Golden set totaling at least 200 times, with no values outside the set |
| FR-203 | Classification confidence below 0.7 automatically goes to manual confirmation | 3 constructed blurry documents all enter the confirmation step |

### 4.3 Activity Data Extraction Module

The structure of extraction results is strictly defined by the table below; each activity record must contain these fields and only these fields.

**Activity Record Field Table**

| Field Name | Type | Required | Values or Constraints | Description |
|---|---|---|---|---|
| record_id | string | Yes | System-generated unique identifier | Primary key for full-chain traceability |
| source_ref | string | Yes | Foreign key pointing to the source unit | Must be resolvable to a file that actually exists and its internal location (page, worksheet, or data row) |
| doc_type | enum | Yes | One of the seven types | Inherits the classification result |
| supplier_name | string | No | Free text | Supplier name |
| item_description | string | Yes | Free text | Natural language description of the purchased item; the primary basis for factor matching |
| quantity | number | Conditionally required | Greater than 0 | Required for records participating in calculation; appears in pair with unit |
| unit | enum | Conditionally required | See unit reference table | Required for records participating in calculation; appears in pair with quantity |
| amount | number | No | Greater than or equal to 0 | Amount |
| currency | enum | No | One of USD, EUR, GBP, CAD, JPY | Currency |
| activity_date | date | Yes | ISO 8601 format | Date the activity occurred |
| origin_location | string | Conditionally required | Free text | Required for transport activities |
| destination_location | string | Conditionally required | Free text | Required for transport activities |
| transport_mode | enum | Conditionally required | See transport mode table | Transport mode; required for transport activities |
| gross_weight_kg | number | No | Greater than 0 | Gross weight, unified to kilograms |
| distance_km | number | No | Greater than or equal to 0 | Distance, unified to kilometers |
| field_confidence | map of field to confidence | Yes | Each value between 0 and 1 | Per-field confidence |
| extraction_notes | string | No | Free text | Extraction anomaly notes |

| No. | Requirement | Acceptance Criterion |
|---|---|---|
| FR-301 | Extract per the field table; leave missing fields explicitly empty rather than guessing to fill them | Construct 5 documents with missing fields; the system must not fabricate values |
| FR-302 | Convert all units to reference units | All 10 conversion relations in the conversion reference table are correct |
| FR-303 | Each extracted field is accompanied by confidence between 0 and 1 | Spot-check 20 records with complete confidence values |
| FR-304 | A single document can produce multiple activity records | An invoice with three line items produces 3 records |
| FR-305 | Extraction results are traceable to the source file region and highlighted when viewed | A highlight box appears in the source file view after clicking |
| FR-306 | Handwritten or low-quality scans must still be attempted for extraction; they must not be directly judged as failure | At least 2 of 3 handwritten annotated documents produce valid records (valid means required fields, at minimum quantity and unit, are non-empty) |

### 4.4 Unit and Normalization Specification

**Unit Reference Conversion Table (all must be implemented)**

| Category | Supported Original Units | Target Reference Unit | Conversion Relation |
|---|---|---|---|
| Mass | kilogram, ton, pound, gram | kilogram | 1 ton = 1000 kilograms; 1 pound ≈ 0.4536 kilograms; 1 gram = 0.001 kilograms |
| Energy | kilowatt-hour, megawatt-hour, gigajoule, British thermal unit | kilowatt-hour | 1 megawatt-hour = 1000 kilowatt-hours; 1 gigajoule ≈ 277.78 kilowatt-hours; 1 British thermal unit ≈ 0.000293 kilowatt-hours |
| Volume | liter, cubic meter, US gallon | liter | 1 cubic meter = 1000 liters; 1 US gallon ≈ 3.785 liters |
| Distance | kilometer, mile, nautical mile | kilometer | 1 mile ≈ 1.609 kilometers; 1 nautical mile ≈ 1.852 kilometers |
| Currency | USD, EUR, GBP, CAD, JPY | Original currency with annotation | This project performs no exchange rate conversion; correct identification and annotation only |

**Transport Mode Enumeration Table (closed set)**

Road freight, rail transport, sea freight (containerized), sea freight (bulk), air freight (general cargo), air freight (cold chain), international express, inland waterway shipping, pipeline transport, not applicable.

| No. | Requirement | Acceptance Criterion |
|---|---|---|
| FR-401 | Implement all conversions; write the conversion process to the audit trail | All 10 conversions in the conversion reference table pass |
| FR-402 | Normalize origins and destinations to a two-level structure of country/region plus city | "new york city" and "New York" normalize to the same result |
| FR-403 | Transport mode must fall within the closed enumeration | Repeated calls on records containing transport information totaling at least 100 times, with no values outside the set |

### 4.5 Boundary Determination Module

**List of the 15 Scope 3 Categories (closed enumeration; must be listed in full and implemented)**

| Category No. | English Name | Chinese Name |
|---|---|---|
| Cat-1 | Purchased goods and services | Purchased goods and services |
| Cat-2 | Capital goods | Capital goods |
| Cat-3 | Fuel- and energy-related activities | Fuel- and energy-related activities |
| Cat-4 | Upstream transportation and distribution | Upstream transportation and distribution |
| Cat-5 | Waste generated in operations | Waste generated in operations |
| Cat-6 | Business travel | Business travel |
| Cat-7 | Employee commuting | Employee commuting |
| Cat-8 | Upstream leased assets | Upstream leased assets |
| Cat-9 | Downstream transportation and distribution | Downstream transportation and distribution |
| Cat-10 | Processing of sold products | Processing of sold products |
| Cat-11 | Use of sold products | Use of sold products |
| Cat-12 | End-of-life treatment of sold products | End-of-life treatment of sold products |
| Cat-13 | Downstream leased assets | Downstream leased assets |
| Cat-14 | Franchises | Franchises |
| Cat-15 | Investments | Investments |

The interface must display both the category number and the English name. Determination output must not use values outside the 15 categories above.

**GWP Version Handling Rules (must be implemented)**

The user selects the GWP version (AR5 or AR6) when creating a task, and that selection applies to the entire workflow. During factor matching, factors whose GWP version matches the task setting are recalled preferentially; if an activity record has only a corresponding factor of the other version in the factor library, three requirements must be met simultaneously: explicitly annotate the version mismatch on the interface, downgrade the record's uncertainty level to at least Medium (Low may not be retained), and statistically disclose the count and proportion of such records in the methodology section of the report. Mixing factors across versions without explanation in both the report and the interface is strictly prohibited.

| No. | Requirement | Acceptance Criterion |
|---|---|---|
| FR-501 | Determine whether each record belongs to Scope 1, Scope 2, or Scope 3 | Scope-level determination accuracy of 10 Golden records not lower than 90% (at least 9 correct), on the same basis as the metrics in Section 10.1 |
| FR-502 | Scope 3 must be refined to one of the 15 categories, outputting both number and name | Accuracy of 12 Scope 3 Golden records not lower than 90% (at least 11 correct) |
| FR-503 | Determination must output a rationale in English | Every determination has a non-empty English rationale |
| FR-504 | Highly duplicate records within the same file are marked as suspected duplicates | Constructed duplicate records are correctly marked |

### 4.6 Emission Factor Library

| No. | Requirement | Acceptance Criterion |
|---|---|---|
| FR-601 | Build a local factor library from public sources. Recommended sources: the UK government's annual GHG conversion factors report, the US EPA Emission Factors Center, and publicly available industry average factor sets | README clearly lists the names, version years, and public links of the data sources actually used |
| FR-602 | Cover 5 industries: electronics manufacturing, apparel and textiles, food processing, logistics and transport, general office services | At least 40 entries per industry, with a total not exceeding 1,200 entries |
| FR-603 | Each factor must include the attributes: factor ID, factor name, natural language description, applicable activity type, emission unit, activity data unit, value, greenhouse gas coverage scope, system boundary type, GWP version, data year, source name, original source location | 100% attribute completeness on a spot check of 50 entries |
| FR-604 | The factor library supports both keyword search and semantic vector search recall channels | The two channels can be independently disabled for controlled experiments |
| FR-605 | The factor library is delivered as an independent data file alongside the code repository and must not rely on runtime web scraping | Matching can still be completed in an offline environment |
| FR-606 | Factors must be annotated with data year; the report discloses the year distribution | The report appendix contains a factor year statistics table |

### 4.7 Semantic Factor Matching Module (Core Capability)

This module is the technical high ground and must be implemented strictly as a three-stage pipeline.

**Stage 1, candidate recall.** For each activity record, recall is performed via the two channels separately. The first is keyword and structured field matching; the second is semantic vector similarity search. After merging and deduplicating the two paths, the candidate count is controlled between 5 and 15. When there are fewer than 5 candidates, the recall threshold is automatically relaxed and the recall retried; the retry process is logged; if still fewer than 5 after retry, the actual number proceeds to the next stage, and the record is marked "insufficient recall". When there are more than 15 candidates, they are truncated by relevance.

**Stage 2, reasoning-based selection.** The structured activity description and the candidate factor list are handed to the reasoning model, which is required to select the single best one and output five items:

| Output Item | Type | Constraint |
|---|---|---|
| selected_factor_id | string | Must exist in the candidate list; fabricating values is strictly prohibited |
| confidence | number | Between 0 and 1 |
| rationale | string | In English, no fewer than 40 words, explaining the specific reasons for choosing this factor over the runner-up candidate |
| key_semantic_features | string array | Lists 2 to 4 key semantic features |
| runner_up_id | string | Runner-up candidate ID; may be empty |

**Stage 3, uncertainty grading.** Based on matching confidence, field completeness, and factor boundary fit, a level is assigned to each result:

| Level | Determination Condition | Interface Presentation |
|---|---|---|
| Low | Confidence not lower than 0.85, and all required fields extracted directly from the document | Green marker |
| Medium | Confidence not lower than 0.65 and below 0.85, or 1 inferred required field exists | Amber marker |
| High | Confidence below 0.65, or 2 or more inferred fields exist, or the unit convention requires secondary conversion | Red marker and forced entry into the review queue |

Grading is applied in descending order of severity: first check whether any condition for the "High" tier is met, then check "Medium"; only if neither is met is the record "Low". When a single record triggers conditions at multiple tiers, the most severe tier applies.

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-701 | Implement the three-stage pipeline | End-to-end matching of a single record takes no more than 8 seconds |
| FR-702 | The selected factor ID must exist in the candidate list | 100% reference validity across the full Golden set, with zero invalid references |
| FR-703 | Output a written rationale in English that explains why the runner-up candidate was not selected | A spot check of 20 rationales shows all are non-empty and contain comparative statements |
| FR-704 | Statistically disclose the three-tier uncertainty distribution in the report | The report contains a three-tier proportion table |
| FR-705 | Record the runner-up candidate to support manual re-selection | The UI allows manual re-selection and triggers recalculation |
| FR-706 | Support one-click batch recalculation | Aggregations and charts refresh synchronously after triggering |

### 4.8 Calculation and Aggregation Module

**Calculation conventions**: The emission of a single record equals the normalized activity data multiplied by the selected factor value. If the greenhouse gas coverage of the factor is not limited to carbon dioxide alone, it must be explicitly stated whether GWP conversion is already included; if it is not, the corresponding GWP factor for each gas must be applied separately, and this process must be recorded in the audit trail.

**Precision and rounding rules (strictly enforced)**

Intermediate calculations must preserve full floating-point precision and must not be rounded mid-way. All aggregate values must first be summed from unrounded detail values, and rounding is then applied once to the result; rounding detail values before summing them is strictly prohibited. The presentation layer uniformly converts values to tonnes of CO2 equivalent with three decimal places, using round-half-up. During acceptance, a relative floating-point error within 1e-6 is tolerated, but in the presentation layer the sum of all line items and the total must be exactly consistent under the three-decimal-place convention, with no discrepancy visible to the naked eye.

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-801 | Calculations use kg CO2e uniformly; the presentation layer automatically converts to tonnes with three decimal places | All 10 known-answer calculation problems are correct |
| FR-802 | Support aggregation across four dimensions: Scope, category, supplier, and month | Aggregated values in each dimension are consistent with the total |
| FR-803 | The Top emission sources ranking defaults to Top 10, sorted by emissions in descending order | The ordering is consistent with the detail records |
| FR-804 | Every unit conversion, GWP conversion, and multiplication must be written to the audit trail and viewable in the UI | The complete calculation steps can be expanded for any record |
| FR-805 | The total must equal the sum of all line items, exactly consistent in the presentation layer under the three-decimal-place convention | Validated against the rounding rules above; no display page shows an inconsistency between totals and line items |

### 4.9 Scenario Analysis Module

| Scenario ID | Scenario Name | Modeling Approach | Required Outputs |
|---|---|---|---|
| S-1 | Transport mode substitution | Replace air freight (general cargo, cold chain) activities with sea freight (container) factors and road freight activities with rail transport factors, then re-run matching and calculation; other transport modes are unaffected | Absolute emission reduction, percentage, list of affected records, qualitative notes |
| S-2 | Supplier substitution | Recalculate all activity records of the three highest-emitting suppliers using the lowest-value factor within the same activity category in the factor library | Same as above |
| S-3 | Material substitution | Recalculate high-emission raw material purchase records using low-carbon alternative material factors available in the factor library; records without an available alternative factor remain unchanged and are noted individually in the results | Same as above |

If the current task contains no activity records to which a scenario applies, that scenario is handled as having zero affected records; the UI and report display this faithfully and explain the reason, without raising errors and without hiding the scenario.

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-901 | All three scenarios are computed automatically, with no user input required | After the main flow completes, the scenario page directly displays three results |
| FR-902 | Output absolute emission reduction and percentage, compared with the baseline on the same screen | Values are consistent with the detail records and percentages are correct |
| FR-903 | Each scenario is accompanied by a feasibility analysis of at least 80 English words stating the assumptions and limitations | All three scenarios are non-empty and explicitly mention assumptions |
| FR-904 | Support adjusting the substitution ratio parameter | Refreshes in real time after adjustment without errors |

### 4.10 Report Generation and Export Module

**Report structure (follow this section order strictly)**

1. Cover page: entity name, coverage period, generation date, GWP version statement, track attribution statement
2. Executive summary: total emissions, breakdown across the three Scopes, Top emission sources, three core recommendations
3. Accounting methodology and boundaries: standards followed, organizational boundary, operational boundary, factor year distribution
4. Emission breakdown: Scope summary table, Scope 3 category breakdown table, supplier Top ranking
5. Activity data detail table
6. Uncertainty statement: three-tier distribution, main uncertainty sources, data quality improvement recommendations
7. Emission reduction scenario recommendations: comparison of the three scenarios and implementation recommendations
8. Appendix 1: list of emission factors used (ID, name, value, unit, year, source)
9. Appendix 2: reference traceability index (each data point mapped to its source document ID or factor ID)
10. Disclaimer

**Specific content that must be included in each section (any omission renders the report non-compliant)**

| Section | Required Content Items |
|---|---|
| 1. Cover | Report entity name, coverage period start and end, generation date, GWP version statement, track attribution statement, disclaimer index |
| 2. Executive summary | Total emission value and unit, value and share of each of the three Scopes, names and values of the Top 3 emission sources, three core recommendations each of at least 30 English words |
| 3. Accounting methodology and boundaries | Name of the standards followed, organizational boundary description, operational boundary description, GWP version and source, count and share of records using factors across different GWP versions (if zero, state zero explicitly), factor year distribution table, overall data quality assessment |
| 4. Emission breakdown | Scope summary table, Scope 3 fifteen-category breakdown table (categories that did not occur must be shown as zero rather than omitted), supplier Top 10 ranking |
| 5. Activity detail | Summary list of all records, including document source, activity description, quantity and unit, selected factor ID, emissions, uncertainty tier |
| 6. Uncertainty statement | Three-tier distribution statistics table, categorization of main uncertainty sources, at least three data quality improvement recommendations |
| 7. Emission reduction scenario recommendations | Comparison table for scenarios S-1, S-2, and S-3, absolute emission reduction and percentage for each scenario, feasibility description of at least 80 English words per scenario |
| 8. Appendix 1: Factor list | All factors actually used in this report, listed individually with ID, name, value, unit, year, and source name |
| 9. Appendix 2: Traceability index | Cross-reference entries from every data point in the report to its source document ID or factor ID |
| 10. Disclaimer | A statement that the results produced by this tool do not constitute an audit opinion or legal advice, and that users should independently verify the results before external disclosure |

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-1001 | Generate an English report following the section structure above | All sections are present and in the correct order |
| FR-1002 | Every numerical conclusion carries a reference anchor that, when clicked in the Web reading view, jumps to the source document or factor entry; in the PDF, the correspondence is presented via the Appendix 2 traceability index | 100% anchor coverage with zero broken anchors |
| FR-1003 | Support PDF export with header, page numbers, and a table of contents, ready for external delivery | The PDF has at least 6 pages |
| FR-1004 | Support CSV export with at least two files: activity detail and category summary | No encoding corruption |
| FR-1005 | The report cover states the GWP version and the factor year distribution | The cover contains both statements |
| FR-1006 | Include a disclaimer that the results produced by this tool do not constitute an audit opinion or legal advice | The disclaimer is present |

### 4.11 Review Queue Module

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-1101 | Centrally display records requiring manual handling, sorted by high, medium, and low uncertainty tier (high first) | Correct sorting with scrollable browsing |
| FR-1102 | Allow editing of four fields: quantity, unit, transport mode, and origin/destination; also allow filling in missing required fields identified in Step 5 (such as date, quantity, and unit) | Recalculation is triggered after saving |
| FR-1103 | Allow manual factor specification, which takes precedence over automatic matching and is explicitly labeled "Manually Specified" | Results update after re-selection |
| FR-1104 | Allow marking records as "Excluded from Accounting" with a written reason in English | Excluded records are not counted in the total and are listed in the report |
| FR-1105 | Review actions record the operator and timestamp in the audit trail | The audit trail is visible |

### 4.12 Observability and Demo Aids

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-1201 | Provide real-time visualization of the processing workflow: current stage, number completed, and per-file status | Progress is continuous and never regresses while processing 20 files |
| FR-1202 | Provide tracing records for every AI call: input summary, output summary, duration, and usage estimate | The tracing panel can be filtered by stage |
| FR-1203 | Provide a prebuilt sample dataset that fully reproduces the main flow with one-click loading | A complete report is produced within 3 minutes of one-click loading |

---

## 5. Non-Functional Requirements

### 5.1 Performance

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| NFR-101 | End-to-end processing of 20 documents within a P90 of 3 minutes | P90 target met across 10 test runs |
| NFR-102 | AI processing cost per document no higher than USD 0.03 | Cumulative usage statistics meet the target |
| NFR-103 | First-screen load within 3 seconds | Average of 5 runs under standard network conditions |
| NFR-104 | Report PDF export within 10 seconds | Target met on 5 consecutive runs |
| NFR-105 | No request failures under 3 concurrent tasks | No server-side errors under load testing |

### 5.2 Reliability and Fault Tolerance

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| NFR-201 | A single file failure must not block the overall workflow | With 3 corrupted files mixed in, all 17 remaining files succeed |
| NFR-202 | AI call timeouts are automatically retried twice; if the call still fails, the failing object (file or record) is explicitly marked and set to a failed state | Simulated timeout behavior matches expectations |
| NFR-203 | Re-entering after a page refresh preserves progress and completed task data | State is correctly restored after a mid-process refresh |
| NFR-204 | All failures produce a machine-readable error code and a human-readable English description | Error codes cover all known failure types |

### 5.3 Security and Privacy

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| NFR-301 | User-uploaded files must not be accessible to other tasks or users | Cross-task access attempts are detected and denied |
| NFR-302 | User data must not be used for any model training | Explicitly stated in the README |
| NFR-303 | The public demo URL must have basic access rate limiting | Rate-limiting logic is verified to exist |
| NFR-304 | No production environment secrets may be hardcoded | Confirmed by code scanning |

### 5.4 Usability and Accessibility

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| NFR-401 | First-time users must understand the core interaction of the main UI within 5 seconds | Achieved in tests with 3 observers who did not participate in development |
| NFR-402 | All site copy is in English with no grammatical errors | One manual proofreading pass |
| NFR-403 | Support keyboard navigation; primary buttons are keyboard-operable | The main flow can be completed using the keyboard alone |
| NFR-404 | Color must not be the sole carrier of information; tiers must also be distinguished by line-art icons | Tiers remain distinguishable in grayscale printed screenshots |

### 5.5 Maintainability and Scalability

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| NFR-501 | The factor library is decoupled from the code; adding factors requires no code changes | The system works normally after adding 10 factors |
| NFR-502 | Model selection is centrally configured; replacing a model requires only a configuration change | The system runs normally after the configuration change |
| NFR-503 | All service parameters can be overridden via environment variables | The README lists all environment variables |
| NFR-504 | The total self-developed codebase should not exceed 7,000 lines, and must never exceed the hard cap of 10,000 lines (consistent with the document metadata table) | Confirmed by a statistics tool |

---

## 6. AI and Agent Design Specifications

### 6.1 Model Roles

| Stage | Model Tier Used | Rationale |
|---|---|---|
| Document classification and field extraction | High-speed tier model (Gemini Flash series) | High data volume, highly structured tasks, cost-sensitive |
| Boundary determination | High-speed tier model | Well-defined task |
| Candidate factor retrieval and ranking | Keyword retrieval plus embedding-model semantic retrieval, with a high-speed tier model optionally used for re-ranking | Dual-channel retrieval is primary; re-ranking relies only on structured output and does not require deep reasoning |
| Final factor selection and rationale generation | High-performance tier model (Gemini Pro series) | Requires semantic inference and detailed argumentation |
| Uncertainty tier determination | Rule engine, no model call | The tiering conditions in Section 4.7 are explicit threshold rules; rule-based execution ensures results are reproducible and verifiable |
| Report generation and reduction recommendations | High-performance tier model | Requires long-form text and professional terminology |
| Semantic vector retrieval | Embedding model | Must use the embedding model officially provided by Google Cloud to support semantic retrieval |

The specific model versions are selected by the developer at implementation time, but must satisfy all of the following conditions: all models performing generative tasks belong to the Gemini or Gemma series; semantic vector retrieval uses the text embedding model officially provided by Google Cloud; all calls are made through the official interfaces provided by Google Cloud; model names are centralized in the configuration file and must not be scattered across the codebase.

### 6.2 Output Contract

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| AI-101 | All generative model calls must enable structured output mode; returning free text for subsequent manual parsing is strictly prohibited. Embedding vector calls are exempt | The codebase contains no string-splitting logic on natural-language return values |
| AI-102 | All enum fields are validated against a closed set; invalid values trigger a retry rather than being silently accepted | Tests with constructed invalid values are detected as rejected or retried |
| AI-103 | Every call must carry a source identifier to support subsequent traceability | Source identifiers are complete in the audit trail |
| AI-104 | All numeric fields produced by the model must carry a confidence score between 0 and 1 | Verified in spot checks |
| AI-105 | All user-visible text output is in English | Spot checks show no Chinese fragments |
| AI-106 | Every call must record duration and a usage estimate | Visible in the tracing panel |

### 6.3 Hallucination Mitigation

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| AI-201 | Every numerical conclusion in the report carries at least one reference anchor | 100% coverage with zero failures |
| AI-202 | The documents or factors referenced by anchors must actually exist | Five deliberately injected invalid references are all detected |
| AI-203 | The system must not output unreferenced carried-over values or concatenated inferred values | Does not occur in the wraparound tests |
| AI-204 | When the factor ID returned by the model is not in the candidate list, the call must be treated as failed and retried, not used directly | Verified by targeted testing |

### 6.4 Self-Check Mechanism

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| AI-301 | For every record, the factor matching result must pass a consistency self-check: verify whether the activity data unit of the selected factor is convertible to the normalized activity data unit | Self-check records are visible and the full Golden set passes |
| AI-302 | If the self-check fails, the record is automatically downgraded to high uncertainty and forced into the review queue | All 3 constructed cases are correctly downgraded |
| AI-303 | The result of the unit-basis self-check must be displayed in the UI as an explicit field, not handled implicitly | Visible in the UI |

---

## 7. Data Specifications

### 7.1 Golden Case Dataset

Developers must build a test set comprising the following parts, each of which must be accompanied by a machine-readable answer file.

**Group 1: 30 sample documents.** Coverage: scanned image PDFs, photos taken with a phone, Excel purchase details, air waybills, utility bills, packing lists, and documents with handwritten annotations. The correct answer is known for each.

**Group 2: 30 activity record answers.** Extracted from the Group 1 documents, with known correct values for every field of each record.

**Group 3: 40 factor matching cases.** Group 2 records may be reused and supplemented to reach 40 cases, each with a known optimal factor ID and runner-up candidate. The cases must cover five difficulty types:

- Explicit matches, for which confidence should reach a high level
- Requiring boundary inference, for example choosing between air freight general cargo and air freight cold chain
- Requiring unit conversion, for example converting pounds to kilograms before matching
- Requiring semantic inference, for example an LCL (less-than-container-load) shipment with an ancillary charge description should match the container sea freight factor
- Requiring boundary basis judgment, for example choosing between the upstream basis and the combustion basis for fuel categories

**Group 4: 3 sets of anomalous data.** These are, respectively, corrupted files, documents with missing fields, and duplicate uploaded files.

### 7.2 Factor Library Specifications

Build in accordance with the requirements in Section 4.6. Additional requirements: factor description text must retain the original English names to facilitate comparison with the source; origin/destination fields must uniformly use ISO 3166 country/region codes followed by the city name; if factors with the same semantics exist from multiple sources, all must be retained with a priority annotation; when semantically equivalent multi-source candidates are encountered during inference and selection, the highest-priority source should be chosen and the choice explained in the rationale to avoid confusion.

### 7.3 Sample Demo Dataset

Developers must produce a one-click-loading dataset for demonstration, with the following requirements: 20 documents mixing all supported formats; at least 2 records each covering Scope 1 and Scope 2, and at least 6 different categories covered under Scope 3; a plausible fictional company as the report entity, whose name, address, and industry are fictional but reasonable; during the demo, the data must run the full workflow and produce a complete report within 3 minutes.

---

## 8. Architecture and Technology Stack Constraints

### 8.1 Required Components

| Layer | Component | Constraint |
|---|---|---|
| Frontend | Single-page responsive web application | Deployed on Firebase Hosting |
| Backend | Backend service plus asynchronous task queue | Deployed on Cloud Run, supporting automatic scaling, with scale-to-zero allowed |
| File storage | Object storage | Firebase Storage |
| Structured storage | Document database | Firestore, with collections and fields defined per the data model in Section 8.4 |
| Vector retrieval | Vector index | The factor library contains no more than 1,200 entries; an in-process vector approach is allowed, as is a managed vector retrieval capability |
| Task queue | Asynchronous task management | Cloud Tasks or an equivalent managed service |
| Authentication | User login | Firebase Auth, with anonymous login or email login |
| Observability and tracing | Logging and distributed tracing | Cloud Logging and Cloud Trace |

### 8.2 Prohibitions

- Calling any generative model service from a vendor other than Google is prohibited
- Deploying to any target other than Cloud Run and Firebase is prohibited
- Introducing third-party services that require additional payment is prohibited
- Committing any form of secret to the code repository is prohibited
- Expanding the factor library or functional scope in pursuit of generality is prohibited; any functionality beyond the scope of this document must not be implemented

### 8.3 Environment Variables

The following variables must be defined in the configuration file and overridable by environment variables, and the README must explain the default value and meaning of each: extraction model name, inference model name, embedding model name, batch size, classification confidence threshold (default 0.7), factor matching confidence threshold (default 0.65), call retry count, call timeout in seconds, default GWP version, storage bucket name, and cloud service project identifier.

### 8.4 Data Model

Firestore must contain at least the following collections. The required fields, types, and constraints for each collection are implemented as shown in the table below; field naming may be adjusted freely, but no semantics may be omitted.

| Collection | Purpose | Key Fields |
|---|---|---|
| tasks | Accounting task | Task ID, entity name, time interval start and end, GWP version, creation time, status, creator ID |
| documents | Uploaded source files | File ID, owning task ID, original file name, format, size, page count, content hash, storage path, upload status |
| document_units | Page units | Unit ID, owning file ID, page number (files with no pagination concept are handled as a single unit), identified document type, type confidence, whether manual confirmation is required |
| activity_records | Activity records | Fields implemented strictly per the activity record field table in Section 4.3, additionally including the owning task ID and the uncertainty tier |
| emission_factors | Emission factors | Fields implemented strictly per the FR-603 attribute list in Section 4.6, additionally including vector data |
| matches | Factor matching results | Match ID, owning activity record ID, selected factor ID, runner-up factor ID, confidence, rationale text, key semantic features, whether the GWP version is consistent |
| calculations | Calculation results | Calculation ID, owning activity record ID, normalized activity data value, unit, selected factor value, emissions, conversion process detail |
| scenarios | Scenario results | Scenario ID, owning task ID, scenario number, scenario name, parameters, absolute emission reduction, emission reduction percentage, feasibility description |
| reports | Generated reports | Report ID, owning task ID, section content, generation time, exported file path |
| review_items | Review queue items | Review item ID, owning task ID, related activity record ID, uncertainty tier, status, handler, handling time, handling notes |
| audit_trail | Audit trail | Trail ID, owning task ID, action type, action subject, related object ID, timestamp, action detail |
| ai_traces | Model call traces | Trace ID, owning task ID, call stage, model name, input summary, output summary, duration, usage estimate, success or failure |

Referential constraints: for all collections with reference relationships, the referenced identifiers must be genuinely valid. The evaluation tool must include a full scan for invalid references, and the scan results must be incorporated into the invalid reference count metric in Section 10.1, with no omissions or exceptions permitted.

---

## 9. UI and UX Specifications

### 9.1 Page Inventory

| Page | Required Elements |
|---|---|
| P1 Home and task creation | Product name, one-sentence value proposition, task creation form (name, time interval, GWP version) |
| P2 Upload and processing | Drag-and-drop area, file list with status labels, overall progress, one-click sample data loading button |
| P3 Activity record detail | Table, per-record expandable field confidence, entry to view the source file, factor matching result and rationale, uncertainty label, review entry |
| P4 Factor match viewer | Candidate list for any record, comparison of optimal and runner-up, manual re-selection entry |
| P5 Chart dashboard | Three-Scope breakdown chart, category breakdown, supplier Top, monthly trend, dimension filters |
| P6 Scenario comparison | Three scenario cards, comparison with the baseline, absolute emission reduction and percentage, expandable feasibility description |
| P7 Report | Reading view of the ten-section structure (from cover page to disclaimer), reference anchor navigation, export entry |
| P8 Review queue | Sorted by uncertainty, field editing, factor re-selection, exclusion marking |
| P9 Tracing panel | AI call records for each stage, queryable by item |

### 9.2 Interaction Guidelines

- Any user action must receive immediate visual confirmation; operations exceeding 3 seconds must show an in-progress indicator.
- Any error must provide a recovery path; dead ends must not occur.
- Long tasks exceeding 5 seconds must provide a cancel capability.
- Destructive operations must require secondary confirmation.
- The UI primary palette should use light tones, remaining professional and restrained; large areas of highly saturated color blocks must not be used.

---

## 10. Testing and Acceptance

### 10.1 Evaluation Metrics Table

Developers must provide an evaluation tool that runs from the command line, **outputting all metrics in the table below along with their pass/fail status in a single run**.

**Output format requirements for the evaluation tool (must be followed)**

| ID | Requirement |
|---|---|
| EV-1 | Output a single complete table with columns in order: metric name, target value, measured value, and pass/fail status; results must not be scattered across multiple outputs |
| EV-2 | Every row must explicitly state one of two values in the pass/fail column: Pass or Fail; vague wording is prohibited |
| EV-3 | Output a summary row at the end of the table: number of passing metrics, number of failing metrics, and an overall conclusion that is either Pass or Fail |
| EV-4 | If any veto-category metric fails, the overall conclusion is directly Fail, even if all other metrics pass |
| EV-5 | Support two run modes: running all metrics at once, or running a specified individual metric group, to facilitate rapid regression during development |
| EV-6 | At the end of a run, output both a machine-readable results file and a human-readable summary, for inclusion in submission materials |

All accuracy metrics are computed on the Golden Case dataset in Section 7.1, and all time and cost metrics are computed on the sample dataset in Section 7.3.

| Metric | Target Value | Mandatory |
|---|---|---|
| Document classification accuracy, Top-1 | No lower than 93% (at least 28 of 30 Golden documents correct) | Mandatory |
| Field extraction accuracy (quantity, unit, amount, date, currency) | Average no lower than 95%, with quantity and unit no lower than 98% | Mandatory |
| Factor matching accuracy, Top-1 | No lower than 85% (at least 34 of 40 Golden cases correct) | Mandatory |
| Factor matching accuracy, Top-3 hit rate | No lower than 95% (at least 38 of 40 hit) | Reference |
| Scope determination accuracy | No lower than 90% (counted separately for 10 Scope-level items and 12 Scope 3 category items, each no lower than 90%) | Mandatory |
| Calculation accuracy | 100% (zero tolerance under the presentation-layer tonnes CO2e three-decimal-place convention; a relative error of 1e-6 is allowed in the intermediate floating-point process, consistent with the convention in Section 4.8) | Mandatory |
| Report reference coverage | 100% | Mandatory |
| Invalid reference count (hallucination) | 0 | Veto: any non-zero value fails the overall result |
| Aggregate value consistency | The sum of line items and the total are exactly consistent under the presentation-layer three-decimal-place convention (same convention as FR-805) | Mandatory |
| End-to-end duration (20 documents) | P90 no more than 3 minutes | Mandatory |
| AI processing cost per document | No higher than USD 0.03 | Mandatory |

### 10.2 Stage Acceptance Gates

Each gate may only be passed with demonstrable supporting evidence; verbal declarations of completion are not permitted.

| Gate | Timing | Entry Criteria | Exit Criteria |
|---|---|---|---|
| G0 Project kickoff | Day 1 | Requirements fully read | Factor sources determined and documented; project skeleton initialized and buildable/runnable locally with one command; basic self-test scripts executable |
| G1 Data readiness | Day 2 | G0 passed | Factor library import complete and queryable; all 30 Golden documents and their answers in place |
| G2 Extraction working | Day 4 | G1 passed | Field accuracy targets met on the Golden set; traceability chain complete and navigable |
| G3 Matching and calculation working | Day 6 | G2 passed | Factor matching accuracy targets met; calculation accuracy 100%; aggregate consistency validation passed |
| G4 Report and scenarios complete | Day 7 | G3 passed | A report with all sections can be generated and exported; all three scenarios calculate correctly; reference coverage 100% |
| G5 Deployment and demo readiness | Day 8 | G4 passed | Deployment successful; the public URL is accessible from 3 different network environments; sample data loads with one click and runs to completion, producing a report |
| G6 Delivery complete | Days 9-10 | G5 passed | Video recording complete; English deck PDF complete; README complete; all acceptance checklist items checked |

### 10.3 Final Acceptance Checklist

Submission is permitted only when all items are checked; any unchecked item is considered a delivery failure.

**Functional acceptance**
- [ ] All five file formats parse successfully
- [ ] A complete report is produced within 3 minutes after one-click loading of 20 documents
- [ ] All reference anchors in the Web reading view can be clicked to jump to the original file, with 100% coverage
- [ ] High-uncertainty records automatically enter the review queue
- [ ] Review edits trigger recalculation and synchronously refresh the report
- [ ] All three scenarios are calculable and output absolute emission reduction and percentage
- [ ] PDF and CSV exports succeed with no encoding anomalies
- [ ] Task state is not lost after a page refresh

**Competition compliance acceptance**
- [ ] Deployed on Cloud Run and Firebase, with the public URL accessible
- [ ] All generative AI capabilities come from the Gemini series models, vector retrieval uses the official Google Cloud embedding model, and no third-party models are used
- [ ] The public URL has no login barrier; anonymous login completes automatically on entry, with no registration or credentials required
- [ ] All UI copy, report body, README, and video subtitles are in English
- [ ] The track label is consistent across the deck title page, the README landing section, and the video ending
**Video Acceptance (3 minutes)**
- [ ] Convey the value numbers (cost and labor-hour comparison) clearly within the first 15 seconds of the opening
- [ ] Show one complete continuous process from drag-and-drop to report generation, with no appearance of cut or skipped frames from editing
- [ ] Show at least one comparison case where the correct factor is selected only because of semantic understanding
- [ ] Show at least one click-through of citation traceability

**Engineering Acceptance**
- [ ] The evaluation tool can be run from the command line and outputs a complete report
- [ ] All metrics meet the target values in Section 10.1
- [ ] No secrets leaked in the code
- [ ] Self-developed code does not exceed 7,000 lines and does not touch the 10,000-line hard limit
- [ ] The README clearly explains the architecture, deployment steps, environment variables, and evaluation results

---

## 11. Deliverables List and Milestone Schedule

### 11.1 Deliverables List

| ID | Deliverable | Format | Delivery Deadline |
|---|---|---|---|
| DEL-1 | Accessible Web prototype | Public URL | Day 8 |
| DEL-2 | English README | Markdown | Day 9 |
| DEL-3 | English proposal deck | PDF, 10 to 14 pages | Day 9 |
| DEL-4 | 3-minute demo video | Public YouTube or Vimeo link, or public Google Drive link | Day 9 |
| DEL-5 | Evaluation tool and results | Command-line tool plus results report | Day 8 |
| DEL-6 | Factor library data file | Bundled with the code repository | Day 2 |
| DEL-7 | Architecture and deployment documentation | Incorporated into the README | Day 9 |

### 11.2 Ten-Day Schedule

Start date 2026-10-08, deadline 2026-10-18.

| Day | Date | Key Tasks | Completion Criteria |
|---|---|---|---|
| D1 | 10-08 | Confirm technology stack; lock factor sources; set up engineering skeleton | Pass G0 |
| D2 | 10-09 | Clean and load the factor library; create Golden data | Pass G1 |
| D3 | 10-10 | Implement file ingestion and classification module | Classification module unit tests pass |
| D4 | 10-11 | Field extraction and normalization; traceability chain | Pass G2 (team formation deadline) |
| D5 | 10-12 | Implement dual-channel factor candidate retrieval | Candidate recall effectiveness validated |
| D6 | 10-13 | Inference-based selection and uncertainty grading; calculation aggregation | Pass G3 |
| D7 | 10-14 | Report generation, scenario analysis, export | Pass G4 |
| D8 | 10-15 | Deployment, load testing, sample data tuning | Pass G5 |
| D9 | 10-16 | Record the video and keep two backups; write the deck and README | DEL-2, 3, 4 complete |
| D10 | 10-17 | Check off the acceptance checklist; fill gaps; pre-submission self-check | Pass G6 |
| Deadline | 10-18 | Submit, with half a day of buffer | Submission complete |

---

## 12. Risk Register

| ID | Risk | Probability | Impact | Mitigation |
|---|---|---|---|---|
| R-1 | Factor source formats are inconsistent or data quality is poor | Medium | High | Lock the single source, version, and acquisition method on Day 1; runtime web scraping is strictly prohibited |
| R-2 | Insufficient extraction accuracy for scanned documents | Medium | High | Set a confidence threshold; low-confidence items go to a manual queue without affecting the main demo flow |
| R-3 | Factor matching accuracy falls short of 85% | Medium | High | Prioritize manually calibrating all 40 cases for prompt iteration; narrow the factor library scope if necessary |
| R-4 | Video recording runs over time or footage is insufficient | Low | Medium | Record as soon as the main flow is well rehearsed; keep two backup versions |
| R-5 | Cloud Run deployment fails | Medium | Medium | Reserve all of Day 8 specifically for deployment and troubleshooting; do not leave it until the end |
| R-6 | Token cost overrun | Low | Medium | Enforce strict model task allocation; log usage for every call and visualize it on the dashboard |

---

## 13. Assumptions and Items to Be Confirmed

The following are the premises on which this document holds. If the developer finds any of them to be inconsistent with the facts, they should stop work immediately and report back.

| ID | Assumption | If Not Valid |
|---|---|---|
| A-1 | Publicly available emission factor data can be freely obtained by the developer | A different data source must be selected and the scope redefined |
| A-2 | The team has a Google Cloud project quota and has enabled the required services | Must be replaced with equivalent managed capabilities |
| A-3 | The developer has lawful access to call Gemini-series models | The project cannot start and must be reported immediately |
| A-4 | This document is a Chinese working document and all external deliverables are in English | The language policy must be reconfirmed |
| A-5 | The competition submission deadline and rules are based on the version provided by the requester | Must be re-verified against the latest announcement on the competition's official website |

---

## 14. Version Change Log

| Version | Date | Changes |
|---|---|---|
| v1.0 | 2026-10-08 | Initial release |
| v1.1 | 2026-10-12 | Review revision; all changes are consistency and clarity fixes with no new functionality added: fixed the table structure error in Section 4.10 and duplicated text in Section 8.4; corrected the conversion relationship count from 12 to the actual 10; unified the FR-501 acceptance criterion from all correct to no less than 90%, consistent with Section 10.1; reconciled the wording of zero tolerance for calculation accuracy with 1e-6 floating-point error; unified the code line count convention (target 7,000, hard limit 10,000); clarified the uncertainty grading boundary values and the order of determination; clarified the three-scenario substitution mapping rules and the handling of zero applicable records; changed transport_mode to conditionally required for transport-type activities; clarified that citation anchor jumps occur in the Web reading view; replaced the CI pipeline with a local one-click build and self-test at gate G0; added a cross-GWP-version factor usage statistic item to the methodology section; unified the wording for year distribution in the report structure list and the section content table as factor year distribution; added glossary entries; added the default value for the factor configuration confidence threshold |
| v1.2 | 2026-10-12 | Three rounds of comprehensive review revision: removed the MoSCoW priority tiers, changed all functional requirements to mandatory items with no MVP and no phasing, and removed all priority columns; corrected the relationship between the Gemini compliance statement and the embedding model (M-1, 6.1, 10.3, and AI-101 now distinguish generative models from embedding models); in Section 6.1, changed uncertainty grading from execution by a high-performance-tier model to execution by a rule engine, consistent with the threshold rules in Section 4.7; changed candidate factor recall ranking to dual-channel retrieval as the primary method with model re-ranking optional; added an entry point in the review queue for supplying missing required fields, completing the supplementary path promised in Step 5; extended the source_ref location semantics to worksheets and data rows; clarified in document_units that files without pagination are treated as a single unit; defined "valid record"; clarified the cumulative call convention for stress testing in FR-202 and FR-403; added minimum correct counts to the accuracy metrics of the Golden set (93% means 28/30, 90% means 9/10 and 11/12, 85% means 34/40, Top-3 means 38/40); clarified that accuracy-type metrics are calculated on the Golden set while time and cost-type metrics are calculated on the sample dataset; clarified that the aggregate value consistency metric uses the three-decimal-place convention at the presentation layer; clarified that FR-1004 refers to two CSV files; clarified that the failure object in NFR-202 is a file or record; added usage rules for multi-source factor priority; added an explanatory note for the wording "internal main item" in the review weighting table; aligned the AR5/AR6 entries in the glossary with the cross-version rules in Section 4.5; clarified in Section 7.1 the compositional relationship of the second and third Golden data groups |

---

End of document. The developer shall treat this document as the sole requirements baseline; any point of doubt must be confirmed before implementation, and the scope must not be expanded or reduced based on guesswork.
