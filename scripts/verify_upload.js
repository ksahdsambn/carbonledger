#!/usr/bin/env node
// T-011 verification: upload & persistence service over real HTTP.
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApp } from '../backend/src/server.js';
import { LocalFileStore } from '../backend/src/store/index.js';
import { LocalFileStorage } from '../backend/src/storage/index.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
process.env.STORE_KIND = 'local';

const storeDir = mkdtempSync(join(tmpdir(), 't011store-'));
const upDir = mkdtempSync(join(tmpdir(), 't011up-'));
process.env.STORAGE_ROOT = upDir;

const failures = [];
const ok = (cond, label) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) failures.push(label); };

// Boot the app on an ephemeral port with isolated store/storage.
const app = buildApp();
// Re-wire the app-internal store? buildApp creates its own; for this test we
// let it use env-driven dirs instead:
// (buildApp reads STORE_KIND/STORAGE_ROOT via createStore/createStorage)
const server = app.listen(0);
await new Promise((r) => server.on('listening', r));
const base = `http://127.0.0.1:${server.address().port}`;

const post = async (path, body) => {
  const res = await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
};
const upload = async (path, entries) => {
  const fd = new FormData();
  for (const [name, buf] of entries) fd.append('files', new Blob([buf]), name);
  const res = await fetch(base + path, { method: 'POST', body: fd });
  return { status: res.status, body: await res.json() };
};

const task = (await post('/api/tasks', {
  entity_name: 'Verify Corp', period_from: '2026-01-01', period_to: '2026-06-30', gwp_version: 'AR6',
})).body;

// --- 1: five formats upload + byte-identical retrieval ---
const samples = [
  ['GD-01_invoice_metal_scan.pdf', readFileSync(join(ROOT, 'data/golden/documents/GD-01_invoice_metal_scan.pdf'))],
  ['GD-16_hand_delivery_note.jpg', readFileSync(join(ROOT, 'data/golden/documents/GD-16_hand_delivery_note.jpg'))],
  ['GD-18_hand_stock_card.png', readFileSync(join(ROOT, 'data/golden/documents/GD-18_hand_stock_card.png'))],
  ['GD-02_po_polymer.xlsx', readFileSync(join(ROOT, 'data/golden/documents/GD-02_po_polymer.xlsx'))],
  ['GD-08_invoice_steel.csv', readFileSync(join(ROOT, 'data/golden/documents/GD-08_invoice_steel.csv'))],
];
const r1 = await upload(`/api/tasks/${task.task_id}/documents`, samples);
ok(r1.status === 200 && r1.body.count === 5, 'five formats accepted');
ok(r1.body.results.every((x) => x.ok), 'no ingestion failures');
for (let i = 0; i < samples.length; i += 1) {
  const docId = r1.body.results[i].document_id;
  const res = await fetch(`${base}/api/tasks/${task.task_id}/documents/${docId}/file`);
  const got = Buffer.from(await res.arrayBuffer());
  ok(got.equals(samples[i][1]), `roundtrip identical: ${samples[i][0]}`);
}

// --- 2: oversize rejection, corrupt rejection, batch isolation ---
const big = Buffer.alloc(11 * 1024 * 1024, 7);
const rb = await upload(`/api/tasks/${task.task_id}/documents`, [['big.pdf', big]]);
ok(rb.body.results[0].ok === false && rb.body.results[0].code === 'ERR_FILE_TOO_LARGE', '11MB rejected with ERR_FILE_TOO_LARGE');
ok(/10 MB/.test(rb.body.results[0].message), 'rejection message is English and states the limit');

const corrupt = readFileSync(join(ROOT, 'data/golden/anomalies/AN-01_corrupted.pdf'));
const good = readFileSync(join(ROOT, 'data/golden/documents/GD-04_utility_electricity.pdf'));
const rbad = await upload(`/api/tasks/${task.task_id}/documents`, [['broken.pdf', corrupt], ['good.pdf', good]]);
ok(rbad.body.results[0].ok === false && rbad.body.results[0].code === 'ERR_FILE_CORRUPT', 'corrupt file rejected with ERR_FILE_CORRUPT');
ok(rbad.body.results[1].ok === true, 'good file in same batch succeeds');

