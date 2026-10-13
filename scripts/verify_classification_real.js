#!/usr/bin/env node
// T-014 real-adapter classification verification over the Golden set.
// 1) accuracy: 30 documents (strict: every page correct), target >= 28/30
// 2) enum stress: >= 200 calls with 0 out-of-enum results
// 3) the three blurry documents route to manual confirmation
// 4) traces carry input/output summaries, latency, usage, cost
// Writes eval/results/classification_top1.json and prints a cost ledger.
import { readFileSync, mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LocalFileStore } from '../backend/src/store/index.js';
import { LocalFileStorage } from '../backend/src/storage/index.js';
import { loadFactorLibrary } from '../backend/src/services/factorLibrary.js';
import { ingestFile } from '../backend/src/services/fileService.js';
import { buildUnitsForDocument } from '../backend/src/services/documentUnits.js';
import { classifyUnit, DOC_TYPE_ENUM } from '../backend/src/services/classification.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
if (!process.env.GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY not set — real adapter required for this verification');
  process.exit(2);
}

const store = new LocalFileStore(mkdtempSync(join(tmpdir(), 't014-')));
const storage = new LocalFileStorage(mkdtempSync(join(tmpdir(), 't014u-')));
const taskId = 'task_classify_real';
await store.put('tasks', taskId, { task_id: taskId, entity_name: 'Golden', gwp_version: 'AR6' });

const manifest = JSON.parse(readFileSync(join(ROOT, 'data/golden/manifest.json'), 'utf8'));
const answers = JSON.parse(readFileSync(join(ROOT, 'data/golden/answers/doc_classifications.json'), 'utf8'));

// ingest + units, keep mapping GD-id -> {doc, units}
const byGolden = {};
for (const d of manifest.documents) {
  const file = d.file.split('/').pop();
  const r = await ingestFile({ store, storage, taskId, filename: file, buffer: readFileSync(join(ROOT, d.file)) });
  if (!r.ok) throw new Error(`${file}: ${r.code}`);
  const doc = await store.get('documents', r.document_id);
  const units = await buildUnitsForDocument({ store, storage, doc });
  byGolden[d.id] = { doc, units };
}

// page-level classification jobs
const jobs = [];
for (const ans of answers) {
  const entry = byGolden[ans.document_id];
  const unit = entry.units.find((u) => u.page_number === ans.page);
  jobs.push({ golden: ans, entry, unit });
}
console.log(`pages to classify: ${jobs.length}`);

// --- run 1: accuracy pass ---
let pageCorrect = 0;
const pageResults = [];
for (const job of jobs) {
  const bytes = await storage.get(job.entry.doc.format === 'pdf' ? job.unit.representation_path : job.entry.doc.storage_path);
  const out = await classifyUnit({
    traceStore: store, taskId, unit: job.unit, representationBytes: bytes,
    sourceFormat: job.entry.doc.format, filename: job.entry.doc.original_filename,
  });
  const correct = out.doc_type === job.golden.doc_type;
  if (correct) pageCorrect += 1;
  pageResults.push({ doc: job.golden.document_id, page: job.golden.page, expected: job.golden.doc_type, got: out.doc_type, confidence: out.type_confidence, correct });
}
const perDoc = {};
for (const p of pageResults) {
  perDoc[p.doc] = perDoc[p.doc] ?? { total: 0, correct: 0 };
  perDoc[p.doc].total += 1;
  perDoc[p.doc].correct += p.correct ? 1 : 0;
}
const docsCorrect = Object.values(perDoc).filter((d) => d.correct === d.total).length;
console.log(`page accuracy: ${pageCorrect}/${jobs.length}`);
console.log(`document accuracy (all pages correct): ${docsCorrect}/30`);
const wrong = pageResults.filter((p) => !p.correct);
if (wrong.length) console.log('wrong pages:', wrong.map((w) => `${w.doc}#${w.page} exp=${w.expected} got=${w.got}`).join(' | '));

// --- run 2: enum stress to >= 200 total calls ---
let totalCalls = jobs.length;
let outOfEnum = 0;
let stressFailures = 0;
while (totalCalls < 200) {
  const job = jobs[totalCalls % jobs.length];
  const bytes = await storage.get(job.entry.doc.format === 'pdf' ? job.unit.representation_path : job.entry.doc.storage_path);
  try {
    const out = await classifyUnit({
      traceStore: store, taskId, unit: { ...job.unit, id: `stress_${totalCalls}` },
      representationBytes: bytes, sourceFormat: job.entry.doc.format, filename: job.entry.doc.original_filename,
    });
    if (!DOC_TYPE_ENUM.includes(out.doc_type)) outOfEnum += 1;
  } catch (err) {
    stressFailures += 1;
    if (err.code === 'ERR_ENUM_INVALID') outOfEnum += 1;
  }
  totalCalls += 1;
}
console.log(`enum stress: total calls ${totalCalls}, out-of-enum ${outOfEnum}, hard failures ${stressFailures}`);

// --- run 3: blurry docs route to manual confirmation ---
const blurry = ['GD-19', 'GD-20', 'GD-21'];
let blurryFlagged = 0;
for (const gd of blurry) {
  const entry = byGolden[gd];
  const bytes = await storage.get(entry.doc.storage_path);
  const out = await classifyUnit({
    traceStore: store, taskId, unit: entry.units[0], representationBytes: bytes,
    sourceFormat: entry.doc.format, filename: entry.doc.original_filename,
  });
  if (out.needs_manual_confirmation) blurryFlagged += 1;
  console.log(`  ${gd}: type=${out.doc_type} confidence=${out.type_confidence} flagged=${out.needs_manual_confirmation}`);
}

// --- run 4: trace completeness ---
const traces = await store.list('ai_traces');
const withFields = traces.filter((t) => t.input_summary && t.output_summary && typeof t.latency_ms === 'number' && t.usage && t.adapter === 'real');
const cost = traces.reduce((a, t) => a + (t.usage?.est_cost_usd ?? 0), 0);
console.log(`traces: ${traces.length} total, ${withFields.length} complete (adapter=real)`);
console.log(`COST LEDGER (classification stage): $${cost.toFixed(4)}`);

// --- verdict + eval metric file ---
const pass = docsCorrect >= 28 && outOfEnum === 0 && blurryFlagged === 3 && withFields.length === traces.length;
mkdirSync(join(ROOT, 'eval/results'), { recursive: true });
writeFileSync(join(ROOT, 'eval/results/classification_top1.json'), JSON.stringify({
  measured: `${docsCorrect}/30 documents (${(docsCorrect / 30 * 100).toFixed(1)}%), pages ${pageCorrect}/${jobs.length}`,
  pass: docsCorrect >= 28,
  detail: { docsCorrect, pageCorrect, pages: jobs.length, out_of_enum: outOfEnum, blurry_flagged: blurryFlagged, calls: totalCalls, est_cost_usd: Number(cost.toFixed(6)) },
  evidence: 'progress/evidence/T-014/',
}, null, 2));
writeFileSync(join(ROOT, 'progress/evidence/T-014/classification_real.json'), JSON.stringify({ pageResults, perDoc, totalCalls, outOfEnum, blurryFlagged, cost, pass }, null, 2));
console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
rmSync(store.rootDir, { recursive: true, force: true });
process.exit(pass ? 0 : 1);
