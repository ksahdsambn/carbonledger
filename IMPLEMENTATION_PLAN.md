# CarbonLedger Implementation Plan (AI Developer Execution Edition)

| Project Meta-information | Content |
|---|---|
| Basis document | "Requirements Specification: CarbonLedger" v1.2 (sole source of requirements; this plan changes no requirements, it only defines the execution order and verification methods) |
| Execution mode | Unattended, strictly serial, one task at a time |
| Total tasks | 51 items (T-001 to T-051), in 8 phases, corresponding to PRD gates G0 to G6 |
| Core iron rule | **No next task may begin until all verifications of the current task pass** |
| Document language | This plan is a Chinese working document; all deliverables (code comments, UI copy, reports, README, deck, subtitles) are in English |

---

## 0. Global Execution Rules (Must Be Read in Full Before Starting)

1. **Serial, no skipping**: Tasks are executed strictly in numerical order. Developing multiple tasks in parallel is prohibited, skipping any task is prohibited, and reordering is prohibited. The next task must not begin until the previous task is recorded as "passed".
2. **Verification is completion**: A task counts as complete only when every check item listed in its "Verification" subsection passes. Partial passing counts as not passing.
3. **Failure handling protocol**: When verification fails, diagnosing the cause and fixing it is permitted; after the fix, **all verification items of that task must be re-run** (not only the failed items). If the same task still fails after two consecutive rounds of fixes, stop execution immediately, write a blocking report into the progress log (including failure symptoms, cause analysis, and measures attempted), and wait for human intervention. It is strictly forbidden to lower standards, delete tests, fabricate data, or bypass checks in order to pass verification.
4. **Scope freeze**: Implement only what the PRD specifies. All functional requirements in the PRD are mandatory (no MVP, no phasing, no trimming). When something appears to require expanding or narrowing the scope, record it as a to-be-confirmed item and continue executing per the PRD; do not decide on your own. When there is a conflict with the PRD, the PRD prevails, and the conflict point is recorded in the progress log.
5. **Test data freeze**: All accuracy and functional verification must use the Golden Case dataset and the sample demo dataset built in Phase 1 of this plan; piecing together substitute data on the fly is strictly prohibited.
6. **Progress log**: Maintain an execution log under the repository's progress directory. Append one record after each completed task: task number, conclusion (passed or blocked), actual results and values for each verification item, and evidence file locations. At the end of each phase, append the gate (G0 to G6) verdict record.
7. **Secret discipline**: No secrets or service account credentials may be written into the repository. All are injected via environment variables. A secret scan is run once at each phase gate.
8. **Language discipline**: All user-visible output (interface, reports, error messages, README, deck, subtitles) is in English; development comments are in English; the progress log may be in Chinese.
9. **Model discipline**: Generative tasks use only the Gemini family (at least one model each in the Flash tier and Pro tier); vector recall uses only Google Cloud official embedding models; model names are centralized in configuration (PRD Sections 6.1, 8.3).
10. **Evidence trail**: The raw output of acceptance-type verification (accuracy, elapsed time, cost) must be saved as files for reference by the evaluation tool and gates; verbal claims alone are not acceptable.

### Task Card Format

Each task contains five fields: prerequisites (task numbers that must already be passed), objective, implementation points (numbered steps), verification (numbered check items with pass criteria), and evidence requirements. Verification items are by default required to be automatable and to output results on the command line; items that genuinely require human judgment have an alternative noted within the task.

### Phase and Gate Mapping

| Phase | Task range | Closing gate | Corresponding PRD section |
|---|---|---|---|
| Phase 0 Baseline | T-001 to T-005 | G0 Project Initiation | 2, 8 |
| Phase 1 Data Assets | T-006 to T-010 | G1 Data Ready | 4.6, 7 |
| Phase 2 Ingestion and Classification | T-011 to T-015 | — | 4.1, 4.2 |
| Phase 3 Extraction and Normalization | T-016 to T-020 | G2 Extraction Working | 4.3, 4.4 |
| Phase 4 Matching and Calculation | T-021 to T-030 | G3 Matching and Calculation Working | 4.5, 4.7, 4.8, 6 |
| Phase 5 Scenario and Report Review | T-031 to T-037 | G4 Reports and Scenarios Complete | 4.9, 4.10, 4.11 |
| Phase 6 Frontend | T-038 to T-042 | — | 4.12, 5.4, 9 |
| Phase 7 Deployment and Final Acceptance | T-043 to T-051 | G5 Deployment Ready, G6 Delivery Complete | 5, 8.1, 10, 11 |

---

## Phase 0: Engineering Baseline (T-001 to T-005)

### T-001 Requirements Tracking Checklist and Cloud Environment Inventory

- **Prerequisites**: None.
- **Objective**: Establish a tracking checklist covering all requirement numbers; confirm all cloud services and model APIs are available.
- **Implementation points**:
  1. Read the entire PRD v1.2, create a requirements tracking checklist file, and register item by item: 57 FRs, 21 NFRs, 13 AI constraints, 6 EV requirements, 5 M, 5 D, 3 L, each with a status column (Not Started, In Progress, Verified).
  2. Verify the Google Cloud project has the following enabled: Cloud Run, Firebase Hosting, Firebase Auth, Firebase Storage, Firestore, Cloud Tasks (or an equivalent asynchronous queue), Cloud Logging, Cloud Trace.
  3. Verify that at least one model each from the Gemini family's Flash tier and Pro tier, plus one official text embedding model, all have invocation permissions.
  4. Create a decision record file: select the model for each stage, the default GWP version (choose one of AR5 or AR6), and the deployment region; these are later written into the centralized configuration.
- **Verification**:
  1. The number of entries in the requirements tracking checklist matches the counts listed above for each category (57, 21, 13, 6, 5, 5, 3).
  2. Each of the above cloud services is queried via command line or console and found to be enabled; the resulting screenshots or text output are stored in the evidence directory.
  3. A minimal invocation is completed and returns successfully for each of the Gemini Flash tier, Pro tier, and the embedding model.
- **Evidence**: Requirements tracking checklist, decision record, and results of the three model invocations.

### T-002 Engineering Skeleton and Centralized Configuration

- **Prerequisites**: T-001.
- **Objective**: Initialize a buildable monorepo skeleton, with all service parameters centralized in configuration.
- **Implementation points**:
  1. Create the repository directory structure: frontend app, backend service, data directory (factor library, Golden set, sample set), evaluation tool, deployment configuration, and progress log directory.
  2. Create a centralized configuration file carrying all 11 parameters of PRD Section 8.3 (extraction model, reasoning model, embedding model, batch size, classification confidence threshold default 0.7, factor matching confidence threshold default 0.65, invocation retry count, invocation timeout in seconds, default GWP version, bucket name, cloud project identifier), each overridable by environment variable; no scattered hard-coded configuration may appear in the code.
  3. The backend framework includes: a health check endpoint, asynchronous task queue integration (hosted service selected per PRD 8.1), and structured log output.
  4. Frontend framework: a responsive single-page application skeleton with a light-theme base (PRD 9.2).
  5. Create a global error code registry file: covering at least the known failure types of PRD NFR-204 (unsupported format, exceeding the size limit, corrupted file, parse failure, extraction failure, model invocation failure and timeout, illegal enum value, insufficient candidates, no high-confidence factor, invalid reference, storage access failure, task not found), each with a machine-readable identifier and an English description; failure paths in all subsequent modules must reference the error codes in the registry, and T-046 performs a coverage check.
  6. Configure repository ignore rules: secret files, dependency directories, and build artifacts are never committed.
- **Verification**:
  1. Print all key-value pairs of the centralized configuration; they correspond one-to-one with the 11 items in Section 8.3 and all default values are present.
  2. After modifying any environment variable and re-reading, the configuration value changes accordingly.
  3. Scan repository files for common secret patterns (private key headers, service account JSON signatures, long random strings); zero hits.
