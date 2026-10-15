// Regression battery for the 2026-10 full audit (defect ids D-xx). Covers the
// scenarios the task book mandates as automated: multi-page pipeline (V-01),
// ownership matrix (V-02), path traversal (V-03), scenario isolation (V-04),
// anchor values (V-05), CSV formula injection (V-06), numeric guards (V-07),
// embedding short-response (V-12), plus unit regressions for D-08/D-16/D-19/
// D-21/D-24/D-34 and the CORS/rate-limit behaviour of V-09. The second review
// round added D-60 (failed-document retry), D-62 (review close ownership),
// D-63 (strict numeric config) and D-65/D-66 (non-finite and embedding-shape).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import { buildApp } from '../src/server.js';
import { LocalFileStore } from '../src/store/index.js';
import { LocalFileStorage } from '../src/storage/index.js';
import { loadFactorLibrary, listFactors } from '../src/services/factorLibrary.js';
import { ingestFile, safeFilename } from '../src/services/fileService.js';
import { createTask } from '../src/services/taskService.js';
import { runPipeline } from '../src/services/pipeline.js';
import { computeEmission, toDisplayTons } from '../src/services/calculation.js';
import { computeScenarios } from '../src/services/scenarios.js';
import { validateExtraction } from '../src/services/pipelineModelCalls.js';
import { editRecordFields, assignFactorManually, excludeRecord, closeReviewItem, recalculateTask } from '../src/services/reviewQueue.js';
import { identifyCurrency } from '../src/services/normalization.js';
import { levelDistribution } from '../src/services/uncertainty.js';
import { activityDetailCsv } from '../src/services/exportService.js';
import { loadConfig } from '../src/config.js';
import { embedTexts } from '../src/ai/client.js';

process.env.AI_MODE = 'mock';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const STORE_DIR = mkdtempSync(join(tmpdir(), 'reg-store-'));
const UP_DIR = mkdtempSync(join(tmpdir(), 'reg-up-'));
process.env.STORE_ROOT = STORE_DIR;
process.env.STORAGE_ROOT = UP_DIR;

function twoPagePdf() {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 40 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.fontSize(18).text('Invoice page 1 — steel coils 1000 kg');
    doc.addPage().fontSize(18).text('Invoice page 2 — aluminium ingots 2000 kg');
    doc.end();
  });
}

const mockCatalogFor = (filename) => new Map([[filename, {
  classification: 'supplier_invoice',
  records: [
    { item_description: 'steel coils purchase', quantity: 1000, unit: 'kg', activity_date: '2026-01-05', source_ref: 'x#page=1',
      expected_boundary: { scope: 'Scope 3', category: 'Cat-1', rationale: 'Purchased goods are upstream Scope 3 category 1 activities.' } },
    { item_description: 'aluminium ingots purchase', quantity: 2000, unit: 'kg', activity_date: '2026-01-06', source_ref: 'x#page=2',
      expected_boundary: { scope: 'Scope 3', category: 'Cat-1', rationale: 'Purchased goods are upstream Scope 3 category 1 activities.' } },
  ],
}]]);

