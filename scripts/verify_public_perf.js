#!/usr/bin/env node
// Public-site performance verification (T-044 and T-045).
//
// T-044 / FR-1203 / NFR-101: ten consecutive one-click demo runs on the public
//   URL, timed from load to finished report, P90 must be <= 3 minutes. Every
//   run must also produce a ten-chapter report whose citations are all valid.
// T-045 / NFR-102: AI cost per document, summed from the recorded per-call
//   token usage and public list prices.
// T-045 / NFR-103: first-screen load, five runs, average <= 3 seconds.
// T-045 / NFR-105: three concurrent demo tasks complete with no server errors.
//
// Usage: node scripts/verify_public_perf.js [--runs 10]
// Evidence: progress/evidence/T-044/public_runs.json,
//           eval/results/e2e_latency_p90.json,
//           eval/results/ai_cost_per_document.json
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.PUBLIC_BASE || 'https://myproject-dc19d.web.app';
const runsArg = process.argv.indexOf('--runs');
const RUNS = Number(runsArg > -1 ? process.argv[runsArg + 1] : process.env.RUNS ?? 10);
const REPORT_BUDGET_MS = 300_000; // a single run must never exceed the 3-minute target
const POLL_MS = 10_000;
const TERMINAL = ['completed', 'needs_review', 'failed'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(path, opts = {}) {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: { 'content-type': 'application/json', ...(opts.headers ?? {}) },
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

/** Waits until every document of the task reaches a terminal state. */
async function waitForDocuments(taskId, deadline) {
  const STALL_MS = 90_000;
  let lastTerminal = -1;
  let lastProgress = Date.now();
  for (;;) {
    const t = await api(`/api/tasks/${taskId}`);
    const docs = t.body?.documents ?? [];
    const terminal = docs.filter((d) => TERMINAL.includes(d.status)).length;
    if (terminal !== lastTerminal) {
      lastTerminal = terminal;
      lastProgress = Date.now();
    }
    if (docs.length > 0 && terminal === docs.length) return { terminal, total: docs.length };
    if (Date.now() > deadline) return { terminal, total: docs.length, timedOut: true, stalledMs: Date.now() - lastProgress };
    if (Date.now() - lastProgress > STALL_MS) {
      const stuck = docs.filter((d) => !TERMINAL.includes(d.status)).map((d) => `${d.original_filename}:${d.status}`);
      return { terminal, total: docs.length, stalledMs: Date.now() - lastProgress, stuck };
    }
    await sleep(POLL_MS);
  }
}

/**
 * Waits until the report is fully assembled. Documents reaching a terminal
 * state only means ingestion finished; the ten chapters, the scenario
 * narratives and the citation scan are produced afterwards, so the report is
 * polled until it is complete rather than read once.
 */
async function waitForReport(taskId, deadline) {
  let last = null;
  for (;;) {
    const rep = await api(`/api/tasks/${taskId}/report?cb=${Date.now()}`);
    const chapters = rep.body?.report?.chapters?.map((c) => c.no).join(',') ?? '';
    const cit = rep.body?.citations;
    last = { status: rep.status, chapters, citations: cit };
    if (chapters === '1,2,3,4,5,6,7,8,9,10' && cit?.coverage_pct === 100 && cit?.invalid_count === 0) {
      return { ready: true, chapters, citations: cit };
    }
    if (Date.now() > deadline) return { ready: false, ...last };
    await sleep(POLL_MS);
  }
}

async function timedDemoRun(label) {
  const t0 = Date.now();
  const deadline = t0 + REPORT_BUDGET_MS;
  const start = await api('/api/demo/load', { method: 'POST' });
  if (start.status !== 202) return { label, ok: false, error: `kickoff HTTP ${start.status}` };
  const taskId = start.body.task_id;
  const docs = await waitForDocuments(taskId, deadline);
  const report = await waitForReport(taskId, deadline);
  const seconds = Number(((Date.now() - t0) / 1000).toFixed(1));
  const ok = !docs.timedOut && !docs.stuck && report.ready && seconds <= 180;
  return {
    label,
    ok,
    task_id: taskId,
    seconds,
    documents_terminal: `${docs.terminal}/${docs.total}`,
    stuck: docs.stuck ?? null,
    chapters: report.chapters,
    citations: report.citations ? `${report.citations.coverage_pct}% valid, ${report.citations.invalid_count} invalid` : 'n/a',
  };
}

function p90(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.9) - 1)];
}

// ---------------------------------------------------------------- T-044 runs
const runs = [];
for (let i = 1; i <= RUNS; i += 1) {
  const r = await timedDemoRun(`run${i}`);
  runs.push(r);
  console.log(`${r.label}: ${r.ok ? 'PASS' : 'FAIL'} ${r.seconds}s docs=${r.documents_terminal} chapters=${r.chapters} citations=${r.citations}`);
}
const okRuns = runs.filter((r) => r.ok);
const times = okRuns.map((r) => r.seconds);
const p90Seconds = times.length ? p90(times) : null;
const runsPass = okRuns.length === RUNS && p90Seconds !== null && p90Seconds <= 180;
console.log(`\nT-044: ${okRuns.length}/${RUNS} runs passed; P90 = ${p90Seconds}s (target <= 180s) -> ${runsPass ? 'PASS' : 'FAIL'}`);