- **Evidence**: Configuration listing output, environment variable override experiment results, secret scan results.

### T-003 Local Build, Self-Test, and Smoke Baseline

- **Prerequisites**: T-002.
- **Objective**: Establish a one-command local build and unit test entry point, and get a minimal smoke chain running end to end.
- **Implementation points**:
  1. Provide a repository-root one-click build script: completes the frontend build and backend packaging.
  2. Provide a one-click test script: runs all current automated tests and outputs statistics (number of cases, passed, failed).
  3. Provide a smoke chain: start the backend, call the health check, and shut down gracefully.
- **Verification**:
  1. The one-click build script is executed 3 consecutive times, all successful.
  2. The one-click test script exits with a success code and outputs test statistics.
  3. The smoke chain is executed 3 consecutive times with no failures and no leftover processes.
- **Evidence**: Output records of the three builds and smoke runs.

### T-004 Evaluation Tool Skeleton

- **Prerequisites**: T-003.
- **Objective**: First build an evaluation tool shell conforming to the output contract of PRD Section 10.1 EV-1 to EV-6; verification results from every subsequent phase feed into this tool.
- **Implementation points**:
  1. The command-line evaluation tool supports two run modes: a full run, or a run by metric group (PRD EV-5).
  2. Metric groups are defined item by item per the metrics in Section 10.1 (currently all marked as not met, with measured values left blank).
  3. The output contract is implemented per EV-1 to EV-6: a single complete table (four columns: metric name, target value, measured value, whether met), the met column allows only two values (met or not met), a summary row at the end (number of met items, number of unmet items, overall verdict pass or fail), a non-zero count of invalid references makes the overall verdict immediately fail (veto), and both a machine-readable result file and a human-readable summary are produced.
  4. Each metric reserves an evidence file path field.
- **Verification**:
  1. The full-run output table contains all 11 metrics from Section 10.1 with all four columns present.
  2. A single-metric-group run outputs only the selected group.
  3. Construct and inject fake data with an invalid reference count of 1 once; confirm the overall verdict outputs fail, verify that the veto logic takes effect, then remove the fake data.
  4. The machine-readable file and the human-readable summary are generated at the same time and are consistent in content.
- **Evidence**: Output and result files from the two runs.

### T-005 Emission Factor Source Lock-In (Gate G0)

- **Prerequisites**: T-004.
- **Objective**: Lock in and record the emission factor data sources, meeting all G0 exit conditions.
- **Implementation points**:
  1. From the sources recommended in PRD Section 4.6 (UK Government greenhouse gas conversion factors annual report, US EPA emission factors hub, public industry-average factor sets), determine the sources actually used, and record each one: source name, version year, public link, and acquisition method.
  2. Confirm the selected sources can cover the basic factor needs of the 5 target industries (electronics manufacturing, apparel and textiles, food processing, logistics and transport, general office services), and record coverage gaps and planned supplementary sources.
  3. Factor files are delivered with the repository and do not depend on network access at runtime (PRD FR-605).
- **Verification**:
  1. The source record file contains the four elements of name, version year, link, and acquisition method, and the links are accessible.
  2. Each of the 5 industries has a preliminary factor list (no limit on the number of entries; completed in Phase 1).
  3. Check the G0 exit conditions item by item: factor sources recorded, engineering skeleton can be built and run locally with one command, basic self-test script executable — once all hold, record "G0 passed" in the progress log.
- **Evidence**: Source record file, G0 verdict record.

---

## Phase 1: Data Assets (T-006 to T-010)

### T-006 Factor Library Data File Construction

- **Prerequisites**: T-005.
- **Objective**: Produce a structurally complete factor library data file delivered with the repository.
- **Implementation points**:
  1. Build each factor per the 13 attributes of PRD FR-603: factor ID, factor name, natural language description, applicable activity type, emission unit, activity data unit, value, greenhouse gas coverage, system boundary type, GWP version, data year, source name, and original source location.
  2. Scale constraints: no fewer than 40 entries per industry across the 5 industries, with a total not exceeding 1,200 entries.
  3. When the same semantic factor has multiple sources, retain all of them and mark priority (PRD 7.2); description text retains the original English name; factors involving locations uniformly use country/region code plus city name.
  4. The factor library is stored as an independent data file in the data directory; loading must not depend on network access at runtime.
- **Verification**:
  1. Random spot-check of 50 entries: 100% completeness across the 13 attributes.
  2. Count entries by industry: no fewer than 40 per industry, total not exceeding 1,200.
  3. Factor IDs are unique across the entire library, with no duplicates.
  4. With the network disconnected, the factor file loads completely (entry count matches the file).
- **Evidence**: Spot-check records, industry statistics table, offline loading results.

### T-007 Factor Library Loading and Retrieval Readiness (First Half of G1)

- **Prerequisites**: T-006.
- **Objective**: The factor library is loaded into storage and queryable by ID and keyword, with fields consistent with the data model in Section 8.4.
- **Implementation points**:
  1. Import the factor file into structured storage, with the collection and fields defined per PRD Section 8.4 emission_factors.
  2. Provide two basic query capabilities: exact lookup by ID and lookup by keyword.
  3. Compute and save the factor year distribution for use in the report appendix (FR-606).
- **Verification**:
  1. Take any 20 factor IDs and query them one by one; all return, and field values match the source file.
  2. Keyword queries return non-empty results for common category words (such as electricity, air freight, steel).
  3. The year distribution statistics are generated, and the sum of entries per year equals the total entry count.
- **Evidence**: Query result samples, year distribution table.

### T-008 Golden Case Dataset Creation

- **Prerequisites**: T-007.
- **Objective**: Create the four groups of Golden data in PRD Section 7.1.
- **Implementation points**:
  1. Group 1: 30 sample documents, covering the seven sample types — image-based scanned PDFs, phone-camera photos, Excel purchase details, air waybills, utility bills, packing lists, and handwritten-annotated documents — with a representative for each, including one 4-page PDF mixing 3 types, one invoice with three line items, no fewer than 5 documents missing fields, no fewer than 3 handwritten-annotated documents, and no fewer than 3 deliberately blurred low-clarity documents (for use in the FR-203 low-confidence confirmation test).
  2. Group 2: ground-truth answers for 30 activity records, with fields exactly matching the field table in PRD Section 4.3, produced by extraction from the Group 1 documents.
  3. Group 3: 40 factor matching cases (may reuse Group 2 with additional constructions), each containing the best factor ID and the runner-up candidate ID, with no fewer than 6 cases in each of the five difficulty categories: clear match, boundary inference (choose between general air cargo and cold chain), unit conversion (pounds to kilograms), semantic inference (LCL shipment matches container ocean freight), and boundary scope (choose between fuel upstream scope and combustion scope).
  4. Group 4: 3 sets of anomalous data — a corrupted file, a document missing required fields, and a duplicate uploaded file.
  5. All answers are delivered as machine-readable files, with paths registered in the evaluation tool.
- **Verification**:
  1. Document counts and coverage are checked item by item (30 documents, a representative for each of the seven sample types, the 4-page 3-type PDF present, no fewer than 3 handwritten documents, no fewer than 3 blurred documents).
  2. The answer files can be parsed by the evaluation tool, and the field names of the 30 records correspond one by one with the field table in Section 4.3.
  3. For all 40 matching cases, the best and runner-up factor IDs exist in the factor library.
  4. Each of the five difficulty categories has no fewer than 6 cases.
  5. The anomaly group has all three items present.
- **Evidence**: Data inventory, parse output, ID existence validation results.

### T-009 Golden Integrity Final Check

