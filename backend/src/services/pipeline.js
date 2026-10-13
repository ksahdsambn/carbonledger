// Pipeline orchestrator: chains ingestion stages per PRD 3.1 (classify ->
// extract -> normalize -> boundary -> match -> assess -> calculate -> review
// -> aggregate -> scenarios -> report). Works in mock mode for offline
// development; real adapter produces the auditable metrics.
import { log } from '../logging.js';
import { AppError } from '../errors.js';
import { setDocumentStatus, FILE_STATUSES } from './fileService.js';
import { buildUnitsForDocument } from './documentUnits.js';
import { classifyUnit } from './classification.js';
import { extractRecords, decideBoundary, selectFactor, markSuspectedDuplicates } from './pipelineModelCalls.js';
import { normalizeRecord } from './normalization.js';
import { recallCandidates, buildSemanticIndex } from './recall.js';
import { assessRecord } from './uncertainty.js';
import { computeEmission, aggregate, topEmitters } from './calculation.js';
import { computeScenarios } from './scenarios.js';
import { assembleReport } from './reportService.js';
import { openReviewForTask } from './reviewQueue.js';
import { listFactors } from './factorLibrary.js';

async function withStatus(store, taskId, docId, status, fn) {
  if (docId) await setDocumentStatus(store, taskId, docId, status);
  try {
    return await fn();
  } catch (err) {
    // Any processing failure marks the document failed so a task never stalls
    // in a non-terminal state (FR-1201, NFR-202). A rejected transition here
    // means the document already reached a terminal state, so it is ignored.
    if (docId) {
      try { await setDocumentStatus(store, taskId, docId, 'failed'); } catch { /* already terminal */ }
    }
    throw err;
  }
}

/**
 * @param {object} o
 * @param {Map<string, object>} o.mockCatalog filename -> {classification, records[]}
 *        (offline development only; ignored in real adapter mode)
 */
