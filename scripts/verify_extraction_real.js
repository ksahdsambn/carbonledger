#!/usr/bin/env node
// T-016 real-adapter extraction verification over the Golden set.
// 1) field accuracy: quantity & unit >= 98%; five-field average >= 95%
// 2) five missing-field documents: missing fields stay empty (no fabrication)
// 3) three-line invoice (GD-10) yields exactly 3 records
// 4) field confidences complete and within [0,1] on >= 20 records
// 5) >= 2 of 3 handwritten docs produce valid records (quantity + unit + required fields)
// 6) a no-activity-data page yields 0 records without error
import { readFileSync, mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LocalFileStore } from '../backend/src/store/index.js';
import { LocalFileStorage } from '../backend/src/storage/index.js';
import { loadFactorLibrary } from '../backend/src/services/factorLibrary.js';
import { ingestFile } from '../backend/src/services/fileService.js';
import { buildUnitsForDocument } from '../backend/src/services/documentUnits.js';
import { classifyUnit } from '../backend/src/services/classification.js';
import { extractRecords } from '../backend/src/services/pipelineModelCalls.js';
import { normalizeRecord } from '../backend/src/services/normalization.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const store = new LocalFileStore(mkdtempSync(join(tmpdir(), 't016-')));
const storage = new LocalFileStorage(mkdtempSync(join(tmpdir(), 't016u-')));
const taskId = 'task_extract_real';
await store.put('tasks', taskId, { task_id: taskId, gwp_version: 'AR6' });

const manifest = JSON.parse(readFileSync(join(ROOT, 'data/golden/manifest.json'), 'utf8'));
const answers = JSON.parse(readFileSync(join(ROOT, 'data/golden/answers/activity_records.json'), 'utf8'));

const byGolden = {};
for (const d of manifest.documents) {
  const file = d.file.split('/').pop();
  const r = await ingestFile({ store, storage, taskId, filename: file, buffer: readFileSync(join(ROOT, d.file)) });
  const doc = await store.get('documents', r.document_id);
  const units = await buildUnitsForDocument({ store, storage, doc });
  byGolden[d.id] = { doc, units };
}

// classify each unit first (extraction inherits doc_type), then extract
const extracted = []; // {doc, unit, records}
for (const [gd, entry] of Object.entries(byGolden)) {
  for (const unit of entry.units) {
    const bytes = await storage.get(entry.doc.format === 'pdf' ? unit.representation_path : entry.doc.storage_path);
    const classified = await classifyUnit({
      traceStore: store, taskId, unit, representationBytes: bytes,
      sourceFormat: entry.doc.format, filename: entry.doc.original_filename,
    });
    const records = await extractRecords({
      traceStore: store, taskId, unit: classified, representationBytes: bytes,
      sourceFormat: entry.doc.format, filename: entry.doc.original_filename, docType: classified.doc_type,
    });
    extracted.push({ gd, doc: entry.doc, unit, records });
  }
}

// normalize every extracted record for comparison
const normed = [];
for (const group of extracted) {
  for (const r of group.records) {
    const { record } = await normalizeRecord({ ...r, task_id: taskId }, { store });
    normed.push({ ...record, _gd: group.gd, _page: group.unit.page_number });
  }
}
console.log(`extracted records: ${normed.length} (expected 30)`);

// --- 1: field accuracy against the 30 answer records ---
const fieldOk = { quantity: 0, unit: 0, amount: 0, currency: 0, activity_date: 0 };
const fieldTotal = { quantity: 0, unit: 0, amount: 0, currency: 0, activity_date: 0 };
const mistakes = [];
for (const ans of answers) {
  const gd = ans.source_ref.split('#')[0];
  const page = Number((ans.source_ref.match(/page=(\d+)/) ?? [0, 1])[1]);
  const cands = normed.filter((r) => r._gd === gd && (r._page === page || (gd === 'GD-10' && r._page === 1)));
  let got = cands[0];
  if (cands.length > 1) got = cands.reduce((best, r) => (Math.abs((r.quantity ?? 0) - ans.quantity) < Math.abs((best.quantity ?? 0) - ans.quantity) ? r : best), cands[0]);
  for (const f of Object.keys(fieldOk)) {
    if (ans[f] === null) continue;
    fieldTotal[f] += 1;
    let ok = false;
    if (f === 'quantity') {
      ok = got?.[f] != null && Math.abs(got[f] - ans[f]) / Math.max(ans[f], 1e-9) < 0.005;
    } else ok = got?.[f] === ans[f];
    if (ok) fieldOk[f] += 1;
    else mistakes.push(`${ans.record_id}.${f}: exp=${JSON.stringify(ans[f])} got=${JSON.stringify(got?.[f])}`);
  }
}
const rates = Object.fromEntries(Object.keys(fieldOk).map((f) => [f, fieldTotal[f] ? fieldOk[f] / fieldTotal[f] : 1]));
const avg = (rates.quantity + rates.unit + rates.amount + rates.currency + rates.activity_date) / 5;
console.log('field rates:', Object.fromEntries(Object.entries(rates).map(([k, v]) => [k, (v * 100).toFixed(1) + '%'])));
console.log(`five-field average: ${(avg * 100).toFixed(1)}% (target >=95%); quantity ${(rates.quantity * 100).toFixed(1)}% unit ${(rates.unit * 100).toFixed(1)}% (target >=98%)`);
if (mistakes.length <= 12) mistakes.forEach((m) => console.log('  MISS', m));