- **Prerequisites**: T-008.
- **Objective**: Perform a full consistency final check on the Golden set to prevent all subsequent accuracy metrics from being built on erroneous ground-truth answers.
- **Implementation points**:
  1. Write a one-off validation procedure: legality of answer file field types (numeric values greater than zero, date format, enum values), quantity and unit paired, origin and destination non-empty for transport-type records, and transport mode within the closed enum.
  2. Manually review the best and runner-up determinations of the Group 3 cases once to confirm they are indeed reasonable (this is the only step where human judgment is allowed; review comments are written into the record).
- **Verification**:
  1. The legality validation reports zero errors; if errors occur, fix the answer files and re-run until zero.
  2. The enum and pairing checks for transport-type records all pass.
  3. The manual review record is non-empty and has no unresolved objections.
- **Evidence**: Validation output, review record.

### T-010 Sample Demo Dataset Creation (Gate G1)

- **Prerequisites**: T-009.
- **Objective**: Create a one-click-loadable demo dataset, achieving G1.
- **Implementation points**:
  1. Per PRD Section 7.3: 20 documents, mixing all five supported formats; activity records covering at least two Scope 1 entries, two Scope 2 entries, and six different Scope 3 categories.
  2. Fabricate a credible company as the reporting entity (name, address, and industry plausibly fabricated).
  3. The dataset is stored in a fixed directory structure, accompanied by a machine-readable expected-results description (expected record count, expected category coverage) for reference by T-044 and the evaluation tool.
- **Verification**:
  1. File count is 20, with all five formats covered.
  2. The category coverage in the expected-results description satisfies two Scope 1 entries, two Scope 2 entries, and six Scope 3 categories.
  3. Check the G1 exit conditions: factor library import complete and queryable, all 30 Golden set documents and their answers in place — once they hold, record "G1 passed".
- **Evidence**: Dataset inventory, G1 verdict record.

---

## Phase 2: File Ingestion and Classification (T-011 to T-015)

### T-011 File Upload and Persistence Service

- **Prerequisites**: T-010.
- **Objective**: Implement the file ingestion capability of PRD Section 4.1 (excluding parsing).
- **Implementation points**:
  1. Support multi-file upload in a single request, with a format whitelist of PDF, JPG, PNG, XLSX, CSV; per-file limit of 10 MB, with over-limit files rejected and an English message returned (FR-101, FR-105).
  2. Immediately after upload, perform: format validation, page or unit count statistics, and content hash computation; when the hash is a duplicate, prompt the user to decide whether to keep it (FR-104).
  3. Original files are persisted to object storage, metadata is stored in the database, and the collection is defined per Section 8.4 documents (FR-106).
  4. File state machine: Queued, Parsing, Extracting, Matching, Completed, Needs Review, Failed (FR-102).
  5. Rejection of unsupported formats or corrupted files must not affect other files in the same batch (Section 3.2).
- **Verification**:
  1. Upload one sample of each of the five formats; all succeed and are stored, and the original files can be retrieved again with identical content.
  2. An 11 MB file is rejected with an English message; a corrupted file (Golden Group 4) is rejected while the rest of the batch succeeds.
  3. Uploading the same file twice triggers the deduplication prompt; execute once each choosing "keep" and "do not keep"; when kept, both copies coexist, and when not kept, only the first upload is stored.
  4. Upload 20 files in one request (using the sample dataset); all are stored with status Queued, none lost.
- **Evidence**: Upload result inventory, deduplication prompt output.

### T-012 Upload Module Regression Test Hardening

- **Prerequisites**: T-011.
- **Objective**: Turn the T-011 verifications into repeatable automated test cases and include them in the one-click test.
- **Implementation points**: Rewrite the four T-011 verifications as automated test cases and include them in the T-003 one-click test script; test case data references the Golden and sample set paths.
- **Verification**:
  1. The one-click test script run includes all the above cases and passes.
  2. After deliberately injecting a bad file and re-running, the corresponding case reports failure (verifying that the case really can fail, preventing false passes); after removal it passes again.
- **Evidence**: Two test output files (normal and injected).

### T-013 PDF Page Splitting and Page Units

- **Prerequisites**: T-012.
- **Objective**: Split multi-page PDFs into page units by page (FR-103, Section 8.4 document_units).
- **Implementation points**:
  1. Generate one page unit per page, recording the page number and the owning file; files without a pagination concept (images, spreadsheet types) are treated as a single unit.
  2. Convert each page of image-based scanned PDFs into a page representation that can be sent to the model for processing.
  3. The association between units and files is stored in the database for subsequent traceability references.
- **Verification**:
  1. The Golden 4-page mixed PDF splits into 4 units with consecutive page numbers and correct ownership.
  2. XLSX, CSV, and a single-page image each generate exactly 1 unit.
  3. Total units = sum of pages (or units) per file; sampling 5 units traces back to the original file and page.
- **Evidence**: Unit statistics and sample traceback records.

### T-014 Document Classification Module

- **Prerequisites**: T-013.
- **Objective**: Implement seven-category closed-enum classification (PRD Section 4.2).
- **Implementation points**:
  1. The classification enum is limited to seven categories: supplier invoice, purchase order, logistics waybill, utility bill, travel expense receipt, packing list, other; structured output is enabled and free-text categories are prohibited (FR-202, AI-101).
  2. Each unit outputs a type and a confidence; confidence below the threshold (default 0.7) is automatically flagged for manual confirmation (FR-203).
  3. Build a unified invocation wrapper reusable by all subsequent model modules: enable timeout and retry (counts and timeouts taken from configuration), write a trace record for every invocation, and persist it to the ai_traces collection per PRD Section 8.4 (AI-103, AI-106); T-016, T-023, T-025, and T-033 must all reuse this wrapper and must not build separate invocation paths of their own.
  4. Return values that fail enum validation are treated as invocation failures and retried; they must not pass silently (AI-102).
- **Verification**:
  1. Classification accuracy on the 30 Golden documents is no lower than 93% (at least 28 correct); the result is written into the evaluation tool.
  2. Across no fewer than 200 cumulative classification invocations, out-of-enum values occur 0 times.
  3. All 3 blurred documents are flagged for manual confirmation.
  4. Spot-check trace records: each contains input summary, output summary, elapsed time, and usage estimate.
- **Evidence**: Accuracy report, enum stress test output, trace samples.

### T-015 Classification Module Regression Hardening

- **Prerequisites**: T-014.
- **Objective**: Classification verification is incorporated into the evaluation tool metric group and the one-click test.
- **Implementation points**: Connect the T-014 accuracy and enum checks to the corresponding metrics in the evaluation tool; backfill the accuracy result into the requirements tracking checklist for FR-201 to FR-203.
- **Verification**:
  1. The evaluation tool's single-metric-group run (classification group) outputs the measured value and the pass verdict, consistent with T-014.
  2. The status of the three FRs in the requirements tracking checklist is updated to Verified.
- **Evidence**: Evaluation tool output, tracking checklist snapshot.

---

## Phase 3: Extraction and Normalization (T-016 to T-020)

### T-016 Activity Data Extraction Module

- **Prerequisites**: T-015.
- **Objective**: Implement structured extraction per the field table (PRD Section 4.3).
- **Implementation points**:
  1. Extraction results are produced strictly per the 17 fields of the field table in Section 4.3, and records are stored in the activity_records collection per PRD Section 8.4; missing fields are explicitly left empty, and fabrication is strictly prohibited (FR-301).
  2. Each extracted field carries a confidence between 0 and 1 (FR-303, AI-104).
  3. A single document may produce multiple records; a three-line-item invoice should produce 3 records (FR-304).
  4. Handwritten or low-quality scans must still be attempted for extraction and must not be judged as failures outright (FR-306).
  5. Use a Flash-tier model; structured output; complete invocation tracing.