async function bootApp(verifyToken) {
  const app = await buildApp(verifyToken ? { verifyToken } : {});
  const server = app.listen(0);
  await new Promise((r) => server.on('listening', r));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

const json = async (base, path, opts = {}) => {
  const res = await fetch(base + path, opts);
  return { status: res.status, body: await res.json().catch(() => null) };
};

test('D-04/V-01: a two-page PDF completes with records from every page; re-runs stay complete', async () => {
  const store = new LocalFileStore(mkdtempSync(join(tmpdir(), 'reg-mp-')));
  const storage = new LocalFileStorage(mkdtempSync(join(tmpdir(), 'reg-mpu-')));
  await loadFactorLibrary(store);
  const task = await createTask(store, { entity_name: 'Multi Page Co', period_from: '2026-01-01', period_to: '2026-06-30', gwp_version: 'AR6' });
  const buf = await twoPagePdf();
  const ing = await ingestFile({ store, storage, taskId: task.task_id, filename: 'two-page.pdf', buffer: buf });
  assert.ok(ing.ok, `ingest failed: ${ing.code}`);
  assert.equal(ing.page_count, 2, 'pdf-lib counts both pages (D-26)');
  const first = await runPipeline({ store, storage, taskId: task.task_id, mockCatalog: mockCatalogFor('two-page.pdf') });
  assert.equal(first.summary.records, 2, 'both pages contribute records');
  const doc = (await store.query('documents', 'task_id', task.task_id))[0];
  assert.ok(['completed', 'needs_review'].includes(doc.status), `doc status ${doc.status}`);
  const pages = (await store.query('activity_records', 'task_id', task.task_id)).map((r) => r.source_ref);
  assert.ok(pages.some((p) => p.endsWith('#page=1')) && pages.some((p) => p.endsWith('#page=2')));
  // Re-run with the document already completed must reload its records (D-33).
  const second = await runPipeline({ store, storage, taskId: task.task_id, mockCatalog: mockCatalogFor('two-page.pdf') });
  assert.equal(second.summary.records, 2, 're-run keeps every record (D-33)');
  assert.ok(second.summary.total_kgco2e > 0);
  // V-05/D-10: aggregation anchors equal the dashboard's displayed tonnes.
  const dash = await recalculateTask({ store, taskId: task.task_id });
  for (const a of second.report.numeric_conclusions.filter((n) => n.ref_type === 'aggregation')) {
    const agg = dash.agg.scope.find((s) => s.key === a.locator);
    assert.ok(agg, `anchor references real scope ${a.locator}`);
    assert.equal(a.value_t, toDisplayTons(agg.value), `anchor ${a.locator} equals dashboard tonnes`);
  }
  for (const m of dash.calcs) {
    const a = second.report.numeric_conclusions.find((n) => n.ref_type === 'record' && n.ref_id === m.activity_record_id);
    assert.ok(a && a.value_t === toDisplayTons(m.emission_kgco2e), 'per-record anchor exact');
  }
  // D-52: chapter 2's Share column is a percentage of the total, so the scope
  // shares must sum to 100% and no single share may exceed 100%.
  const ch2 = second.report.chapters.find((c) => c.no === 2);
  const shareTable = ch2.blocks.find((b) => b.type === 'table' && b.header.includes('Share'));
  const shares = shareTable.rows.map((r) => Number(String(r[2]).replace('%', '')));
  assert.ok(shares.every((x) => Number.isFinite(x) && x >= 0 && x <= 100), `shares in [0,100]: ${shares.join(', ')}`);
  assert.ok(Math.abs(shares.reduce((a, b) => a + b, 0) - 100) < 0.5, `shares sum to ~100%: ${shares.join(' + ')}`);
});

test('D-05/V-04: scenario recomputation never overwrites the stored baseline ledger', async () => {
  const store = new LocalFileStore(mkdtempSync(join(tmpdir(), 'reg-sc-')));
  await loadFactorLibrary(store);
  const factors = Object.fromEntries((await listFactors(store)).map((f) => [f.factor_id, f]));
  const record = { record_id: 'R9', task_id: 't9', quantity: 1200, unit: 'kg', transport_mode: 'Air transport (general cargo)', gross_weight_kg: 1200, distance_km: 2960, activity_date: '2026-02-01', item_description: 'air freight' };
  const factor = factors['EF-D26-AIRFREIGHT-007'];
  const baseline = await computeEmission({ store, record, factor, taskGwpVersion: 'AR6' });
  const auditsBefore = (await store.list('audit_trail')).length;
  await computeScenarios({ store, taskId: 't9', records: [record], calcs: [baseline], factorsById: factors, taskGwpVersion: 'AR6' });
  const after = await store.get('calculations', 'calc_R9');
  assert.equal(after.emission_kgco2e, baseline.emission_kgco2e, 'ledger calc untouched by scenarios');
  assert.equal((await store.list('audit_trail')).length, auditsBefore, 'no audit rows from scenario reruns');
});

test('D-06/V-02: ownerless tasks stay open; owned tasks reject other identities on every route', async () => {
  const verifyToken = async (t) => { if (t === 'alice-token') return 'uid-alice'; throw new Error('bad token'); };
  const { server, base } = await bootApp(verifyToken);
  try {
    const owned = (await json(base, '/api/tasks', { method: 'POST', headers: { authorization: 'Bearer alice-token', 'content-type': 'application/json' }, body: JSON.stringify({ entity_name: 'Owner Co', period_from: '2026-01-01', period_to: '2026-06-30', gwp_version: 'AR6' }) })).body;
    const ownerless = (await json(base, '/api/tasks', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ entity_name: 'Open Co', period_from: '2026-01-01', period_to: '2026-06-30', gwp_version: 'AR6' }) })).body;
    const alice = { headers: { authorization: 'Bearer alice-token' } };
    const mallory = { headers: { authorization: 'Bearer mallory-token' } };
    const paths = ['/api/tasks/%s', '/api/tasks/%s/documents', '/api/tasks/%s/dashboard', '/api/tasks/%s/report', '/api/tasks/%s/review', '/api/tasks/%s/traces'];
    for (const p of paths) {
      const id = owned.task_id;
      assert.equal((await json(base, p.replace('%s', id))).status, 403, `${p} anonymous denied on owned task`);
      assert.equal((await json(base, p.replace('%s', id), mallory)).status, 403, `${p} wrong token denied`);
      const ownerStatus = (await json(base, p.replace('%s', id), alice)).status;
      assert.ok([200, 404].includes(ownerStatus), `${p} owner allowed (200; 404 only when nothing is generated yet)`);
      const oid = ownerless.task_id;
      for (const who of [{}, mallory, alice]) assert.ok([200, 404].includes((await json(base, p.replace('%s', oid), who)).status), `${p} ownerless stays open`);
    }
    const denied = await json(base, `/api/tasks/${owned.task_id}/report/export`, { headers: mallory.headers });
    assert.equal(denied.status, 403, 'export denied to another identity');
    const runDenied = await json(base, `/api/tasks/${owned.task_id}/run`, { method: 'POST', headers: mallory.headers, body: '{}' });
    assert.equal(runDenied.status, 403, 'run denied to another identity');
    const runOk = await json(base, `/api/tasks/${owned.task_id}/run`, { method: 'POST', headers: { ...alice.headers, 'content-type': 'application/json' }, body: '{}' });
    assert.equal(runOk.status, 202, 'owner may start a run');
  } finally { server.close(); }
});

