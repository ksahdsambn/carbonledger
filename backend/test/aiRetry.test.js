// NFR-202 verification: a model call that fails is retried exactly twice
// (three attempts in total) before the target is marked failed, and every
// attempt leaves a trace carrying a machine-readable error code plus an
// English description. The transport is stubbed so no network call is made.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalFileStore } from '../src/store/index.js';
import { callModel, assertModelAllowed } from '../src/ai/client.js';

const RETRYABLE_CALL = {
  taskId: 't-retry',
  stage: 'classification',
  model: 'gemini-3.5-flash-lite',
  parts: [{ text: 'x' }],
  schema: {},
  validator: () => {},
};

function useRealTransportWith(handler) {
  process.env.AI_MODE = 'real';
  process.env.GEMINI_API_KEY = 'test-key-never-sent';
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  return () => { globalThis.fetch = original; };
}

test('timeout is retried twice, then the target fails with ERR_MODEL_TIMEOUT', async () => {
  const store = new LocalFileStore(mkdtempSync(join(tmpdir(), 'retry-timeout-')));
  let attempts = 0;
  const restore = useRealTransportWith(async () => {
    attempts += 1;
    const err = new Error('the operation was aborted');
    err.name = 'AbortError';
    throw err;
  });
  try {
    await assert.rejects(
      callModel({ ...RETRYABLE_CALL, traceStore: store }),
      (err) => err.code === 'ERR_MODEL_TIMEOUT' && err.details.attempts === 3,
    );
    assert.equal(attempts, 3, 'one attempt plus the two configured retries');

    const traces = await store.list('ai_traces');
    assert.equal(traces.length, 3, 'every failed attempt is traced');
    assert.ok(traces.every((t) => t.ok === false && t.error && t.latency_ms >= 0));
    assert.deepEqual(traces.map((t) => t.attempt).sort(), [1, 2, 3]);
  } finally {
    restore();
    rmSync(store.rootDir, { recursive: true, force: true });
  }
});

test('a transient failure is retried and the third attempt succeeds', async () => {
  const store = new LocalFileStore(mkdtempSync(join(tmpdir(), 'retry-ok-')));
  let attempts = 0;
  const restore = useRealTransportWith(async () => {
    attempts += 1;
    if (attempts < 3) throw new Error('upstream hiccup');
    return {
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 2 },
      }),
    };
  });
  try {
    const out = await callModel({ ...RETRYABLE_CALL, traceStore: store });
    assert.equal(attempts, 3);
    assert.deepEqual(out.result, { ok: true });
    const traces = await store.list('ai_traces');
    assert.equal(traces.filter((t) => t.ok === false).length, 2);
    assert.equal(traces.filter((t) => t.ok === true).length, 1);
  } finally {
    restore();
    rmSync(store.rootDir, { recursive: true, force: true });
  }
});

test('a non-retryable transport failure still surfaces a machine-readable code', async () => {
  const store = new LocalFileStore(mkdtempSync(join(tmpdir(), 'retry-fatal-')));
  let attempts = 0;
  const restore = useRealTransportWith(async () => {
    attempts += 1;
    return { ok: false, status: 400, text: async () => 'invalid request payload' };
  });
  try {
    await assert.rejects(
      callModel({ ...RETRYABLE_CALL, traceStore: store }),
      (err) => err.code === 'ERR_MODEL_CALL_FAILED' && err.details.attempts === 1,
    );
    // A fatal answer (4xx) must not be retried (D-17): one attempt only.
    assert.equal(attempts, 1, 'fatal upstream errors are not retried');
  } finally {
    restore();
    rmSync(store.rootDir, { recursive: true, force: true });
  }
});

// Single-model mandate: a real call must name a model the allow-list permits,
// so a Pro or Flash model can never be reached by accident.
test('a model outside the configured allow-list is refused before any request', async () => {
  const store = new LocalFileStore(mkdtempSync(join(tmpdir(), 'retry-policy-')));
  let requests = 0;
  const restore = useRealTransportWith(async () => { requests += 1; throw new Error('should never be reached'); });
  try {
    for (const model of ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash']) {
      await assert.rejects(
        callModel({ ...RETRYABLE_CALL, model, traceStore: store }),
        (err) => err.code === 'ERR_MODEL_CALL_FAILED' && /single-model policy/.test(err.details.detail),
      );
    }
    assert.equal(requests, 0, 'no HTTP request may be made for a non-permitted model');
    assert.equal(assertModelAllowed('gemini-3.5-flash-lite'), 'gemini-3.5-flash-lite');
    assert.equal(assertModelAllowed('gemini-embedding-001'), 'gemini-embedding-001');
  } finally {
    restore();
    rmSync(store.rootDir, { recursive: true, force: true });
  }
});