- **Verification**:
  1. Comparison against the 30 Golden record answers: accuracy of the quantity and unit fields is no lower than 98%; the average across the five fields of quantity, unit, amount, date, and currency is no lower than 95%. The result is written into the evaluation tool.
  2. For the 5 documents with missing fields: all missing fields are empty, with no fabricated values.
  3. The three-line-item invoice produces exactly 3 records.
  4. Spot-check 20 records: per-field confidence is complete and all values fall between 0 and 1.
  5. At least 2 of the 3 handwritten documents produce valid records (at least the required fields including quantity and unit are non-empty).
  6. Construct a document containing no activity data (such as a pure instruction page); it produces zero records and the flow raises no error (PRD 3.1 Step 4).
- **Evidence**: Field-level comparison report, confidence spot-check table.

### T-017 Extraction Module Regression Hardening

- **Prerequisites**: T-016.
- **Objective**: Extraction verification is incorporated into the evaluation tool and the one-click test, and backfilled into the tracking checklist.
- **Implementation points**: Same pattern as T-015, connecting to the extraction metric group; backfill the status of FR-301 to FR-306.
- **Verification**: The evaluation tool's extraction metric group run output is consistent with T-016; the six checklist items are updated to Verified.
- **Evidence**: Evaluation tool output, tracking checklist snapshot.

### T-018 Unit, Location, and Transport Mode Normalization

- **Prerequisites**: T-017.
- **Objective**: Implement the normalization capability of PRD Section 4.4.
- **Implementation points**:
  1. Implement 10 unit conversion groups (3 mass, 3 energy, 2 volume, 2 distance), converting to base units; the intermediate process retains full precision, and conversion steps are written into the audit trail (FR-401).
  2. Origin and destination are normalized to a two-level structure of country/region plus city (FR-402).
  3. Transport mode falls within a closed enum of ten items (FR-403); enum validation failure triggers a retry.
  4. Currency is only identified and labeled; no exchange rate conversion is performed.
  5. Fields that are required for calculation but missing enter the gap list, driving the review-and-supplement entry point (3.1 Step 5, FR-1102).
- **Verification**:
  1. All 10 conversion groups pass one by one (against the conversion relationship table in Section 4.4).
  2. "new york city" and "New York" normalize to the same result.
  3. Across no fewer than 100 cumulative transport mode outputs, out-of-enum values occur 0 times.
  4. Take any record containing a conversion; the audit trail contains the values before and after conversion and a description of the conversion relationship.
  5. Construct a record missing the date; the gap list correctly lists that field.
- **Evidence**: Conversion test case output, normalization comparison, enum stress results, audit trail samples.

### T-019 Normalization Regression Hardening

- **Prerequisites**: T-018.
- **Objective**: Normalization verification is incorporated into the one-click test; backfill FR-401 to FR-403.
- **Verification**: The one-click test includes the 10 conversion groups and normalization cases and passes; the three checklist items are updated.
- **Evidence**: Test output, tracking checklist snapshot.

### T-020 Full-Chain Traceability (Gate G2)

- **Prerequisites**: T-019.
- **Objective**: Any activity record can be traced back to an in-file location in the source document, achieving G2.
- **Implementation points**:
  1. source_ref must resolve to a file that actually exists and to its in-file location (page, worksheet, or data row); references that fail to resolve count as invalid references and are included in the evaluation tool's veto metric.
  2. Provide a source file viewing entry point: given a record, retrieve the original file and locate the corresponding page or region (FR-106, FR-305).
  3. Perform a full reference scan over all Golden records once, and write the result into the evaluation tool.
- **Verification**:
  1. Full scan of the source_ref of the 30 Golden records: 100% resolution success rate, 0 invalid references.
  2. Sample 10 records, retrieve the source file for each, and the located position matches the origin.
  3. Check the G2 exit conditions: Golden set field accuracy meets targets, and the traceability chain is complete and jumpable — once they hold, record "G2 passed".
- **Evidence**: Reference scan report, G2 verdict record.

---

## Phase 4: Factor Matching and Calculation (T-021 to T-030)

### T-021 Vector Index and Dual-Channel Recall

- **Prerequisites**: T-020.
- **Objective**: Implement factor library vector indexing and keyword plus semantic dual-channel recall (PRD 4.7 Stage 1, FR-604).
- **Implementation points**:
  1. Use the official embedding model to generate vectors for all factors and store them (Section 8.4 emission_factors includes vector data); embedding invocations likewise go through the unified wrapper and write trace records (the "every invocation" scope of AI-106 and FR-1202).
  2. Channel one: keyword and structured field matching; channel two: semantic similarity retrieval. The two channels can be toggled independently for controlled experiments.
  3. After merging and deduplication, candidates are kept between 5 and 15: if fewer than 5, automatically relax the threshold and retry with logging; if still insufficient after the retry, proceed to the next stage with the actual count and mark it "insufficient recall"; if more than 15, truncate by relevance.
- **Verification**:
  1. Recall the Golden 40 matching cases one by one; all candidate counts fall within the 5 to 15 range (or are correctly marked as insufficient recall).
  2. Run the 40 cases once each in the three modes — channel one only, channel two only, and dual channel — with non-empty candidate lists in all three modes and the mode recorded in the logs.
  3. Construct an obscure record to trigger the insufficient-recall path, and verify the relaxed retry and labeling behavior.
  4. Recall remains executable when offline (vectors and factors are localized).
- **Evidence**: three-mode recall statistics, insufficient-recall case log.

### T-022 Recall Regression Hardening

- **Prerequisites**: T-021.
- **Goal**: incorporate recall verification into one-click testing; backfill items related to FR-604.
- **Verification**: the one-click test includes dual-channel switch comparison cases and passes; Top-3 hit rate (the proportion of cases in which the optimal factor appears among the candidates) is no lower than 95% (at least 38 out of 40), written into the evaluation tool's reference metrics.
- **Evidence**: test output, Top-3 statistics.

### T-023 Boundary Determination Module

- **Prerequisites**: T-022.
- **Goal**: implement Scope and 15-category determination (PRD Section 4.5).
- **Implementation Notes**:
  1. Output Scope 1, 2, 3 levels; Scope 3 is refined to one of the 15 categories, outputting the number and English name; the determination carries an English rationale (FR-501 to FR-503).
  2. Closed enumeration: a value outside the 15 categories is treated as a failure and retried.
  3. GWP version rule: preferentially recall the factor version consistent with the task; when only another version exists, the UI explicitly flags the version mismatch, uncertainty is downgraded to at least Medium, and the report's methodology section includes a statistical disclosure (Section 4.5).
  4. Highly duplicated records are flagged as suspected duplicates (FR-504).
- **Verification**:
  1. Accuracy on 10 level Golden records is no lower than 90% (at least 9 correct).
  2. Accuracy on 12 Scope 3 category records is no lower than 90% (at least 11 correct).
  3. All 22 determination rationales are non-empty and in English.
  4. Construct a record with only cross-version factors: all three requirements (flagging, downgrade, statistics) are triggered.
  5. Construct duplicate records that are flagged as suspected duplicates.
- **Evidence**: determination accuracy report, GWP cross-version case log.

### T-024 Boundary Determination Regression Hardening

- **Prerequisites**: T-023.
- **Goal**: incorporate boundary metrics into the evaluation tool; backfill FR-501 to FR-504.
- **Verification**: the evaluation tool's Scope determination metric group output matches T-023 (levels and categories counted separately); four entries in the tracking list are updated.
- **Evidence**: evaluation tool output, tracking list snapshot.

### T-025 Inference Selection Module