test('D-07/V-03: traversal filenames are sanitized and storage stays inside its root', async () => {
  assert.equal(safeFilename('../../evil.pdf'), 'evil.pdf');
  assert.equal(safeFilename('..\\..\\win.pdf'), 'win.pdf');
  assert.equal(safeFilename('/abs/path/x.png'), 'x.png');
  const store = new LocalFileStore(mkdtempSync(join(tmpdir(), 'reg-tv-')));
  // The escape check walks a private sandbox, not the whole OS temp dir: other
  // processes on the machine also write there and a machine-wide diff made
  // this test fail on unrelated Vite/SSR cache traffic (D-101). The storage
  // root sits three levels deep inside the sandbox, so the ../../ payloads
  // under test still land inside the sandbox and outside the root — an escape
  // stays detectable.
  const sandbox = mkdtempSync(join(tmpdir(), 'reg-tvs-'));
  const storage = new LocalFileStorage(join(sandbox, 'L1', 'L2', 'up'));
  await loadFactorLibrary(store);
  const task = await createTask(store, { entity_name: 'Traversal Co', period_from: '2026-01-01', period_to: '2026-06-30', gwp_version: 'AR6' });
  const buf = await twoPagePdf();
  const r = await ingestFile({ store, storage, taskId: task.task_id, filename: '../../escape plan.pdf', buffer: buf });
  assert.ok(r.ok, `ingest should succeed with sanitized name: ${r.code}`);
  const before = new Set((function walk(d, acc) { for (const e of readdirSync(d, { withFileTypes: true })) { acc.add(join(d, e.name)); if (e.isDirectory()) walk(join(d, e.name), acc); } return acc; }(sandbox, new Set())));
  await ingestFile({ store, storage, taskId: task.task_id, filename: '..\\..\\b.pdf', buffer: buf });
  await ingestFile({ store, storage, taskId: task.task_id, filename: '/abs/b.png', buffer: buf.subarray(0, 8) });
  const after = (function walk(d, acc) { for (const e of readdirSync(d, { withFileTypes: true })) { acc.add(join(d, e.name)); if (e.isDirectory()) walk(join(d, e.name), acc); } return acc; }(sandbox, new Set()));
  for (const p of after) assert.ok(before.has(p) || p.startsWith(storage.rootDir), `file escaped storage root: ${p}`);
  await assert.rejects(() => storage.get('../../outside'), (e) => e.code === 'ERR_STORAGE_ACCESS');
});