// --- 2: missing-field docs stay empty ---
const missingDocs = ['GD-05', 'GD-17', 'GD-23', 'GD-25', 'GD-27'];
let noFabrication = true;
for (const gd of missingDocs) {
  const ansList = answers.filter((a) => a.source_ref.startsWith(gd));
  const gotList = normed.filter((r) => r._gd === gd);
  for (const ans of ansList) {
    const got = gotList.find((g) => Math.abs((g.quantity ?? 0) - ans.quantity) < Math.max(1, ans.quantity * 0.01)) ?? gotList[0];
    if (!got) continue;
    for (const f of ['amount', 'currency', 'activity_date']) {
      if (ans[f] === null && got[f] != null) {
        noFabrication = false;
        console.log(`FABRICATION ${gd}.${f}: expected empty, got ${JSON.stringify(got[f])}`);
      }
    }
  }
}
console.log(`missing-field docs (5): no fabrication = ${noFabrication}`);

// --- 3: three-line invoice yields exactly 3 records ---
const gd10 = normed.filter((r) => r._gd === 'GD-10');
console.log(`GD-10 three-line invoice records: ${gd10.length} (target exactly 3)`);

// --- 4: confidences complete and in range on >=20 records ---
const withConf = normed.filter((r) => r.field_confidence && Object.keys(r.field_confidence).length >= 5
  && Object.values(r.field_confidence).every((v) => typeof v === 'number' && v >= 0 && v <= 1));
console.log(`records with complete in-range confidences: ${withConf.length}/30 (target >= 20)`);

// --- 5: handwritten docs produce valid records ---
const hand = ['GD-16', 'GD-17', 'GD-18'];
const validHand = hand.filter((gd) => normed.some((r) => r._gd === gd && r.quantity != null && r.unit != null && r.item_description && r.activity_date != null));
console.log(`handwritten valid records: ${validHand.length}/3 (target >= 2)`);

// --- 6: no-activity page yields zero records without error ---
const gd12 = extracted.filter((e) => e.gd === 'GD-12');
const zeroRecords = gd12.every((e) => e.records.length === 0);
console.log(`GD-12 cover letter yields zero records: ${zeroRecords}`);

const traces = await store.list('ai_traces');
const cost = traces.reduce((a, t) => a + (t.usage?.est_cost_usd ?? 0), 0);
console.log(`COST LEDGER (extraction stage, incl. classification pre-pass): $${cost.toFixed(4)}`);

const pass = rates.quantity >= 0.98 && rates.unit >= 0.98 && avg >= 0.95 && noFabrication && gd10.length === 3 && withConf.length >= 20 && validHand.length >= 2 && zeroRecords;
mkdirSync(join(ROOT, 'eval/results'), { recursive: true });
writeFileSync(join(ROOT, 'eval/results/field_extraction_accuracy.json'), JSON.stringify({
  measured: `avg ${(avg * 100).toFixed(1)}%, quantity ${(rates.quantity * 100).toFixed(1)}%, unit ${(rates.unit * 100).toFixed(1)}%`,
  pass: rates.quantity >= 0.98 && rates.unit >= 0.98 && avg >= 0.95,
  detail: { rates, mistakes: mistakes.length, records: normed.length, est_cost_usd: Number(cost.toFixed(6)) },
}, null, 2));
mkdirSync(join(ROOT, 'progress/evidence/T-016'), { recursive: true });
writeFileSync(join(ROOT, 'progress/evidence/T-016/extraction_real.json'), JSON.stringify({ rates, avg, mistakes, normed: normed.length }, null, 2));
console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
rmSync(store.rootDir, { recursive: true, force: true });
process.exit(pass ? 0 : 1);