- **Prerequisites**: T-024.
- **Goal**: implement inference-based selection for the three-stage pipeline (PRD 4.7, Stage 2).
- **Implementation Notes**:
  1. Use the Pro-tier model; the input is the structured activity description and the candidate factor list; the output has five items: selected factor ID, confidence, English rationale, key semantic features (2 to 4 items), and the runner-up candidate ID.
  2. The selected ID must exist in the candidate list; returning an ID outside the candidates is treated as a call failure and retried, and must not be used directly (AI-204).
  3. The rationale must be at least 40 English words and must explain why the runner-up candidate was not chosen (FR-703).
  4. Retain the runner-up candidate to support manual re-selection (FR-705); match results are stored in the matches collection per Section 8.4.
  5. End-to-end matching for a single record must not exceed 8 seconds (FR-701).
- **Verification**:
  1. Top-1 accuracy on 40 Golden cases is no lower than 85% (at least 34 correct), written into the evaluation tool.
  2. Reference validity is 100% across the full set: every selected ID can be found in both the candidate list and the factor library.
  3. Sample-check 20 rationales: all are at least 40 words and contain a comparison against the runner-up candidate.
  4. Deliberately inject a simulated response containing an out-of-candidate ID, and verify it is rejected and retried.
  5. Time 10 random records; all complete within 8 seconds.
- **Evidence**: matching accuracy report, rationale sample-check table, timing records.

### T-026 Selection Regression Hardening

- **Prerequisites**: T-025.
- **Goal**: incorporate matching metrics into the evaluation tool; backfill FR-701 to FR-705.
- **Verification**: the evaluation tool's factor matching metric group (Top-1, Top-3) output matches T-025 and T-022; five entries in the tracking list are updated.
- **Evidence**: evaluation tool output, tracking list snapshot.

### T-027 Uncertainty Grading and Unit-Consistency Self-Check

- **Prerequisites**: T-026.
- **Goal**: implement rule-based grading and the self-check (PRD 4.7 Stage 3, Section 6.4).
- **Implementation Notes**:
  1. Grading is a rule engine that does not call a model: first grade High (confidence below 0.65, or 2 or more inferred fields, or unit consistency requiring a second conversion), then Medium (confidence at or above 0.65 but below 0.85, or 1 inferred field), otherwise Low.
  2. High uncertainty forces the record into the review queue. When all candidate factor confidences are below the configured confidence threshold (default 0.65), the record is flagged "No High-Confidence Factor", the UI presents a conservative reference suggestion based on the highest-valued candidate factor, it must not be adopted automatically without human confirmation, and it is forced into the review queue (PRD Section 3.2).
  3. Unit-consistency self-check: verify whether the selected factor's activity data unit and the normalized unit are convertible; the self-check result is displayed as an explicit field and must not be handled implicitly; a failure automatically downgrades to High uncertainty (AI-301 to AI-303).
  4. The three-level distribution statistics are provided for report use (FR-704).
- **Verification**:
  1. Use constructed data to cover all rule branches (at least 3 cases each for Low, Medium, and High, including a case where multiple conditions are hit simultaneously and the most severe is taken); all grading results conform to the rules.
  2. Construct 3 self-check failures with non-convertible units; all are downgraded to High and enter the review queue.
  3. The self-check result field is visible in the record data.
  4. The three-level distribution statistics are output and the sum of the three counts equals the total record count.
  5. Construct a record in which all candidate confidences are below the threshold: the three behaviors appear — the "No High-Confidence Factor" flag, the conservative reference suggestion, and forced review.
- **Evidence**: grading case table, self-check failure cases, distribution statistics.

### T-028 Grading and Self-Check Regression Hardening

- **Prerequisites**: T-027.
- **Goal**: incorporate grading rule cases into one-click testing; backfill FR-704 and AI-301 to AI-303.
- **Verification**: the one-click test includes grading branch cases and passes; the unit self-check runs in full on the 40 Golden matching cases, all pass, and the self-check records are visible (AI-301 acceptance criteria); the tracking list is backfilled.
- **Evidence**: test output, tracking list snapshot.

### T-029 Calculation and Aggregation Engine

- **Prerequisites**: T-028.
- **Goal**: implement emissions calculation, aggregation, and the audit trail (PRD Section 4.8).
- **Implementation Notes**:
  1. Calculation convention: single-record emissions = normalized activity data × factor value; when a factor does not include GWP conversion, the corresponding coefficient must be multiplied separately and written into the audit trail.
  2. Precision rules: intermediate steps retain full floating-point precision; aggregation first sums the unrounded details and then rounds the result once; the presentation layer converts to tonnes of CO2 equivalent to three decimal places, rounded half up; the sum of line items and the total are exactly consistent at three decimal places.
  3. Four-dimensional aggregation: Scope, category, supplier, and month (FR-802); Top emission sources default to Top 10 in descending order (FR-803).
  4. Every conversion, GWP conversion, and multiplication is written into the audit trail and can be expanded for viewing (FR-804, Section 8.4 calculations, audit_trail).