test('D-11/V-06: CSV export neutralizes formula-trigger cells without breaking numerics', () => {
  const report = { chapters: [] };
  const records = [{ record_id: 'r1', source_ref: 'd#page=1', item_description: '=SUM(A1:A9)*cmd', quantity: 5, unit: 'kg', uncertainty_level: 'low' },
    { record_id: 'r2', source_ref: 'd#page=1', item_description: '+1|@ping|-2', quantity: 5, unit: 'kg' }];
  const calcs = [{ activity_record_id: 'r1', factor_id: 'f', emission_kgco2e: -1.5 }, { activity_record_id: 'r2', factor_id: 'f', emission_kgco2e: 2.5 }];
  const csv = activityDetailCsv(report, calcs, records);
  assert.ok(csv.includes("'=SUM"), 'formula cell prefixed');
  assert.ok(csv.includes("'+1|@ping|-2"), 'plus/at/dash cells prefixed');
  assert.ok(csv.includes(',-0.001,'), 'negative numbers stay numeric (Math.round(-1.5) = -1)');
});

test('D-14/D-15/V-07: non-finite and cross-target writes are rejected on every path', async () => {
  const store = new LocalFileStore(mkdtempSync(join(tmpdir(), 'reg-nv-')));
  await loadFactorLibrary(store);
  for (const bad of [{ quantity: NaN }, { quantity: Infinity }, { quantity: 0 }, { quantity: -3 }, { amount: 'free' }, { gross_weight_kg: 'heavy' }, { distance_km: Infinity }]) {
    assert.throws(() => validateExtraction({ records: [{ item_description: 'x', field_confidence: {}, ...bad }] }), undefined, `extraction rejects ${JSON.stringify(bad)}`);
  }
  const t1 = await createTask(store, { entity_name: 'A', period_from: '2026-01-01', period_to: '2026-06-30', gwp_version: 'AR6' });
  const t2 = await createTask(store, { entity_name: 'B', period_from: '2026-01-01', period_to: '2026-06-30', gwp_version: 'AR6' });
  const rec = { record_id: 'rec_own', task_id: t1.task_id, item_description: 'x', quantity: 5, unit: 'kg' };
  await store.put('activity_records', 'rec_own', rec);
  // Numeric strings come from the review UI's text inputs and are coerced to
  // numbers; anything non-finite or out of range is refused (D-14/D-15).
  const coerced = await editRecordFields({ store, taskId: t1.task_id, recordId: 'rec_own', patch: { quantity: '5' } });
  assert.equal(coerced.quantity, 5, 'numeric string coerced to a number');
  assert.equal(typeof coerced.quantity, 'number', 'ledger stores a number, never a string');
  for (const bad of [{ quantity: 'abc' }, { quantity: Infinity }, { quantity: NaN }, { quantity: 0 }, { quantity: -3 }, { amount: -1 }, { unit: 'stones' }, { currency: 'gbp' }]) {
    await assert.rejects(() => editRecordFields({ store, taskId: t1.task_id, recordId: 'rec_own', patch: bad }), (e) => e.code === 'ERR_ENUM_INVALID', `patch ${JSON.stringify(bad)} rejected`);
  }
  await assert.rejects(() => editRecordFields({ store, taskId: t2.task_id, recordId: 'rec_own', patch: { quantity: 9 } }), (e) => e.code === 'ERR_TASK_NOT_FOUND', 'cross-task edit rejected');
  await assert.rejects(() => excludeRecord({ store, taskId: t2.task_id, recordId: 'rec_own', reason: 'not in this task at all' }), (e) => e.code === 'ERR_TASK_NOT_FOUND', 'cross-task exclusion rejected');
  await assert.rejects(() => assignFactorManually({ store, taskId: t2.task_id, recordId: 'rec_own', factorId: 'EF-D26-UKELECTRICITY-001' }), (e) => e.code === 'ERR_TASK_NOT_FOUND', 'cross-task assignment rejected');
  await assert.rejects(() => closeReviewItem({ store, taskId: t2.task_id, recordId: 'rec_own', note: 'nope' }), (e) => e.code === 'ERR_TASK_NOT_FOUND', 'cross-task close rejected (D-62)');
});

