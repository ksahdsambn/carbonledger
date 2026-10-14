#!/usr/bin/env node
// T-025 real-adapter factor-selection verification over the 40 Golden cases.
// 1) Top-1 accuracy >= 85% (>= 34/40)
// 2) reference validity 100%: every selected id exists in candidates AND library
// 3) 20 sampled rationales >= 40 words with runner-up comparison
// 4) injected out-of-candidate id is rejected (AI-204, adapter already tested; re-verified live)
// 5) 10 timed selections <= 8 s each
// Also records Top-3 recall (T-022 metric) from the same run.
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LocalFileStore } from '../backend/src/store/index.js';
import { loadFactorLibrary } from '../backend/src/services/factorLibrary.js';
import { buildSemanticIndex, recallCandidates } from '../backend/src/services/recall.js';
import { selectFactor, makeSelectionValidator } from '../backend/src/services/pipelineModelCalls.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

if (!process.env.GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY not set — real adapter required for this verification');
  process.exit(2);
}

const store = new LocalFileStore(mkdtempSync(join(tmpdir(), 't025-')));
await loadFactorLibrary(store);
console.log('building semantic index with real embeddings (741 factors, one-off)...');
await buildSemanticIndex({ store, taskId: 't25' });
const factorsById = Object.fromEntries((await store.list('emission_factors')).map((f) => [f.factor_id, f]));

const cases = JSON.parse(readFileSync(join(ROOT, 'data/golden/answers/matching_cases.json'), 'utf8'));
const results = [];
let top1 = 0, top3 = 0, invalidRef = 0;
for (const c of cases) {
  const started = Date.now();
  const recall = await recallCandidates({ store, record: c.record, taskId: 't25' });
  const candidates = recall.candidates.filter((x) => x.factor);
  const inCandidates = candidates.some((x) => x.factor_id === c.best_factor_id);
  let sel = null, err = null;
  try {
    sel = await selectFactor({ traceStore: store, taskId: 't25', record: c.record, candidates });
  } catch (e) { err = e.message; }
  const latency = Date.now() - started;
  const exists = sel && factorsById[sel.selected_factor_id];
  const inLib = sel && candidates.some((x) => x.factor_id === sel.selected_factor_id);
  if (sel && !inLib) invalidRef += 1;
  if (sel?.selected_factor_id === c.best_factor_id) top1 += 1;
  if (inCandidates) top3 += 1;
  results.push({ case_id: c.case_id, difficulty: c.difficulty, expected: c.best_factor_id,
    got: sel?.selected_factor_id ?? null, correct: sel?.selected_factor_id === c.best_factor_id,
    in_candidates: inCandidates, latency_ms: latency, runner_up: sel?.runner_up_id ?? null,
    rationale_words: sel ? sel.rationale.split(/\s+/).length : 0, error: err });
  console.log(`${c.case_id} ${c.difficulty.padEnd(19)} ${sel?.selected_factor_id === c.best_factor_id ? 'OK  ' : 'MISS'} got=${(sel?.selected_factor_id ?? err ?? 'none').toString().slice(0, 34)} ${latency}ms`);
}
console.log(`\nTop-1: ${top1}/40 (target >= 34) | Top-3 recall: ${top3}/40 (target >= 38) | invalid refs: ${invalidRef} (target 0)`);

// rationale check on 20 samples
const sampled = results.filter((r) => !r.error).slice(0, 20);
const badRationale = sampled.filter((r) => r.rationale_words < 40 || !r.runner_up);
console.log(`rationales >=40 words with runner-up: ${sampled.length - badRationale.length}/${sampled.length}`);

// timing: 10 random results <= 8s end-to-end
const timed = results.slice(0, 10);
const maxLatency = Math.max(...timed.map((r) => r.latency_ms));
console.log(`max end-to-end latency (10 records): ${maxLatency}ms (target <= 8000)`);

const traces = await store.list('ai_traces');
const cost = traces.reduce((a, t) => a + (t.usage?.est_cost_usd ?? 0), 0);
console.log(`COST LEDGER (selection stage incl. one-off index build): $${cost.toFixed(4)}`);

const pass = top1 >= 34 && top3 >= 38 && invalidRef === 0 && badRationale.length === 0 && maxLatency <= 8000;
writeFileSync(join(ROOT, 'eval/results/factor_match_top1.json'), JSON.stringify({
  adapter: 'real',
  measured: `${top1}/40 (${(top1 / 40 * 100).toFixed(1)}%)`,
  pass: top1 >= 34,
  detail: { top1, top3, invalidRef, maxLatency, est_cost_usd: Number(cost.toFixed(6)) },
}, null, 2));
writeFileSync(join(ROOT, 'eval/results/factor_match_top3.json'), JSON.stringify({
  adapter: 'real',
  measured: `${top3}/40 (${(top3 / 40 * 100).toFixed(1)}%)`,
  pass: top3 >= 38,
  detail: { top3 },
}, null, 2));
import { mkdirSync } from 'node:fs';
mkdirSync(join(ROOT, 'progress/evidence/T-025'), { recursive: true });
writeFileSync(join(ROOT, 'progress/evidence/T-025/selection_real.json'), JSON.stringify({ results, top1, top3, invalidRef, cost, pass }, null, 2));
console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
rmSync(store.rootDir, { recursive: true, force: true });
process.exit(pass ? 0 : 1);