- **Verification**:
  1. All 10 known-answer calculation problems are correct (compared at the presentation layer's three decimal places with zero tolerance), written into the evaluation tool; the calculation accuracy must be 100%.
  2. The totals for each of the four dimensions are exactly consistent with the grand total (at three decimal places).
  3. Deliberately construct counterexample data that rounds before summing, and verify the engine output still computes per the correct rules (to prevent implementation drift).
  4. The Top 10 ranking is consistent with the detail ordering.
  5. Pick any record containing GWP conversion; its audit trail includes the multiplication chain and the coefficient source.
- **Evidence**: calculation problem results, aggregation consistency report, audit trail samples.

### T-030 Calculation Regression Hardening (Gate G3)

- **Prerequisites**: T-029.
- **Goal**: incorporate calculation and aggregation metrics into the evaluation tool; achieve G3.
- **Verification**:
  1. The evaluation tool's two outputs — calculation accuracy and aggregation consistency — meet their targets (100% and zero inconsistencies).
  2. Verify the G3 exit criteria: factor matching accuracy meets the target, calculation accuracy is 100%, and aggregation consistency passes — once satisfied, record "G3 Passed".
  3. Backfill FR-801 to FR-805 in the tracking list.
- **Evidence**: evaluation tool output, G3 determination record.

---

## Stage 5: Scenarios, Reporting, and Review (T-031 to T-037)

### T-031 Emission Reduction Scenario Engine

- **Prerequisites**: T-030.
- **Goal**: implement automatic calculation of the three scenarios (PRD Section 4.9).
- **Implementation Notes**:
  1. S-1: replace air freight (general cargo, cold chain) with sea freight (container) factors and road freight with rail factors, then re-run matching and calculation; other transport modes are unaffected.
  2. S-2: re-calculate all records of the top three suppliers by emissions using the lowest-valued factor within the same activity category.
  3. S-3: replace high-emission raw material purchases with available low-carbon alternative factors; records with no alternative remain unchanged and are noted individually.
  4. Scenarios with zero applicable records are handled as zero affected records, displayed truthfully with the reason explained, and must not error or be hidden.
  5. Each scenario outputs: absolute reduction, percentage, the list of affected records, and a feasibility analysis of at least 80 English words (including assumptions and limitations); adjusting the substitution-ratio parameter and refreshing is supported (FR-904); results are stored in the scenarios collection per Section 8.4.
- **Verification**:
  1. All three scenarios are produced automatically on the sample dataset, with no user input required.
  2. The three scenarios' values are reproducible: manually re-calculate 5 affected records per the substitution rules, and they match the engine output.
  3. Construct a task with no air freight or road records; S-1 outputs zero affected records with the reason explained, and does not error.
  4. All three feasibility analyses are at least 80 words and explicitly mention assumptions.
  5. After adjusting the substitution-ratio parameter, the results refresh and are consistent with the parameter.
- **Evidence**: three scenario result sets, recomputation comparison, zero-applicability case.

### T-032 Scenario Regression Hardening

- **Prerequisites**: T-031.
- **Goal**: incorporate scenario verification into one-click testing; backfill FR-901 to FR-904.
- **Verification**: the one-click test includes three-scenario computability and zero-applicability cases and passes; four entries in the tracking list are updated.
- **Evidence**: test output, tracking list snapshot.

### T-033 Report Generator

- **Prerequisites**: T-032.
- **Goal**: generate an English report with a ten-chapter structure (PRD Section 4.10).
- **Implementation Notes**:
  1. Strictly follow the ten-chapter order: cover, executive summary, accounting methodology and boundary, emissions breakdown, activity details, uncertainty statement, emission reduction scenario recommendations, Appendix 1 factor list, Appendix 2 traceability index, and disclaimer.
  2. Write every entry from the Section 4.10 content list chapter by chapter; any missing item counts as non-compliant; in the 15-category breakdown table, categories that did not occur display as zero rather than being omitted; the methodology chapter includes cross-GWP-version statistics (stating zero explicitly as well); the report contains an excluded-items list block (FR-1104; when there is no excluded data the block is an empty table, and the full behavior with data is verified in T-036).
  3. Every numerical conclusion carries a citation anchor that jumps to the source within the Web reading view; the PDF presents them via the Appendix 2 index (FR-1002).
  4. Hallucination governance: citation anchors must point to documents or factors that actually exist; carried-over values and stitched-together inferred values without citations must not be output (AI-201 to AI-203).
  5. The report body is generated with the Pro-tier model as structured output; content is stored in the reports collection per Section 8.4.
- **Verification**:
  1. Generate a report on the sample dataset: all ten chapters are present, in the correct order, and every chapter content item in the checklist is matched.
  2. A parser scans all numerical conclusions; anchor coverage is 100%.
  3. A full scan of anchor validity shows 0 invalid citations (written into the evaluation tool as a veto metric).
  4. Deliberately inject 5 invalid citations (cleared after testing); all are detected.
  5. Each of the three core recommendations is at least 30 English words; the disclaimer exists; the cover contains two statements: GWP version and factor year distribution.
- **Evidence**: chapter checklist, anchor scan report, injection test record.

### T-034 Report Regression Hardening

- **Prerequisites**: T-033.
- **Goal**: incorporate report metrics into the evaluation tool; backfill FR-1001 to FR-1006.
- **Verification**: the evaluation tool's citation coverage and invalid citation count outputs meet their targets (100% and 0); six entries in the tracking list are updated.
- **Evidence**: evaluation tool output, tracking list snapshot.

### T-035 PDF and CSV Export

- **Prerequisites**: T-034.
- **Goal**: implement deliverable exports (FR-1003, FR-1004).
- **Implementation Notes**:
  1. PDF export: includes a header, page numbers, and a table of contents, at least 6 pages, directly deliverable externally; export time does not exceed 10 seconds (NFR-104).
  2. CSV export: at least two CSV files — activity details and category summary — with no encoding corruption (UTF-8 compatible handling).
  3. Export file paths are written back to the reports collection.
- **Verification**:
  1. Export the PDF 5 times consecutively; each has at least 6 pages with a complete header, page numbers, and table of contents, and each takes no more than 10 seconds.
  2. Both CSVs open in a spreadsheet tool without corruption; the detail row count matches the activity record count; the category summary total is consistent with the grand total.
  3. Traceability index entries in the PDF correspond one-to-one with report data points (sample 10 for verification).
- **Evidence**: PDF and CSV samples, timing records.

### T-036 Review Queue Module

- **Prerequisites**: T-035.
- **Goal**: implement the closed review loop (PRD Section 4.11).
- **Implementation Notes**:
  1. Display pending records centrally, sorted High, Medium, Low (High first) (FR-1101); review queue items are stored in the review_items collection per PRD Section 8.4.
  2. Four fields are editable — quantity, unit, transport mode, and origin/destination — and missing required fields can be filled in; saving triggers a recalculation (FR-1102).
  3. Manually specified factors take priority over automatic matching and are explicitly labeled "Manually Specified" (FR-1103).
  4. Records can be marked "Excluded from Accounting" with an English reason filled in; after exclusion they are not counted in the total, and the report lists the excluded items (FR-1104).
  5. Review actions record the operator and timestamp in the audit trail (FR-1105).
  6. Batch recalculation is supported, with aggregation and charts refreshed synchronously (FR-706).
- **Verification**:
  1. Construct a task containing several records each at High, Medium, and Low; the queue sorts High first.
  2. After changing one record's quantity, that record's emissions, its category subtotal, and the grand total all refresh and match a manual recalculation.
  3. After filling in a record's missing date, the gap list updates.
  4. After manually re-selecting a factor, the result updates and carries the "Manually Specified" label.
  5. After excluding a record and filling in the reason, the total decreases, and the report contains the excluded-items list.
  6. The audit trail contains the operator and timestamp of the review action.
  7. Trigger one batch recalculation; all records are recalculated, and aggregation and charts refresh synchronously (FR-706).
- **Evidence**: before-and-after recalculation comparison, exclusion list, audit samples.

### T-037 Review Loop Regression Hardening (Gate G4)

- **Prerequisites**: T-036.
- **Goal**: incorporate review cases into one-click testing; achieve G4.
- **Verification**:
  1. The one-click test includes review-triggered recalculation and exclusion cases and passes.
  2. After the change, regenerate the report; the report and all chart data refresh synchronously and consistently.
  3. Verify the G4 exit criteria: a complete-chapter report can be generated and exported, the three scenarios calculate correctly, and citation coverage is 100% — once satisfied, record "G4 Passed".
- **Evidence**: test output, G4 determination record.

---

## Stage 6: Frontend (T-038 to T-042)

### T-038 Frontend Skeleton and P1, P2

- **Prerequisites**: T-037.
- **Goal**: build the frontend skeleton and implement the home page and upload page (PRD Section 9.1, P1 and P2).
- **Implementation Notes**:
  1. P1: product name, one-sentence value proposition (verbatim from PRD 1.3), and a task creation form (entity name, time range, GWP version — choose one); the backend provides a task creation API, and task records are stored in the tasks collection per PRD Section 8.4.
  2. P2: drag-and-drop area, file list with seven status labels, overall progress (including the current processing stage and the number completed, FR-1201), and a one-click sample data load button.
  3. Implement the interaction guidelines: every action gets immediate visual confirmation; operations over 3 seconds show an in-progress indicator; long tasks over 5 seconds can be cancelled; destructive actions require secondary confirmation (Section 9.2).
  4. All copy is in English; light professional style.
- **Verification**:
  1. The task creation form has all three fields and GWP is a choose-one control; after submission a task ID is generated and it jumps to P2.
  2. Drag-and-drop upload the 20 files of the sample set; status labels advance correctly with the processing stage, with no hangs (integrating with the T-011 state machine).
  3. The one-click sample data load button triggers the full pipeline (this step only verifies the trigger and progress display; the full sequence is in T-044).
  4. Automated UI test: uploading an 11 MB file produces an English oversize message.
- **Evidence**: UI test output, task creation records.

### T-039 P3 Activity Record Details, P4 Factor Match Viewer

- **Prerequisites**: T-038.
- **Goal**: implement the two pages for record details and match viewing (PRD Section 9.1).
- **Implementation Notes**:
  1. P3: record table; each record expands to show per-field confidence; an entry to view the original file (including highlight location); factor match results and rationale; uncertainty labels; a review entry; and an expandable view of the record's complete audit calculation steps (FR-804's UI viewing requirement).
  2. P4: candidate factor list, best vs. runner-up comparison, and a manual re-selection entry (re-selecting triggers recalculation).
  3. Uncertainty levels are dual-encoded with both color and line-art icons, with color not the sole carrier (NFR-404).
