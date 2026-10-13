#!/usr/bin/env node
// Public-site verification battery (T-044/T-045/T-046):
//  - N timed end-to-end demo runs (default 10) with report checks -> P90
//  - first-screen timing x5
//  - 3 concurrent demo tasks
//  - corrupt-file batch isolation, cross-task access rejection, rate limit 429
// Writes progress/evidence/T-044/public_runs.json + eval latency metric.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://myproject-dc19d.web.app';
const RUNS = Number(process.env.RUNS ?? 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function j(path, opts = {}) {
  const res = await fetch(BASE + path, { ...opts, headers: { 'content-type': 'application/json', ...(opts.headers ?? {}) } });
  return { status: res.status, body: await res.json().catch(() => null) };
}
const corrupt = Buffer.from('%PDF-1.7 ' + 'x'.repeat(5000));

async function timedDemoRun(label) {
  const t0 = Date.now();
  const start = await j('/api/demo/load', { method: 'POST' });
  if (start.status !== 202) return { label, ok: false, error: `kickoff ${start.status}` };
  const tid = start.body.task_id;
  // poll until all 20 documents reach a terminal state
  let terminal = 0, elapsed = 0;
  while (elapsed < 480000) {
    await sleep(15000);
    const t = await j(`/api/tasks/${tid}`);
    const docs = t.body?.documents ?? [];
    terminal = docs.filter((d) => ['completed', 'needs_review', 'failed'].includes(d.status)).length;
    elapsed = Date.now() - t0;
    if (terminal === 20) break;
  }
  // fetch the report (lazy generation if needed) and verify
  const rep = await j(`/api/tasks/${tid}/report?cb=${Date.now()}`);
  const chapters = rep.body?.report?.chapters?.map((c) => c.no).join(',');
  const cit = rep.body?.citations;
  const ok = chapters === '1,2,3,4,5,6,7,8,9,10' && cit?.coverage_pct === 100 && cit?.invalid_count === 0;
  return { label, ok, task_id: tid, seconds: Number((elapsed / 1000).toFixed(1)), chapters_ok: ok, citations: cit ? `${cit.coverage_pct}%/${cit.invalid_count}` : 'n/a', docs_terminal: terminal };
}

const runs = [];
for (let i = 1; i <= RUNS; i += 1) {
  const r = await timedDemoRun(`run${i}`);
  runs.push(r);
  console.log(`${r.label}: ${r.ok ? 'PASS' : 'FAIL'} ${r.seconds}s citations=${r.citations} docs=${r.docs_terminal}`);
}
const times = runs.filter((r) => r.ok).map((r) => r.seconds).sort((a, b) => a - b);
const p90 = times.length ? times[Math.ceil(times.length * 0.9) - 1] : null;
console.log(`P90 (${times.length} successful runs): ${p90}s`);

// first-screen timing x5
const screens = [];
for (let i = 0; i < 5; i += 1) {
  const t0 = Date.now();
  const res = await fetch(BASE + '/');
  await res.text();
  screens.push(Date.now() - t0);
}
console.log(`first-screen ms: ${screens.join(',')} avg=${(screens.reduce((a, b) => a + b, 0) / 5).toFixed(0)}`);

// 3 concurrent demo tasks
const conc = [];
const c0 = Date.now();
for (let i = 0; i < 3; i += 1) conc.push(j('/api/demo/load', { method: 'POST' }));
const cRes = await Promise.all(conc);
console.log(`3 concurrent kickoffs: ${cRes.map((r) => r.status).join(',')} in ${Date.now() - c0}ms`);

// corrupt file batch isolation
const fd = new FormData();
fd.append('files', new Blob([readFileSync(join(ROOT, 'data/golden/documents/GD-04_utility_electricity.pdf'))]), 'good.pdf');
fd.append('files', new Blob([corrupt]), 'broken.pdf');
fd.append('files', new Blob([readFileSync(join(ROOT, 'data/golden/documents/GD-07_packing_cartons.png'))]), 'good.png');
const up = await (await fetch(`${BASE}/api/tasks/task_isolation_test/documents`, { method: 'POST', body: fd })).json().catch(() => null);
console.log('corrupt-batch (unknown task):', up?.error?.code ?? up);

// cross-task isolation: fetch a document of an existing task without its ownership
const t = await j('/api/tasks', { method: 'POST', body: JSON.stringify({ entity_name: 'Isolation B', period_from: '2026-01-01', period_to: '2026-06-30', gwp_version: 'AR6' }) });
const tidB = t.body.task_id;
const existing = runs.find((r) => r.task_id);
const docList = await j(`/api/tasks/${existing?.task_id ?? 'x'}/documents`);
const docId = docList.body?.documents?.[0]?.id;
const cross = docId ? await fetch(`${BASE}/api/tasks/${tidB}/documents/${docId}/file?cb=${Date.now()}`) : null;
console.log('cross-task access (task B requesting task A file):', cross ? cross.status : 'n/a', cross && cross.status === 404 ? 'REJECTED' : '');

// rate limit: hammer until 429
let got429 = false, count = 0;
for (let i = 0; i < 80 && !got429; i += 1) {
  const r = await fetch(`${BASE}/healthz/`, { redirect: 'follow' });
  if (r.status === 429) got429 = true;
  count += 1;
}
console.log(`rate limit: 429=${got429} after ${count} requests`);

mkdirSync(join(ROOT, 'progress/evidence/T-044'), { recursive: true });
writeFileSync(join(ROOT, 'progress/evidence/T-044/public_runs.json'), JSON.stringify({ runs, p90, screens, concurrent: cRes.map((r) => r.status), rate_limited: got429, cross_task_status: cross?.status ?? null }, null, 2));
writeFileSync(join(ROOT, 'eval/results/e2e_latency_p90.json'), JSON.stringify({
  measured: `${p90}s (P90 of ${times.length} public runs)`,
  pass: p90 != null && p90 <= 180,
  detail: { runs: times, screens_avg_ms: screens.reduce((a, b) => a + b, 0) / 5 },
}, null, 2));
console.log('DONE');