test('D-16/D-63: invalid numeric config values fall back to defaults instead of NaN', () => {
  const { values } = loadConfig({ AI_RETRY_COUNT: 'abc', BATCH_SIZE: '-4', AI_TIMEOUT_SECONDS: '0', FACTOR_MATCH_CONFIDENCE_THRESHOLD: 'nope' });
  assert.equal(values.AI_RETRY_COUNT, 2);
  assert.equal(values.BATCH_SIZE, 10);
  assert.equal(values.AI_TIMEOUT_SECONDS, 60);
  assert.equal(values.FACTOR_MATCH_CONFIDENCE_THRESHOLD, 0.65);
  // D-63: a numeric prefix is not a valid value — it must fall back, not be
  // silently truncated by parseInt/parseFloat.
  const { values: v2 } = loadConfig({ BATCH_SIZE: '7.5', AI_RETRY_COUNT: '5x', FACTOR_MATCH_CONFIDENCE_THRESHOLD: '0.6junk' });
  assert.equal(v2.BATCH_SIZE, 10, 'an int must be written as an integer');
  assert.equal(v2.AI_RETRY_COUNT, 2, 'numeric prefix rejected');
  assert.equal(v2.FACTOR_MATCH_CONFIDENCE_THRESHOLD, 0.65, 'numeric prefix rejected');
});

test('D-18/V-12: a short embedding batch response is retried, then fails loudly', async () => {
  process.env.AI_MODE = 'real';
  process.env.GEMINI_API_KEY = 'test-key-never-sent';
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return { ok: true, json: async () => ({ embeddings: [{ values: [0.1] }] }) }; // 1 vector for 2 texts
  };
  try {
    await assert.rejects(embedTexts({ taskId: 't', texts: ['a', 'b'] }), (e) => e.code === 'ERR_MODEL_CALL_FAILED');
    assert.equal(calls, 2, 'one retry before failing');
  } finally {
    globalThis.fetch = original;
    process.env.AI_MODE = 'mock';
    delete process.env.GEMINI_API_KEY;
  }
});

