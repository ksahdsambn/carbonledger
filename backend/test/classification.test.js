// Unit tests for the unified AI wrapper and classification service (mock
// adapter). Real-model accuracy runs are T-014 verifications executed with
// GEMINI_API_KEY present (AI_MODE=real).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalFileStore } from '../src/store/index.js';
import { callModel, embedText, mode, DEFAULT_PRICES } from '../src/ai/client.js';
import { classifyUnit, DOC_TYPE_ENUM, mockClassification } from '../src/services/classification.js';

process.env.AI_MODE = 'mock';

test('wrapper enforces closed-set validation with retry, then fails loudly', async () => {
  const store = new LocalFileStore(mkdtempSync(join(tmpdir(), 'aimock-')));
  // First two attempts return an out-of-enum value; third attempt is valid.
  let calls = 0;
  const flaky = () => {
    calls += 1;
    if (calls < 3) return { doc_type: 'random_nonsense', confidence: 0.9 };
    return { doc_type: 'other', confidence: 0.8 };
  };
  const okRes = await callModel({
    taskId: 't1', stage: 'classification', model: 'gemini-3.5-flash-lite',
    parts: [{ text: 'x' }], schema: {}, validator: (r) => {
      if (!DOC_TYPE_ENUM.includes(r.doc_type)) throw new Error('outside enum');
    },
    mockFn: flaky, traceStore: store,
  });
  assert.equal(okRes.result.doc_type, 'other');
  assert.equal(calls, 3); // invalid values were retried, not accepted
  const traces = await store.list('ai_traces');
  assert.ok(traces.some((t) => t.ok === false)); // failed attempts traced

  // Always-invalid responses exhaust retries and raise ERR_ENUM_INVALID.
  await assert.rejects(
    callModel({
      taskId: 't1', stage: 'classification', model: 'gemini-3.5-flash-lite',
      parts: [{ text: 'x' }], schema: {},
      validator: (r) => { if (!DOC_TYPE_ENUM.includes(r.doc_type)) throw new Error('outside enum'); },
      mockFn: () => ({ doc_type: 'still_bad', confidence: 0.9 }), traceStore: store,
    }),
    (err) => err.code === 'ERR_ENUM_INVALID',
  );
  rmSync(store.rootDir, { recursive: true, force: true });
});

test('wrapper records latency, usage estimate and adapter in traces', async () => {
  const store = new LocalFileStore(mkdtempSync(join(tmpdir(), 'aimock2-')));
  await callModel({
    taskId: 't2', stage: 'classification', model: 'gemini-3.5-flash-lite',
    parts: [{ text: 'input' }], schema: {}, validator: () => {},
    mockFn: () => ({ doc_type: 'other', confidence: 0.9 }), traceStore: store,
  });
  const traces = await store.list('ai_traces');
  assert.equal(traces.length, 1);
  const t = traces[0];
  assert.equal(t.stage, 'classification');
  assert.equal(t.task_id, 't2');
  assert.equal(t.adapter, 'mock');
  assert.ok(typeof t.latency_ms === 'number');
  assert.ok(t.usage.input_tokens > 0);
  assert.ok(t.usage.est_cost_usd >= 0);
  assert.ok(t.input_summary.length > 0 && t.output_summary.length > 0);
  rmSync(store.rootDir, { recursive: true, force: true });
});

test('price table covers exactly the models the single-model policy permits', () => {
  assert.deepEqual(Object.keys(DEFAULT_PRICES).sort(), ['gemini-3.5-flash-lite', 'gemini-embedding-001']);
});

test('classification flags sub-threshold confidence for manual confirmation', async () => {
  const store = new LocalFileStore(mkdtempSync(join(tmpdir(), 'aimock3-')));
  const unit = { id: 'unit_x1', task_id: 't3', page_number: 1, document_id: 'doc_x' };
  const blurry = await classifyUnit({
    traceStore: store, taskId: 't3', unit,
    representationBytes: Buffer.from('fake'), sourceFormat: 'jpg',
    filename: 'GD-19_blurry_invoice.jpg',
  });
  assert.equal(blurry.needs_manual_confirmation, true);
  assert.ok(blurry.type_confidence < 0.7);

  const clear = await classifyUnit({
    traceStore: store, taskId: 't3', unit: { ...unit, id: 'unit_x2' },
    representationBytes: Buffer.from('fake'), sourceFormat: 'jpg',
    filename: 'GD-01_invoice_scan.jpg',
  });
  assert.equal(clear.doc_type, 'supplier_invoice');
  assert.equal(clear.needs_manual_confirmation, false);
  rmSync(store.rootDir, { recursive: true, force: true });
});

test('mock embedding returns normalized vector and traces the call', async () => {
  const store = new LocalFileStore(mkdtempSync(join(tmpdir(), 'aimock4-')));
  const v = await embedText({ taskId: 't4', text: 'air freight cold chain', traceStore: store });
  assert.equal(v.length, 64);
  const norm = Math.sqrt(v.reduce((a, b) => a + b * b, 0));
  assert.ok(Math.abs(norm - 1) < 1e-9);
  const traces = await store.list('ai_traces');
  assert.ok(traces.some((t) => t.stage === 'embedding'));
  assert.equal(mode(), 'mock');
  rmSync(store.rootDir, { recursive: true, force: true });
});
