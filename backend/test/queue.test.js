// Tests for the in-process queue and local store abstractions.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { InProcessQueue } from '../src/queue/index.js';
import { LocalFileStore, STORE_COLLECTIONS } from '../src/store/index.js';

test('queue dispatches jobs to registered handlers and tracks stats', async () => {
  const q = new InProcessQueue();
  const seen = [];
  q.registerHandler('echo', async (payload) => {
    seen.push(payload.value);
  });
  q.enqueue('echo', { value: 1 });
  q.enqueue('echo', { value: 2 });
  await q.start();
  assert.deepEqual(seen, [1, 2]);
  assert.equal(q.stats.enqueued, 2);
  assert.equal(q.stats.completed, 2);
  assert.equal(q.stats.failed, 0);
});

test('unhandled and failing jobs are counted as failures, not thrown', async () => {
  const q = new InProcessQueue();
  const dead = [];
  q.on('dead-letter', (e) => dead.push(e.reason));
  q.registerHandler('boom', async () => {
    throw new Error('handler exploded');
  });
  q.enqueue('unknown-type', {});
  q.enqueue('boom', {});
  await q.start();
  assert.equal(q.stats.failed, 2);
  assert.equal(dead.length, 1);
});

test('local store persists collections and survives reload', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'clstore-'));
  const store = new LocalFileStore(dir);
  await store.put('tasks', 'task_1', { entity_name: 'Acme', gwp_version: 'AR6' });
  const reloaded = new LocalFileStore(dir);
  const doc = await reloaded.get('tasks', 'task_1');
  assert.equal(doc.entity_name, 'Acme');
  const byField = await reloaded.query('tasks', 'entity_name', 'Acme');
  assert.equal(byField.length, 1);
  await reloaded.delete('tasks', 'task_1');
  assert.equal(await reloaded.get('tasks', 'task_1'), null);
  rmSync(dir, { recursive: true, force: true });
  assert.ok(STORE_COLLECTIONS.includes('emission_factors'));
  assert.equal(STORE_COLLECTIONS.length, 12);
});