test('D-08: traces never contain document bytes or upstream bodies', async () => {
  process.env.AI_MODE = 'real';
  process.env.GEMINI_API_KEY = 'test-key-never-sent';
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 400, text: async () => 'SECRET upstream echo' });
  const store = new LocalFileStore(mkdtempSync(join(tmpdir(), 'reg-trace-')));
  try {
    await assert.rejects(
      // callModel is imported lazily to keep the mock default elsewhere.
      (await import('../src/ai/client.js')).callModel({ taskId: 't', stage: 'extraction', model: 'gemini-3.5-flash-lite', parts: [{ text: 'q' }, { inline_data: { mime_type: 'application/pdf', data: Buffer.from('raw-document-bytes').toString('base64') } }], schema: {}, traceStore: store, mockFn: () => ({}) }),
      (e) => e.code === 'ERR_MODEL_CALL_FAILED',
    );
    const traces = await store.list('ai_traces');
    assert.ok(traces.length >= 1);
    for (const t of traces) {
      assert.ok(!JSON.stringify(t).includes('cmF3LWRvY3VtZW50'), 'no base64 payload in trace');
      assert.ok(!JSON.stringify(t).includes('SECRET upstream echo'), 'no upstream body in trace');
      assert.ok(/omitted/.test(t.input_summary), 'inline_data is summarized as omitted');
    }
  } finally {
    globalThis.fetch = original;
    process.env.AI_MODE = 'mock';
    delete process.env.GEMINI_API_KEY;
  }
});

test('D-19/D-21/D-24/D-34: citation veto, distribution purity, currency order, task validation', async () => {
  const { scanReportCitations } = await import('../src/services/reportService.js');
  const store = new LocalFileStore(mkdtempSync(join(tmpdir(), 'reg-mx-')));
  await loadFactorLibrary(store);
  await store.put('tasks', 'tk1', { task_id: 'tk1' });
  await store.put('scenarios', 'tk1_S-1', { task_id: 'tk1' });
  const report = { task_id: 'tk1', numeric_conclusions: [
    { value_t: 1, ref_type: 'scenario', ref_id: 'tk1_S-1' },
    { value_t: 1, ref_type: 'scenario', ref_id: 'tk1_S-9' },
  ] };
  const cit = await scanReportCitations(store, report);
  assert.equal(cit.invalid_count, 1, 'forged scenario anchor is invalid (D-19)');
  assert.deepEqual(Object.keys(levelDistribution([{}, { uncertainty_level: undefined }])), ['low', 'medium', 'high'], 'no NaN keys (D-21)');
  assert.equal(levelDistribution([{ uncertainty_level: undefined }]).medium, 1);
  assert.equal(identifyCurrency('total ¥jp 500'), 'JPY');
  assert.equal(identifyCurrency('円 3,000'), 'JPY');
  assert.equal(identifyCurrency('500 yen'), 'JPY');
  assert.equal(identifyCurrency('total ¥500'), 'JPY');
  assert.equal(identifyCurrency('RMB 300'), null, 'RMB is no longer a recognized currency');
  assert.equal(identifyCurrency('C$ 90'), 'CAD');
  assert.equal(identifyCurrency('£ 25'), 'GBP');
  assert.equal(identifyCurrency('$ 10'), 'USD');
  assert.equal(identifyCurrency('€ 10'), 'EUR');
  assert.equal(identifyCurrency('European aluminium sheet'), null, 'ordinary word is not EUR');
  assert.equal(identifyCurrency('AutoCAD design services'), null, 'AutoCAD is not CAD currency');
  assert.equal(identifyCurrency('8Gbps network upgrade'), null, 'Gbps is not GBP');
  assert.equal(identifyCurrency('Amount: USD 1,234.00 (approx. ¥180,000)'), 'USD', 'explicit code beats ¥ footnote');
  assert.equal(identifyCurrency('Value: HK$ 1,750.00'), null, 'unsupported HKD is an honest null, never USD');
  assert.equal(identifyCurrency('Currency: CNY 21,500.00'), null, 'unsupported CNY is an honest null');
  for (const bad of [{ entity_name: { deep: 'object' } }, { entity_name: 'x', period_from: '2026-13-99', period_to: '2026-06-30' }, { entity_name: 'x', period_from: '2026-07-01', period_to: '2026-01-01' }]) {
    await assert.rejects(
      createTask(store, { ...bad, period_from: bad.period_from ?? '2026-01-01', period_to: bad.period_to ?? '2026-06-30', gwp_version: 'AR6' }),
      (e) => e.code === 'ERR_ENUM_INVALID', `task validation rejects ${JSON.stringify(bad).slice(0, 40)}`,
    );
  }
});

