// End-to-end pipeline test (mock adapter) over the demo dataset: ingest ->
// classify -> extract -> normalize -> boundary -> recall -> select -> assess
// -> calculate -> scenarios -> report -> review -> exports. Mock mode keeps
// the plumbing honest; accuracy metrics run with the real adapter.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import { LocalFileStore } from '../src/store/index.js';
import { LocalFileStorage } from '../src/storage/index.js';
import { loadFactorLibrary } from '../src/services/factorLibrary.js';
import { ingestFile } from '../src/services/fileService.js';
import { createTask } from '../src/services/taskService.js';
import { runPipeline } from '../src/services/pipeline.js';
import { scanReportCitations } from '../src/services/reportService.js';
import { recalculateTask, listReviewQueue, editRecordFields, excludeRecord, assignFactorManually } from '../src/services/reviewQueue.js';
import { buildMockCatalogFromDataset } from '../src/services/mockCatalog.js';
import { activityDetailCsv, categorySummaryCsv, reportPdf } from '../src/services/exportService.js';

process.env.AI_MODE = 'mock';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const DEMO = join(ROOT, 'data/demo');

test('demo dataset runs end-to-end in mock mode: report, citations, review, exports', async () => {
  const store = new LocalFileStore(mkdtempSync(join(tmpdir(), 'e2e-')));
  const storage = new LocalFileStorage(mkdtempSync(join(tmpdir(), 'e2e-u-')));
  await loadFactorLibrary(store);

  const manifest = JSON.parse(readFileSync(join(DEMO, 'manifest.json'), 'utf8'));
  const task = await createTask(store, { entity_name: manifest.company.name, period_from: '2026-01-01', period_to: '2026-06-30', gwp_version: 'AR6' });
  for (const d of manifest.documents) {
    const r = await ingestFile({ store, storage, taskId: task.task_id, filename: d.file.split('/').pop(), buffer: readFileSync(join(ROOT, d.file)) });
    assert.ok(r.ok, `${d.file}: ${r.code}`);
  }
  const { summary, report } = await runPipeline({ store, storage, taskId: task.task_id, mockCatalog: buildMockCatalogFromDataset(DEMO, readFileSync) });

  // pipeline produced the expected volume
  assert.equal(summary.records, 20, `records ${summary.records}`);
  assert.ok(summary.calculated >= 18, `calculated ${summary.calculated}`);
  assert.ok(summary.total_kgco2e > 0);

  // report: ten chapters in strict order
  const titles = report.chapters.map((c) => c.no);
  assert.deepEqual(titles, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

  // citations: 100% coverage, 0 invalid
  const cit = await scanReportCitations(store, report);
  assert.equal(cit.coverage_pct, 100);
  assert.equal(cit.invalid_count, 0);

  // injected-invalid detection (AI-202 negative control)
  const badReport = { ...report, numeric_conclusions: [...report.numeric_conclusions,
    { value_t: 1, ref_type: 'record', ref_id: 'rec_does_not_exist', context: 'injected bad' }] };
  const badCit = await scanReportCitations(store, badReport);
  assert.equal(badCit.invalid_count, 1);

  // review queue: sorted, edit + recalc, exclusion reduces total
  const before = await recalculateTask({ store, taskId: task.task_id });
  const queue = await listReviewQueue(store, task.task_id);
  const levels = queue.map((q) => q.uncertainty_level);
  const rank = { high: 0, medium: 1, low: 2 };
  assert.ok(levels.every((l, i) => i === 0 || rank[levels[i - 1]] <= rank[l]), 'queue sorted high-first');
  const anyRecord = (await store.query('activity_records', 'task_id', task.task_id)).find((r) => r.quantity != null && !r.excluded_from_calc);
  await editRecordFields({ store, taskId: task.task_id, recordId: anyRecord.record_id, patch: { quantity: anyRecord.quantity } });
  const afterEdit = await recalculateTask({ store, taskId: task.task_id });
  assert.ok(Number.isFinite(afterEdit.total_kgco2e));
  await excludeRecord({ store, taskId: task.task_id, recordId: anyRecord.record_id, reason: 'duplicate supplier invoice not applicable to this period' });
  const afterExclude = await recalculateTask({ store, taskId: task.task_id });
  assert.ok(afterExclude.total_kgco2e < afterEdit.total_kgco2e);
  // manual factor assignment is labeled
  const m = await assignFactorManually({ store, taskId: task.task_id, recordId: anyRecord.record_id, factorId: 'EF-D26-UKELECTRICITY-001' });
  const match = await store.get('matches', m.match_id);
  assert.equal(match.manually_assigned, true);

  // audit trail carries review actions with operator and timestamp
  const audits = await store.list('audit_trail');
  const reviewAudits = audits.filter((a) => String(a.action_type).startsWith('review_'));
  assert.ok(reviewAudits.length >= 3);
  assert.ok(reviewAudits.every((a) => a.actor && a.ts));

  // exports: two CSVs parse with matching row counts; PDF >= 6 pages
  const records = await store.query('activity_records', 'task_id', task.task_id);
  const calcs = await store.query('calculations', 'task_id', task.task_id);
  const detailCsv = activityDetailCsv(report, calcs, records);
  assert.ok(detailCsv.startsWith('\uFEFF'));
  assert.equal(detailCsv.split('\r\n').length - 1, records.length);
  const catCsv = categorySummaryCsv(report);
  assert.ok(catCsv.includes('Cat-1'));
  const pdf = await reportPdf(report);
  assert.ok(pdf.length > 10000);
  const pages = await countPdfPages(pdf);
  assert.ok(pages >= 6, `pdf pages ${pages}`);

  rmSync(store.rootDir, { recursive: true, force: true });
});

function countPdfPages(buffer) {
  return new Promise((resolve) => {
    const doc = new PDFDocument();
    // count /Type /Page occurrences in the produced bytes
    const text = buffer.toString('latin1');
    resolve((text.match(/\/Type\s*\/Page[^s]/g) || []).length);
  });
}