export async function runPipeline({ store, storage, taskId, mockCatalog = new Map() }) {
  const startedAt = Date.now();
  const task = await store.get('tasks', taskId);
  if (!task) throw new AppError('ERR_TASK_NOT_FOUND', { task_id: taskId });
  const indexT0 = Date.now();
  await buildSemanticIndex({ store, taskId });
  const factorsById = Object.fromEntries((await listFactors(store)).map((f) => [f.factor_id, f]));
  const indexMs = Date.now() - indexT0;

  const docs = (await store.query('documents', 'task_id', taskId)).filter((d) => d.status !== 'discarded');
  const docMs = [];

  // Documents are mutually independent, so they are processed by a bounded
  // worker pool (NFR-101: 20 documents end-to-end inside the 3-minute budget).
  // Each worker owns its accumulators and results are merged back in document
  // order, so the assembled report stays reproducible run to run.
  async function processDocument(doc) {
    const recordsOut = [];
    const calcsOut = [];
    const matchesOut = [];
    if (doc.status === 'completed') return { records: recordsOut, calcs: calcsOut, matches: matchesOut };
    await withStatus(store, taskId, doc.id, 'parsing', async () => {
      let units = await store.query('document_units', 'document_id', doc.id);
      if (units.length === 0) {
        const fresh = await buildUnitsForDocument({ store, storage, doc });
        units = fresh;
      }
      const mockMeta = mockCatalog.get(doc.original_filename) ?? {};
      const perDocRecords = [];
      for (const unit of units) {
        // --- classification ---
        let current = unit;
        if (!current.doc_type) {
          let bytes = await storage.get(unit.representation_path);
          if (doc.format !== 'pdf') bytes = await storage.get(doc.storage_path);
          if (mockMeta.classification) current = { ...unit, doc_type_hint: mockMeta.classification };
          current = await classifyUnit({
            traceStore: store, taskId, unit: current,
            representationBytes: bytes, sourceFormat: doc.format, filename: doc.original_filename,
          });
        }
        if (current.needs_manual_confirmation && !mockMeta.records) {
          log.warn('unit_needs_manual_confirmation', { task_id: taskId, unit: current.id });
        }
        // --- extraction ---
        await setDocumentStatus(store, taskId, doc.id, 'extracting');
        const refFrag = (r) => (r.source_ref ? r.source_ref.split('#')[1] ?? '' : '');
        const expected = (mockMeta.records ?? []).filter((r) => {
          const pageMatch = /^page=(\d+)/.exec(refFrag(r));
          if (pageMatch) return Number(pageMatch[1]) === unit.page_number;
          return doc.format !== 'pdf' || unit.page_number === 1; // sheet/row refs live on the single unit
        });
        const records = await extractRecords({
          traceStore: store, taskId, unit: current,
          representationBytes: await storage.get(doc.format === 'pdf' ? unit.representation_path : doc.storage_path),
          sourceFormat: doc.format, filename: doc.original_filename, docType: current.doc_type,
          expectedRecords: expected.map(({ record_id, source_ref, doc_type, ...rest }) => rest),
        });
        for (const r of records) { r.doc_type = current.doc_type; perDocRecords.push(r); }
      }
      markSuspectedDuplicates(perDocRecords);

      // --- normalization + boundary + matching + calculation ---
      await setDocumentStatus(store, taskId, doc.id, 'matching');
      for (const raw of perDocRecords) {
        try {
          const { record } = await normalizeRecord(raw, { store });
          const mockBoundaryHint = mockMeta.records?.find((r) => r.item_description === raw.item_description)?.expected_boundary;
          const boundary = await decideBoundary({ traceStore: store, taskId, record, expectedBoundary: mockBoundaryHint });
          record.scope = boundary.scope;
          record.category = boundary.category;
          record.category_name = boundary.category_name;
          record.boundary_rationale = boundary.rationale;
          record.inferred_field_count = Object.values(record.field_confidence ?? {}).filter((c) => c < 0.5).length;
  
          const recall = await recallCandidates({ store, record, taskId });
          record.recall_insufficient = recall.insufficient_recall;
          const selection = await selectFactor({
            traceStore: store, taskId, record,
            candidates: recall.candidates.filter((c) => c.factor),
            expectedSelection: mockMeta.records?.find((r) => r.item_description === raw.item_description)?.expected_selection,
          });
          const factor = factorsById[selection.selected_factor_id];
          const assessment = assessRecord({
            match: { confidence: selection.confidence },
            record, factor,
            candidates: recall.candidates.map((c) => ({ confidence: 0.5, factor: c.factor })),
          });
          // task GWP version vs factor GWP label (PRD 4.5 cross-version rule)
          assessment.gwp_version_consistent = factor.gwp_version === task.gwp_version;
          if (!assessment.gwp_version_consistent) {
            assessment.uncertainty_level = assessment.uncertainty_level === 'high' ? 'high' : 'medium';
            assessment.forced_review = true;
            assessment.cross_gwp_version = true;
          }
          const matchId = `match_${record.record_id}`;
          await store.put('matches', matchId, {
            task_id: taskId, activity_record_id: record.record_id,
            selected_factor_id: selection.selected_factor_id,
            runner_up_factor_id: selection.runner_up_id,
            confidence: selection.confidence,
            rationale: selection.rationale,
            key_semantic_features: selection.key_semantic_features,
            gwp_version_consistent: assessment.gwp_version_consistent,
            manually_assigned: false,
            candidate_ids: selection.candidate_ids,
            created_at: new Date().toISOString(),
          });
          record.uncertainty_level = assessment.uncertainty_level;
          record.unit_self_check = assessment.unit_self_check;
          record.no_high_confidence_factor = assessment.no_high_confidence_factor;
          record.match_id = matchId;
          await store.put('activity_records', record.record_id, record);
          matchesOut.push({ record, selection, factor, assessment });
  
          if (factor && record.quantity != null) {
            try {
              const calc = await computeEmission({ store, record, factor, taskGwpVersion: task.gwp_version });
              calcsOut.push(calc);
            } catch (calcErr) {
              // Unbridgeable unit pair: the self-check contract routes the
              // record to review instead of failing the document (AI-302).
              record.uncertainty_level = 'high';
              record.excluded_from_calc = `unit bridge failed: ${String(calcErr.message).slice(0, 120)}`;
              await store.put('activity_records', record.record_id, record);
            }
          } else {
            record.excluded_from_calc = record.excluded_from_calc ?? (record.quantity == null ? 'missing quantity/unit — not included in accounting' : null);
            await store.put('activity_records', record.record_id, record);
          }
          recordsOut.push(record);
        } catch (recordErr) {
          // A record that cannot be resolved after the configured retries is
          // marked failed and routed to review; the rest of the document still
          // contributes its records (NFR-202: the failed object is the record).
          log.error('record_pipeline_failed', {
            task_id: taskId, doc: doc.id, record: raw.record_id,
            error: String(recordErr.message).slice(0, 200),
          });
          const failed = {
            ...raw,
            document_id: doc.id,
            uncertainty_level: 'high',
            processing_failed: true,
            failure_code: recordErr.code ?? 'ERR_INTERNAL',
            failure_message: String(recordErr.message).slice(0, 200),
            excluded_from_calc: `processing failed: ${String(recordErr.message).slice(0, 120)}`,
          };
          await store.put('activity_records', failed.record_id, failed);
          recordsOut.push(failed);
        }
      }
      const needsReview = perDocRecords.some((r) => r.uncertainty_level === 'high');
      await setDocumentStatus(store, taskId, doc.id, needsReview ? 'needs_review' : 'completed');
    });
    return { records: recordsOut, calcs: calcsOut, matches: matchesOut };
  }

  const concurrency = Math.max(1, Number(process.env.PIPELINE_CONCURRENCY || 4));
  const perDoc = new Array(docs.length).fill(null);
  let cursor = 0;
  const worker = async () => {
    for (;;) {
      const i = cursor;
      cursor += 1;
      if (i >= docs.length) return;
      const doc = docs[i];
      const docT0 = Date.now();
      try {
        perDoc[i] = await processDocument(doc);
      } catch (err) {
        log.error('document_pipeline_failed', { task_id: taskId, doc: doc.id, error: String(err.message).slice(0, 200), stack: String(err.stack).split('\n').slice(0, 6).join(' | ') });
        perDoc[i] = { records: [], calcs: [], matches: [] };
      }
      docMs.push(Date.now() - docT0);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, docs.length) }, worker));

  const allRecords = [];
  const calcs = [];
  const matchResults = [];
  for (const part of perDoc) {
    if (!part) continue;
    allRecords.push(...part.records);
    calcs.push(...part.calcs);
    matchResults.push(...part.matches);
  }
  const docsMs = Date.now() - startedAt;

  const calcsWithMeta = calcs.map((c) => ({
    calc: c,
    meta: allRecords.find((r) => r.record_id === c.activity_record_id) ?? {},
  }));
  const agg = aggregate(calcsWithMeta);
  const top = topEmitters(calcsWithMeta);
  const scenarioOut = await computeScenarios({
    store, taskId, records: allRecords.filter((r) => !r.excluded_from_calc), calcs, factorsById, taskGwpVersion: task.gwp_version,
  });
  await openReviewForTask({ store, taskId, records: allRecords });
  const report = await assembleReport({ store, taskId, task, records: allRecords, calcs, calcsWithMeta, agg, top, scenarios: scenarioOut, factorsById });

  const summary = {
    documents: docs.length,
    records: allRecords.length,
    calculated: calcs.length,
    total_kgco2e: calcs.reduce((a, c) => a + c.emission_kgco2e, 0),
    scopes: agg.scope,
  };
  // Stage timing is the NFR-101 evidence trail: index build, per-document
  // processing, and the aggregate/scenario/report tail.
  log.info('pipeline_completed', {
    task_id: taskId,
    ...summary,
    index_ms: indexMs,
    documents_ms: docsMs,
    tail_ms: Date.now() - startedAt - docsMs,
    total_ms: Date.now() - startedAt,
    per_document_ms: docMs,
  });
  return { summary, report, scenarios: scenarioOut };
}