- **Verification**:
  1. Expand any record; all 17 fields and per-field confidence are visible.
  2. Click to view the original file; the source file view shows the corresponding location or highlight.
  3. Match rationale, key semantic features, and the runner-up candidate are visible in both P3 and P4.
  4. After re-selecting a factor in P4, the record result and aggregation refresh.
  5. After grayscaling the UI screenshot, the three levels are still distinguishable by icon (automated check: level icon elements exist and differ).
  6. Expand any record's audit steps area; every conversion step from the raw value to emissions is visible.
- **Evidence**: UI test output, grayscale check results.

### T-040 P5 Chart Dashboard, P6 Scenario Comparison

- **Prerequisites**: T-039.
- **Goal**: implement the dashboard and scenario page (PRD Section 9.1).
- **Implementation Notes**:
  1. P5: three-Scope breakdown chart, category breakdown, supplier Top, monthly trend, and dimension filters; all chart values are consistent with the calculation engine's output.
  2. P6: three scenario cards, side-by-side comparison with the baseline, absolute and percentage reduction, an expandable feasibility explanation area, and substitution-ratio parameter adjustment.
- **Verification**:
  1. P5's chart values are exactly consistent with the backend aggregation API's response (sample 3 dimensions for verification).
  2. After switching dimension filters, charts refresh and are consistent with the corresponding filtered aggregation.
  3. P6's three scenario values are consistent with the T-031 engine output; percentages are computed correctly (absolute amount divided by baseline).
  4. After adjusting the substitution ratio, P6 refreshes in real time.
- **Evidence**: chart vs. API comparison records.

### T-041 P7 Report, P8 Review Queue, P9 Trace Panel

- **Prerequisites**: T-040.
- **Goal**: complete the remaining three pages (PRD Section 9.1).
- **Implementation Notes**:
  1. P7: ten-chapter reading view, citation anchor clicks that jump to the source, and export entries (PDF, CSV).
  2. P8: sorting by uncertainty, field editing and gap filling, factor re-selection, and exclusion marking (integrating with T-036).
  3. P9: AI call records per stage, filterable by stage, including input summary, output summary, duration, and usage estimate (FR-1202).
- **Verification**:
  1. P7 has all ten chapters; randomly clicking 10 anchors all jump to the correct source.
  2. P7's export button produces the two file types from T-035.
  3. P8's operations match T-036's verified behaviors (sample one field edit and one exclusion each).
  4. After filtering P9 by stage, only the selected stage's records show; sample 5 to verify field completeness.
- **Evidence**: UI test output for the three pages.

### T-042 Frontend Cross-Cutting Verification