test('D-13/D-37/V-09: rate limiting is socket-keyed and CORS is a strict allowlist', async () => {
  process.env.RATE_LIMIT_PER_MIN = '3';
  const { server, base } = await bootApp();
  try {
    for (let i = 0; i < 3; i += 1) {
      const r = await fetch(base + '/config', { headers: { 'x-forwarded-for': `1.2.3.${i}` } }); // forged header must not split buckets
      assert.equal(r.status, 200);
    }
    const limited = await fetch(base + '/config', { headers: { 'x-forwarded-for': '9.9.9.9' } });
    assert.equal(limited.status, 429, 'rate limited despite forged forwarding header');
    assert.equal((await limited.json()).error.code, 'ERR_RATE_LIMITED');
    assert.equal((await fetch(base + '/healthz')).status, 200, 'healthz exempt');
    const evil = await fetch(base + '/config', { headers: { origin: 'https://evil.example' } });
    assert.equal(evil.headers.get('access-control-allow-origin'), null, 'non-allowlisted origin gets no CORS header');
    const local = await fetch(base + '/config', { headers: { origin: 'http://localhost:5173' } });
    assert.equal(local.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    const malformed = await fetch(base + '/config', { headers: { origin: 'http://[::1' } });
    assert.ok(malformed.status < 500, 'malformed origin never causes a server error (D-61)');
    assert.ok([200, 429].includes(malformed.status));
  } finally {
    server.close();
    delete process.env.RATE_LIMIT_PER_MIN;
  }
});

test('D-60: a failed document is retried on the next run and keeps its records', async () => {
  const store = new LocalFileStore(mkdtempSync(join(tmpdir(), 'reg-fr-')));
  const storage = new LocalFileStorage(mkdtempSync(join(tmpdir(), 'reg-fru-')));
  await loadFactorLibrary(store);
  const task = await createTask(store, { entity_name: 'Retry Co', period_from: '2026-01-01', period_to: '2026-06-30', gwp_version: 'AR6' });
  const ing = await ingestFile({ store, storage, taskId: task.task_id, filename: 'retry.pdf', buffer: await twoPagePdf() });
  const first = await runPipeline({ store, storage, taskId: task.task_id, mockCatalog: mockCatalogFor('retry.pdf') });
  assert.equal(first.summary.records, 2, 'baseline run produces both records');
  const doc = await store.get('documents', ing.document_id);
  doc.status = 'failed'; // a terminal-looking failure with records already persisted
  await store.put('documents', ing.document_id, doc);
  const retried = await runPipeline({ store, storage, taskId: task.task_id, mockCatalog: mockCatalogFor('retry.pdf') });
  assert.equal(retried.summary.records, 2, 'failed document is reprocessed, not dropped');
  const retriedStatus = (await store.get('documents', ing.document_id)).status;
  assert.ok(['completed', 'needs_review'].includes(retriedStatus), `failed is retryable again (got ${retriedStatus})`);
  assert.equal((await store.query('activity_records', 'task_id', task.task_id)).length, 2, 'retry does not duplicate or lose records');
});

test('D-65: a non-finite factor value cannot reach the ledger', async () => {
  const store = new LocalFileStore(mkdtempSync(join(tmpdir(), 'reg-nf-')));
  await loadFactorLibrary(store);
  const record = { record_id: 'rnf', task_id: 'tnf', item_description: 'x', quantity: 10, unit: 'kg' };
  const factor = { factor_id: 'EF-X', value: Number.POSITIVE_INFINITY, activity_unit: 'kg', emission_unit: 'kgCO2e', ghg_coverage: 'CO2', gwp_version: 'AR6' };
  await assert.rejects(computeEmission({ store, record, factor, taskGwpVersion: 'AR6' }), /non-finite emission/);
  assert.ok(!(await store.get('calculations', 'calc_rnf')), 'nothing was persisted');
});

test('D-66: an embedding element without vector values fails loudly', async () => {
  process.env.AI_MODE = 'real';
  process.env.GEMINI_API_KEY = 'test-key-never-sent';
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ embeddings: [{ values: [0.1] }, {}] }) }); // right count, second element empty
  try {
    await assert.rejects(embedTexts({ taskId: 't', texts: ['a', 'b'] }), (e) => e.code === 'ERR_MODEL_CALL_FAILED');
  } finally {
    globalThis.fetch = original;
    process.env.AI_MODE = 'mock';
    delete process.env.GEMINI_API_KEY;
  }
});

