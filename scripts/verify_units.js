#!/usr/bin/env node
// T-013 verification: page-unit splitting and traceability.
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument } from 'pdf-lib';
import { LocalFileStore } from '../backend/src/store/index.js';
import { LocalFileStorage } from '../backend/src/storage/index.js';
import { ingestFile } from '../backend/src/services/fileService.js';
import { buildUnitsForDocument, resolveUnit } from '../backend/src/services/documentUnits.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const ok = (cond, label) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) failures.push(label); };

const store = new LocalFileStore(mkdtempSync(join(tmpdir(), 't013s-')));
const storage = new LocalFileStorage(mkdtempSync(join(tmpdir(), 't013u-')));
const taskId = 'task_units1';
await store.put('tasks', taskId, { task_id: taskId, entity_name: 'Units Corp', gwp_version: 'AR6' });

const ingest = async (name, path) => {
  const r = await ingestFile({ store, storage, taskId, filename: name, buffer: readFileSync(path) });
  if (!r.ok) throw new Error(`${name}: ${r.code}`);
  return store.get('documents', r.document_id);
};

// 1 — mixed 4-page PDF -> 4 units, consecutive pages, correct parent
const mixed = await ingest('GD-09_mixed_four_pages.pdf', join(ROOT, 'data/golden/documents/GD-09_mixed_four_pages.pdf'));
const units = await buildUnitsForDocument({ store, storage, doc: mixed });
ok(units.length === 4, 'GD-09 splits into 4 units');
ok(units.map((u) => u.page_number).join(',') === '1,2,3,4', 'page numbers consecutive 1..4');
ok(units.every((u) => u.document_id === mixed.id), 'all units point to the parent document');

// each unit's representation is a valid single-page PDF
let singlePageOk = true;
for (const u of units) {
  const pdf = await PDFDocument.load(await storage.get(u.representation_path));
  if (pdf.getPageCount() !== 1) singlePageOk = false;
}
ok(singlePageOk, 'each unit representation is a valid 1-page PDF (model-ready)');

// 2 — xlsx, csv, single-page image -> exactly 1 unit each
const singles = [
  ['GD-02_po_polymer.xlsx', 'data/golden/documents/GD-02_po_polymer.xlsx'],
  ['GD-08_invoice_steel.csv', 'data/golden/documents/GD-08_invoice_steel.csv'],
  ['GD-07_packing_cartons.png', 'data/golden/documents/GD-07_packing_cartons.png'],
];
for (const [name, path] of singles) {
  const doc = await ingest(name, join(ROOT, path));
  const u = await buildUnitsForDocument({ store, storage, doc });
  ok(u.length === 1 && u[0].page_number === 1, `${name} -> exactly 1 unit`);
}

// 3 — totals equal sum of page counts; 5 sampled units resolve back
const allDocs = await store.query('documents', 'task_id', taskId);
let expectedTotal = 0;
for (const d of allDocs) expectedTotal += d.page_count;
const allUnits = await store.query('document_units', 'task_id', taskId);
ok(allUnits.length === expectedTotal, `unit total ${allUnits.length} == sum of page counts ${expectedTotal}`);
let traceOk = true;
for (const u of allUnits.slice(0, 5)) {
  const r = await resolveUnit(store, u.id);
  if (!r?.unit || !r?.document || r.document.id !== u.document_id) traceOk = false;
}
ok(traceOk, 'sampled 5 units resolve back to document + page');

rmSync(store.rootDir, { recursive: true, force: true });
console.log(failures.length === 0 ? 'RESULT: PASS' : `RESULT: FAIL (${failures.length})`);
process.exit(failures.length === 0 ? 0 : 1);