// --------------------------------------------------------- T-045 first screen
const screens = [];
for (let i = 0; i < 5; i += 1) {
  const t0 = Date.now();
  const res = await fetch(BASE + '/', { redirect: 'follow' });
  await res.text();
  screens.push(Date.now() - t0);
}
const screensAvg = Math.round(screens.reduce((a, b) => a + b, 0) / screens.length);
const firstScreenPass = screensAvg <= 3000;
console.log(`T-045 first screen: ${screens.join(', ')} ms; average ${screensAvg} ms (target <= 3000 ms) -> ${firstScreenPass ? 'PASS' : 'FAIL'}`);

// ------------------------------------------------- T-045 three concurrent runs
const concStarted = Date.now();
const kickoffs = await Promise.all([1, 2, 3].map(() => api('/api/demo/load', { method: 'POST' })));
const concDeadline = concStarted + REPORT_BUDGET_MS;
const concTasks = kickoffs.map((k, i) => ({ i: i + 1, kickoff: k.status, taskId: k.body?.task_id }));
const concResults = await Promise.all(concTasks.map(async (t) => {
  if (!t.taskId) return { ...t, ok: false, reason: 'no task id' };
  const docs = await waitForDocuments(t.taskId, concDeadline);
  const report = await waitForReport(t.taskId, concDeadline);
  return {
    ...t,
    ok: !docs.timedOut && report.ready,
    seconds: Number(((Date.now() - concStarted) / 1000).toFixed(1)),
    documents_terminal: `${docs.terminal}/${docs.total}`,
    chapters: report.chapters,
  };
}));
const concPass = concTasks.every((t) => t.kickoff === 202) && concResults.every((r) => r.ok);
console.log(`T-045 concurrency: kickoffs=${concTasks.map((t) => t.kickoff).join(',')} completed=${concResults.filter((r) => r.ok).length}/3 in ${((Date.now() - concStarted) / 1000).toFixed(0)}s -> ${concPass ? 'PASS' : 'FAIL'}`);
for (const r of concResults) console.log(`  task ${r.i}: ${r.ok ? 'PASS' : 'FAIL'} docs=${r.documents_terminal} chapters=${r.chapters}`);

// -------------------------------------------------------- T-045 cost per doc
const costTask = okRuns[okRuns.length - 1];
let costPass = false;
let costMeasured = 'not measured';
let costDetail = null;
if (costTask) {
  const traces = await api(`/api/tasks/${costTask.task_id}/traces`);
  const list = traces.body?.traces ?? [];
  const totalUsd = list.reduce((a, t) => a + (t.usage?.est_cost_usd ?? 0), 0);
  const documents = 20;
  const perDoc = totalUsd / documents;
  const byStage = {};
  for (const t of list) byStage[t.stage] = Number(((byStage[t.stage] ?? 0) + (t.usage?.est_cost_usd ?? 0)).toFixed(6));
  costPass = perDoc <= 0.03;
  costMeasured = `$${perDoc.toFixed(5)}/document (${list.length} model calls, $${totalUsd.toFixed(4)} total over ${documents} documents)`;
  costDetail = { task_id: costTask.task_id, calls: list.length, total_usd: Number(totalUsd.toFixed(6)), per_document_usd: Number(perDoc.toFixed(6)), by_stage: byStage };
  console.log(`T-045 cost: ${costMeasured} (target <= $0.03) -> ${costPass ? 'PASS' : 'FAIL'}`);
}

// ------------------------------------------------------------------- evidence
mkdirSync(join(ROOT, 'progress/evidence/T-044'), { recursive: true });
mkdirSync(join(ROOT, 'progress/evidence/T-045'), { recursive: true });
mkdirSync(join(ROOT, 'eval/results'), { recursive: true });

const summary = {
  base_url: BASE,
  generated_at: new Date().toISOString(),
  runs,
  runs_passed: okRuns.length,
  p90_seconds: p90Seconds,
  runs_pass: runsPass,
  first_screen_ms: screens,
  first_screen_avg_ms: screensAvg,
  first_screen_pass: firstScreenPass,
  concurrent: concResults,
  concurrent_pass: concPass,
  cost: costDetail,
  cost_pass: costPass,
};
writeFileSync(join(ROOT, 'progress/evidence/T-044/public_runs.json'), JSON.stringify(summary, null, 2));
writeFileSync(join(ROOT, 'progress/evidence/T-045/public_perf.json'), JSON.stringify(summary, null, 2));
writeFileSync(join(ROOT, 'eval/results/e2e_latency_p90.json'), JSON.stringify({
  measured: `${p90Seconds}s (P90 of ${times.length} public one-click runs)`,
  pass: runsPass,
  detail: { runs_seconds: times, runs_passed: okRuns.length, runs_expected: RUNS, first_screen_avg_ms: screensAvg },
}, null, 2));
writeFileSync(join(ROOT, 'eval/results/ai_cost_per_document.json'), JSON.stringify({
  measured: costMeasured,
  pass: costPass,
  detail: costDetail,
}, null, 2));

console.log('\nEvidence written: progress/evidence/T-044/public_runs.json, progress/evidence/T-045/public_perf.json');
console.log(`OVERALL: ${runsPass && firstScreenPass && concPass && costPass ? 'PASS' : 'FAIL'}`);
process.exit(runsPass && firstScreenPass && concPass && costPass ? 0 : 1);