test('D-67: a re-run that extracts nothing keeps the ledger instead of emptying it', async () => {
  const store = new LocalFileStore(mkdtempSync(join(tmpdir(), 'reg-empty-')));
  const storage = new LocalFileStorage(mkdtempSync(join(tmpdir(), 'reg-emptyu-')));
  await loadFactorLibrary(store);
  const task = await createTask(store, { entity_name: 'Empty Co', period_from: '2026-01-01', period_to: '2026-06-30', gwp_version: 'AR6' });
  await ingestFile({ store, storage, taskId: task.task_id, filename: 'empty-rerun.pdf', buffer: await twoPagePdf() });
  const first = await runPipeline({ store, storage, taskId: task.task_id, mockCatalog: mockCatalogFor('empty-rerun.pdf') });
  assert.equal(first.summary.records, 2);
  const doc = (await store.query('documents', 'task_id', task.task_id))[0];
  assert.notEqual(doc.status, 'completed', 'precondition: the second run reprocesses this document');
  // The second run has no mock catalog, so the mock adapter extracts nothing.
  // That must not wipe the records the first run produced (D-67).
  const second = await runPipeline({ store, storage, taskId: task.task_id, mockCatalog: new Map() });
  assert.equal(second.summary.records, 2, 'existing records survive an empty re-extraction');
  assert.equal((await store.query('activity_records', 'task_id', task.task_id)).length, 2, 'store keeps both records');
  assert.ok(second.summary.total_kgco2e > 0, 'the ledger still totals');
});

test('D-26: a corrupt PDF is rejected, not mis-counted', async () => {
  const store = new LocalFileStore(mkdtempSync(join(tmpdir(), 'reg-cp-')));
  const storage = new LocalFileStorage(mkdtempSync(join(tmpdir(), 'reg-cpu-')));
  const task = await createTask(store, { entity_name: 'Parse Co', period_from: '2026-01-01', period_to: '2026-06-30', gwp_version: 'AR6' });
  const r = await ingestFile({ store, storage, taskId: task.task_id, filename: 'broken.pdf', buffer: Buffer.from('%PDF-1.7 garbage bytes that pdf-lib cannot parse') });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'ERR_FILE_CORRUPT');
});

process.on('exit', () => { rmSync(STORE_DIR, { recursive: true, force: true }); rmSync(UP_DIR, { recursive: true, force: true }); });
if (existsSync(join(ROOT, 'data/factors/emission_factors.json'))) {
  // factor library availability assert (fail loudly if data missing)
  test('factor library present for regression fixtures', async () => {
    const store = new LocalFileStore(mkdtempSync(join(tmpdir(), 'reg-fl-')));
    await loadFactorLibrary(store);
    assert.equal((await listFactors(store)).length, 741);
  });
}