- **Prerequisites**: T-041.
- **Goal**: complete cross-page usability, accessibility, and state persistence verification (PRD Sections 5.4 and 9.2).
- **Implementation Notes**:
  1. Complete the main flow with the keyboard alone: create task, upload, view records, enter review, export report.
  2. Page refresh recovery: task state, file state, and completed results are not lost (NFR-203).
  3. The first-screen value proposition and main interaction are visible on the first screen (NFR-401's unattended alternative check; the real-user 5-second test is left to the G6 manual review item).
  4. Site-wide copy proofreading in English (NFR-402's automated portion: scan UI strings for non-English fragments).
- **Verification**:
  1. Automated end-to-end test: complete the main flow's full chain using keyboard events only, with zero mouse operations, successfully.
  2. Refresh the page mid-processing; state and completed data fully recover and the test case passes.
  3. The first screen contains the value proposition copy and the task creation entry.
  4. The UI string scan finds no non-English remnants.
  5. Long tasks over 5 seconds can be cancelled in the UI; after cancelling, the flow interrupts and state remains consistent; destructive actions (such as excluding a record) show secondary confirmation (PRD Section 9.2).
- **Evidence**: end-to-end test output, refresh recovery records.

---

## Stage 7: Deployment and Final Acceptance (T-043 to T-051)

### T-043 Cloud Deployment and Anonymous Authentication

- **Prerequisites**: T-042.
- **Goal**: deploy to the specified infrastructure (PRD 2.1 M-3, M-5, Section 8.1).
- **Implementation Notes**:
  1. Deploy the backend to Cloud Run (with auto-scaling support, allowing scale-to-zero), the frontend to Firebase Hosting, files into Firebase Storage, data into Firestore, and authentication via Firebase Auth anonymous login.
  2. Environment variables are fully configured in the cloud (the 11 items in Section 8.3) and are not stored in the database.
  3. Entering the public URL automatically completes anonymous login, with no registration or credential entry required.
  4. Logging and trace tracking are integrated with Cloud Logging and Cloud Trace.
  5. Configure a basic access rate limit for the public URL (NFR-303's implementation point, verified in T-046).
- **Verification**:
  1. The public URL is accessible, and under anonymous status one can go from task creation to report export (the full flow runs through once from a judge's perspective).
  2. The number of cloud configuration items matches Section 8.3.
  3. The repository secret scan has zero hits.
  4. Structured logs are queryable in Cloud Logging, and request traces are queryable in Cloud Trace.
- **Evidence**: public full-flow record, configuration list, scan results.

### T-044 Sample Data One-Click Full-Flow Verification

- **Prerequisites**: T-043.
- **Goal**: the sample dataset completes the full flow within 3 minutes in the online environment (FR-1203, NFR-101).
- **Implementation Notes**: on the public URL under anonymous status, click the one-click sample data load button, timing the entire process from load to report output, taking the P90 across consecutive runs.
- **Verification**:
  1. Run 10 consecutive times; the P90 end-to-end duration does not exceed 3 minutes, and the result is written into the evaluation tool.
  2. The report produced by each run has all ten chapters and valid citations.
  3. During processing, P2's progress advances continuously without regression (FR-1201).
- **Evidence**: 10 timing records and the P90 calculation record.

### T-045 Performance and Concurrency Stress Test

- **Prerequisites**: T-044.
- **Goal**: verify all performance metrics (PRD Section 5.1).
- **Implementation Notes**: execute item by item: NFR-102 (per-document cost accumulated by usage and public unit prices), NFR-103 (first screen averaged over 5 runs), NFR-104 (already covered in T-035; retest online), NFR-105 (3 concurrent tasks).
- **Verification**:
  1. Measure the per-document AI processing cost based on a complete run of the sample dataset; it must not exceed USD 0.03, with the calculation process and unit price sources documented (PRD Section 10.1 convention: cost metrics are computed on the sample dataset).
  2. The first-screen load averaged over 5 runs does not exceed 3 seconds.
  3. All 3 concurrent tasks complete with no server-side errors.
  4. All results are written into the evaluation tool.
- **Evidence**: cost calculation table, first-screen timings, stress test output.

### T-046 Fault Tolerance, Security, and Privacy Testing

- **Prerequisites**: T-045.
- **Goal**: verify reliability and security requirements (PRD Sections 5.2 and 5.3).
- **Implementation Notes**: execute item by item: NFR-201 (mix in 3 corrupted files), NFR-202 (simulate a timeout, retry twice, then mark the failed object), NFR-204 (machine-readable error codes with English descriptions), NFR-301 (cross-task access denied), NFR-303 (rate limiting exists).
- **Verification**:
  1. In a 20-file batch with 3 corrupted files mixed in, the remaining 17 all succeed.
  2. Simulated timeout: after exactly two retries the failed object is clearly marked, with the error code and English description complete.
  3. Using task A's credentials to access task B's files and records is denied in all cases.
  4. High-frequency requests trigger a rate-limit response.
  5. The error code list covers all known failure types and is written into the README draft.
- **Evidence**: four categories of test output, error code list.

### T-047 Full Evaluation Tool Run (Gate G5)

- **Prerequisites**: T-046.
- **Goal**: the evaluation tool runs fully online; achieve G5.
- **Verification**:
  1. The full run outputs a single complete table with measured values and pass/fail judgments for all 11 metrics in Section 10.1; all pass except Top-3 (a reference item).
  2. The invalid citation count is 0; the overall verdict is pass.
  3. Two result files — machine-readable and human-readable — are written to disk.
  4. Verify the G5 exit criteria: deployment succeeds, the public URL is accessible (accessed one by one via at least 3 different network exits or proxy regions; when the execution environment cannot satisfy this, degrade to a single-exit verification and list "three-network-environment live test" as a pending manual item), and the sample data runs end-to-end one-clickly and produces a report — once satisfied, record "G5 Passed".
- **Evidence**: full evaluation tool output, three-network access records, G5 determination record.

### T-048 Code Size and Repository Hygiene

- **Prerequisites**: T-047.
- **Goal**: meet the code size and engineering hygiene requirements (PRD metadata, NFR-504, Section 8.2).
- **Implementation Notes**: use a statistics tool to count first-party lines of code (excluding dependencies, generated artifacts, and data files); check the prohibitions (no non-Google generative model calls, no deployment outside Cloud Run and Firebase, no additional paid third-party services).
- **Verification**:
  1. First-party code does not exceed 7,000 lines; if it does, refactor to slim it down without removing features or tests and retest, and in no case may it exceed the hard cap of 10,000 lines.
  2. Add 10 factors to the factor data file and restart the service; the new factors are retrievable with zero code changes throughout (NFR-501).
  3. After replacing the extraction and inference model model names in the central configuration, the system runs normally (NFR-502).
  4. All three prohibitions are checked one by one with zero violations.
  5. The line-count methodology and results are documented.
- **Evidence**: line-count report, prohibition checklist.

### T-049 English README

- **Prerequisites**: T-048.
- **Goal**: produce a complete English README (PRD 2.2 D-4, 8.3, 10.3).
- **Implementation Notes**: chapters include: project and track statement (Sustainability & Social Impact, visible on the home first screen), value proposition, architecture description, deployment steps (the full Cloud Run and Firebase process), environment variable table (all 11 items with default values and meanings), data source statement (source names, version years, public links), evaluation methodology and this full evaluation's results (citing T-047's output), error code list, a statement that data is not used for model training (NFR-302), and Gen AI usage notes (model division of labor and toolchain depth, M-4).
- **Verification**:
  1. All ten items above exist individually.
  2. The environment variable table corresponds one-to-one with the actual configuration.
  3. The evaluation results are consistent with T-047's on-disk files.
  4. The full text is in English and passes a grammar self-check.
- **Evidence**: README file, checklist.

### T-050 Final Acceptance Checklist Execution (Gate G6)

- **Prerequisites**: T-049.
- **Goal**: execute the PRD Section 10.3 final acceptance checklist item by item; achieve G6.
- **Implementation points**: Execute the 8 functional acceptance items, 5 competition-compliance acceptance items, and 5 engineering acceptance items one by one and retain evidence; the 4 video acceptance items belong to T-051's script preparation and subsequent manual recording, and are marked here as pending manual work; the NFR-401 real-person 5-second test is marked as a pending manual review item.
- **Verification**:
  1. All 8 functional acceptance items and 5 engineering acceptance items pass automated execution with complete evidence; of the 5 competition-compliance items, 4 pass automated verification, and for the language-compliance item the UI, report, and README parts pass automated verification, while its video subtitle part is verified against the T-051 English script (final manual verification after recording).
  2. The pending manual items (4 video acceptance items, 1 real-person usability test, 1 final English verification of video subtitles) are explicitly listed in the to-do list with execution instructions.
  3. Check the engineering-side G6 exit criteria: README complete, all automatable items in the acceptance checklist executed, deck script and video script ready — once satisfied, record "G6 engineering portion passed"; final achievement of the PRD G6 additionally requires manual completion of video recording and deck PDF export (already listed in the pending manual list), and only after completion may "G6 passed" be recorded.
- **Evidence**: item-by-item checked records of the acceptance checklist, list of pending manual items.

### T-051 Submission Material Content Production

- **Prerequisites**: T-050.
- **Goal**: Produce the English deck script (10 to 14 pages), a 3-minute demo video script (including voice-over script and subtitle script), and the video shooting storyboard description.
- **Implementation points**:
  1. The deck's first page uses the value proposition and track name from PRD Section 1.3 verbatim; the content covers: problem, solution, Gen AI depth (three-stage pipeline for semantic factor matching), technical architecture, evaluation results (citing T-047), and impact comparison (cost and labor hours).
  2. The video script is designed around the four video acceptance items in PRD 10.3: a 15-second opening that clearly states the value figures; a continuous process from drag-and-drop to report; one comparison case where the right factor is chosen only because of semantic understanding (selected from the third group of Golden boundary-inference cases); and one demonstration of clicking citation tracing.
  3. All materials label the track: Sustainability & Social Impact (consistent in three places: deck first page, README first screen, video end credits).
  4. Actual recording, video upload, and deck PDF export are manual steps; this task is considered complete once the scripts are ready.
- **Verification**:
  1. The deck script has a complete structure of 10 to 14 pages, with the first page containing the value proposition and track label.
  2. The estimated video script duration is within 3 minutes, and all four required scenes are scheduled with the corresponding demo data noted.
  3. The track label text in all three places is exactly identical.
  4. Both the voice-over script and the subtitle script are in English.
- **Evidence**: deck script, video script, storyboard description.

---

## Appendix: Requirement Coverage Cross-Reference (for audit)

| PRD Requirement Group | Implementation Task | Verification Task |
|---|---|---|
| FR-101 to FR-106 | T-011, T-013 | T-012 |
| FR-201 to FR-203 | T-014 | T-015 |
| FR-301 to FR-306 | T-016 | T-017 |
| FR-401 to FR-403 | T-018 | T-019 |
| FR-501 to FR-504 | T-023 | T-024 |
| FR-601, FR-602, FR-603, FR-605, FR-606 | T-005 to T-007 | T-006, T-007 |
| FR-604 | T-021 | T-022 |
| FR-701 to FR-706 | T-021, T-025, T-027, T-036 | T-022, T-026, T-028, T-036 |
| FR-801 to FR-805 | T-029 | T-030 |
| FR-901 to FR-904 | T-031 | T-032 |
| FR-1001 to FR-1006 | T-033, T-035 | T-034, T-035 |
| FR-1101 to FR-1105 | T-036 | T-037 |
| FR-1201 to FR-1203 | T-038, T-041 | T-042, T-044 |
| NFR-101 to NFR-105 | the various architecture tasks | T-044, T-045 |
| NFR-201 to NFR-204 | T-002, T-011, T-014, etc., per module | T-046, T-042 |
| NFR-301 to NFR-304 | T-002, T-043 | T-046, T-049 |
| NFR-401 to NFR-404 | T-038 to T-041 | T-042, T-050 |
| NFR-501 to NFR-504 | T-002, T-006 | T-048, T-007 |
| AI-101 to AI-106, AI-201 to AI-204, AI-301 to AI-303 | all model modules from T-014 onward | the verification items in T-014 to T-034 |
| EV-1 to EV-6 | T-004 | T-047 |
| M, D, L compliance items | T-043, T-049, T-051 | T-047, T-050 |
| 7.1 to 7.3 datasets | T-008 to T-010 | T-008 to T-010 |

At the end of execution, all 57 FRs, 21 NFRs, and 13 AI constraints in the requirement tracking list must be in "Verified" status; if any single item is not "Verified", the delivery is considered incomplete.

---

End of document. The executor starts from T-001 and proceeds in strict serial order; **a task that has not passed verification must not proceed to the next task**; the verification evidence for each step is written to disk in the progress directory, until T-051 is complete and "G6 engineering portion passed" is recorded in the progress log; only after the pending manual list is handed over to the team and completed may "G6 passed" be finally determined.
