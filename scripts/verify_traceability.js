#!/usr/bin/env node
// T-020 verification: full-chain source traceability over the Golden answers.
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LocalFileStore } from '../backend/src/store/index.js';
import { LocalFileStorage } from '../backend/src/storage/index.js';
import { ingestFile } from '../backend/src/services/fileService.js';
import { buildUnitsForDocument } from '../backend/src/services/documentUnits.js';
import { scanReferences, openSourceView, parseSourceRef } from '../backend/src/services/traceability.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const ok = (cond, label) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) failures.push(label); };

const store = new LocalFileStore(mkdtempSync(join(tmpdir(), 't020s-')));
const storage = new LocalFileStorage(mkdtempSync(join(tmpdir(), 't020u-')));
const taskId = 'task_trace';
await store.put('tasks', taskId, { task_id: taskId });

// Ingest the 30 Golden documents, index them by GD-xx id.
const manifest = JSON.parse(readFileSync(join(ROOT, 'data/golden/manifest.json'), 'utf8'));
const goldenDocs = JSON.parse(readFileSync(join(ROOT, 'data/golden/answers/doc_classifications.json'), 'utf8'));
const answers = JSON.parse(readFileSync(join(ROOT, 'data/golden/answers/activity_records.json'), 'utf8'));
const index = {};
for (const d of manifest.documents) {
  const file = d.file.split('/').pop();
  const r = await ingestFile({ store, storage, taskId, filename: file, buffer: readFileSync(join(ROOT, d.file)) });
  if (!r.ok) throw new Error(`${file}: ${r.code}`);
  const doc = await store.get('documents', r.document_id);
  if (d.format === 'pdf') await buildUnitsForDocument({ store, storage, doc });
  index[d.id] = doc;
}
ok(Object.keys(index).length === 30, '30 golden documents ingested with units');

// 1 — full source_ref scan over the 30 answer records
const scan = await scanReferences({ store, storage, records: answers, documentsIndex: index });
ok(scan.total === 30, `scan covers 30 records (${scan.total})`);
ok(scan.invalid_count === 0, `invalid references = 0 (resolved ${scan.resolved}/${scan.total})`);
if (scan.invalid.length) console.log(scan.invalid);

// 2 — sample 10 records, retrieve source and confirm localization
let viewOk = true;
const sample = answers.filter((_, i) => i % 3 === 0).slice(0, 10);
for (const r of sample) {
  const parsed = parseSourceRef(r.source_ref);
  const doc = index[parsed.docId];
  const view = await openSourceView({ storage, document: doc, parsed });
  if (!view.bytes || view.bytes.length === 0) viewOk = false;
  if (view.locator.kind === 'page' && view.locator.page > view.locator.total_pages) viewOk = false;
  if (view.locator.kind === 'row' && (view.locator.row ?? 1) < 1) viewOk = false;
  if (view.format !== doc.format) viewOk = false;
}
ok(sample.length === 10 && viewOk, '10 sampled records open the correct source with valid locators');

// negative control: broken references must be detected
const bad = await scanReferences({
  store, storage,
  records: [
    { record_id: 'X1', source_ref: 'GD-99#page=1' },
    { record_id: 'X2', source_ref: 'garbage' },
    { record_id: 'X3', source_ref: 'GD-09#page=99' },
  ],
  documentsIndex: index,
});
ok(bad.invalid_count === 3, `negative control: ${bad.invalid_count}/3 invalid references detected`);

rmSync(store.rootDir, { recursive: true, force: true });
console.log(failures.length === 0 ? 'RESULT: PASS' : `RESULT: FAIL (${failures.length})`);
process.exit(failures.length === 0 ? 0 : 1);