// --- 3: duplicate detection, keep and discard ---
const t2 = (await post('/api/tasks', { entity_name: 'Dup Corp', period_from: '2026-01-01', period_to: '2026-06-30', gwp_version: 'AR6' })).body;
const dupFile = ['invoice.pdf', readFileSync(join(ROOT, 'data/golden/anomalies/AN-03_duplicate_of_GD01.pdf'))];
const srcFile = ['invoice.pdf', readFileSync(join(ROOT, 'data/golden/documents/GD-01_invoice_metal_scan.pdf'))];
await upload(`/api/tasks/${t2.task_id}/documents`, [srcFile]);
const dupRes = await upload(`/api/tasks/${t2.task_id}/documents`, [dupFile]);
ok(dupRes.body.results[0].status === 'pending_duplicate' && dupRes.body.results[0].duplicate_of, 'duplicate upload flagged pending_duplicate');

// keep -> both coexist
const keepRes = await post(`/api/tasks/${t2.task_id}/documents/${dupRes.body.results[0].document_id}/duplicate`, { keep: true });
ok(keepRes.body.status === 'queued', 'keep decision re-queues duplicate');
const docsAfterKeep = (await (await fetch(`${base}/api/tasks/${t2.task_id}/documents`)).json()).documents;
ok(docsAfterKeep.filter((d) => !d.duplicate_discarded).length === 2, 'keep: two copies coexist');

// discard path on a fresh task
const t3 = (await post('/api/tasks', { entity_name: 'Dup Corp 2', period_from: '2026-01-01', period_to: '2026-06-30', gwp_version: 'AR6' })).body;
await upload(`/api/tasks/${t3.task_id}/documents`, [srcFile]);
const dupRes2 = await upload(`/api/tasks/${t3.task_id}/documents`, [dupFile]);
await post(`/api/tasks/${t3.task_id}/documents/${dupRes2.body.results[0].document_id}/duplicate`, { keep: false });
const docsAfterDiscard = (await (await fetch(`${base}/api/tasks/${t3.task_id}/documents`)).json()).documents;
ok(docsAfterDiscard.filter((d) => !d.duplicate_discarded).length === 1, 'discard: only first upload remains');

// --- 4: 20-file batch all queued ---
const t4 = (await post('/api/tasks', { entity_name: 'Batch Corp', period_from: '2026-01-01', period_to: '2026-06-30', gwp_version: 'AR6' })).body;
const demoDir = join(ROOT, 'data/demo/documents');
const manifest = JSON.parse(readFileSync(join(ROOT, 'data/demo/manifest.json'), 'utf8'));
const demoFiles = manifest.documents.map((d) => [d.file.split('/').pop(), readFileSync(join(ROOT, d.file))]);
ok(demoFiles.length === 20, 'demo set has 20 files');
if (process.env.NEGATIVE_CONTROL === 'corrupt-demo') {
  // Test hook: poison one PDF entry so the "all 20 ingested" check must fail.
  const pdfIdx = demoFiles.findIndex(([name]) => name.endsWith('.pdf'));
  demoFiles[pdfIdx][1] = Buffer.from('%PDF-1.7 garbage bytes injected by negative control');
}
const r20 = await upload(`/api/tasks/${t4.task_id}/documents`, demoFiles);
ok(r20.body.results.length === 20 && r20.body.results.every((x) => x.ok), '20 files all ingested');
const docs20 = (await (await fetch(`${base}/api/tasks/${t4.task_id}/documents`)).json()).documents;
ok(docs20.filter((d) => d.status === 'queued').length === 20, 'all 20 status=queued, none lost');

server.close();
rmSync(storeDir, { recursive: true, force: true });
rmSync(upDir, { recursive: true, force: true });
console.log(failures.length === 0 ? 'RESULT: PASS' : `RESULT: FAIL (${failures.length})`);
process.exit(failures.length === 0 ? 0 : 1);
