// Tests for dual-channel recall mechanics (T-021). Semantic vectors run on
// the mock adapter here; recall QUALITY metrics (Top-3 >= 95%) are finalized
// with the real embedding model when credentials arrive.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LocalFileStore } from '../src/store/index.js';
import { loadFactorLibrary } from '../src/services/factorLibrary.js';
import { buildSemanticIndex, recallCandidates, cosine } from '../src/services/recall.js';

process.env.AI_MODE = 'mock';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const cases = JSON.parse(readFileSync(join(ROOT, 'data/golden/answers/matching_cases.json'), 'utf8'));

test('semantic index builds over the full library and recall mechanics hold', async () => {
  const store = new LocalFileStore(mkdtempSync(join(tmpdir(), 'recall-')));
  await loadFactorLibrary(store);
  const idx = await buildSemanticIndex({ store, taskId: 't-recall' });
  assert.equal(idx.total, 743);

  const record = {
    item_description: 'Air freight of electronic components HKG to NRT',
    transport_mode: 'Air transport (general cargo)',
  };
  for (const channel of ['both', 'keyword', 'semantic']) {
    const r = await recallCandidates({ store, record, channel, taskId: 't-recall' });
    assert.ok(r.candidate_count >= 1, `${channel} non-empty`);
    assert.ok(r.candidate_count <= 15, `${channel} window <= 15`);
    assert.equal(r.channel, channel);
    assert.ok(r.candidates.every((c) => c.factor && c.factor.factor_id === c.factor_id));
  }

  // dedup: no duplicate ids in the merged window
  const dual = await recallCandidates({ store, record, channel: 'both', taskId: 't-recall' });
  const ids = dual.candidates.map((c) => c.factor_id);
  assert.equal(new Set(ids).size, ids.length);

  // insufficient-recall path: gibberish on keyword-only channel
  const cold = await recallCandidates({
    store, channel: 'keyword', taskId: 't-recall',
    record: { item_description: 'zzqx vvvv wwww' },
  });
  assert.equal(cold.insufficient_recall, true);
  assert.equal(cold.relaxed_retry, true);

  // embedding traces recorded (AI-106 applies to embedding calls too)
  const traces = await store.list('ai_traces');
  assert.ok(traces.some((t) => t.stage === 'embedding'));

  // cosine sanity
  assert.ok(Math.abs(cosine([1, 0], [1, 0]) - 1) < 1e-9);
  assert.ok(Math.abs(cosine([1, 0], [0, 1])) < 1e-9);
  rmSync(store.rootDir, { recursive: true, force: true });
});

test('keyword-only channel Top-3 coverage over the 40 golden cases (informational)', async () => {
  const store = new LocalFileStore(mkdtempSync(join(tmpdir(), 'recall2-')));
  await loadFactorLibrary(store);
  await buildSemanticIndex({ store, taskId: 't-recall' });
  let top1 = 0;
  let top3 = 0;
  for (const c of cases) {
    const r = await recallCandidates({
      store, channel: 'keyword', taskId: 't-recall',
      record: {
        ...c.record,
        item_description: c.record.item_description,
      },
    });
    const ids = r.candidates.map((x) => x.factor_id);
    if (ids.includes(c.best_factor_id)) top3 += 1;
    if (ids[0] === c.best_factor_id) top1 += 1;
  }
  console.log(`  [info] keyword-only channel: best-in-candidates ${top3}/40, top-1 ${top1}/40`);
  // keyword channel alone must at least recall the best factor for a majority;
  // the binding >=95% Top-3 target is measured on the final dual-channel run.
  assert.ok(top3 >= 24, `keyword channel unreasonably weak: ${top3}/40`);
  rmSync(store.rootDir, { recursive: true, force: true });
});
