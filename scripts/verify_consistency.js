#!/usr/bin/env node
// Report/ledger consistency guard (T-050 defect).
//
// A report must follow from the ledger it was built from: every per-record
// factor and emission shown in the report has to equal the value recomputed
// from that task's stored records and matches. Report generation was once not
// single-flight, so a report could be assembled from a partially written
// ledger; this check keeps that from coming back.
//
// Usage: node scripts/verify_consistency.js [taskId ...]
//        (default: the tasks recorded in progress/evidence/T-044/public_runs.json)
// Evidence: progress/evidence/T-050/consistency.json
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.PUBLIC_BASE || 'https://myproject-dc19d.web.app';

const api = async (path) => {
  const res = await fetch(BASE + path);
  return { status: res.status, body: await res.json().catch(() => null) };
};

let taskIds = process.argv.slice(2);
if (taskIds.length === 0) {
  const evidence = join(ROOT, 'progress/evidence/T-044/public_runs.json');
  if (!existsSync(evidence)) {
    console.error('No task ids given and progress/evidence/T-044/public_runs.json is missing.');
    process.exit(2);
  }
  taskIds = JSON.parse(readFileSync(evidence, 'utf8')).runs.map((r) => r.task_id).filter(Boolean);
}

const results = [];
let failures = 0;

for (const taskId of taskIds) {
  const report = (await api(`/api/tasks/${taskId}/report?cb=${Date.now()}`)).body;
  const dashboard = (await api(`/api/tasks/${taskId}/dashboard`)).body;
  if (!report?.report || !dashboard?.calcs) {
    results.push({ task_id: taskId, ok: false, reason: 'report or dashboard unavailable' });
    failures += 1;
    continue;
  }
  const chapter5 = report.report.chapters.find((c) => c.no === 5)?.blocks.find((b) => b.type === 'table');
  const rows = chapter5?.rows ?? [];
  const recomputed = new Map(dashboard.calcs.map((c) => [c.activity_record_id, c]));
  const records = new Map((dashboard.records ?? []).map((r) => [r.record_id, r]));

  const byDescription = new Map();
  for (const [rid, rec] of records) byDescription.set(String(rec.item_description), rid);

  // Records excluded from accounting carry no calculation by design; they must
  // instead appear in chapter 10 with a reason.
  const excludedRows = (report.report.chapters.find((c) => c.no === 10)?.blocks ?? []).flatMap((b) => b.rows ?? []);
  const excludedIds = new Set(excludedRows.map((r) => r[0]));

  const mismatches = [];
  for (const row of rows) {
    const excluded = String(row[5] ?? '').includes('(excluded)');
    if (excluded) {
      if (row[3] !== '—' || Number(row[4]) !== 0) mismatches.push({ description: String(row[1]).slice(0, 40), reason: 'excluded record still carries a factor or an emission' });
      continue;
    }
    const rid = byDescription.get(String(row[1]));
    if (!rid) { mismatches.push({ description: String(row[1]).slice(0, 40), reason: 'record not found in ledger' }); continue; }
    if (excludedIds.has(rid)) { mismatches.push({ record_id: rid, description: String(row[1]).slice(0, 40), reason: 'record is in the excluded list but is reported as included' }); continue; }
    const calc = recomputed.get(rid);
    if (!calc) { mismatches.push({ record_id: rid, reason: 'no calculation in ledger', report_factor: row[3] }); continue; }
    if (calc.factor_id !== row[3]) {
      mismatches.push({ record_id: rid, description: String(row[1]).slice(0, 40), report_factor: row[3], ledger_factor: calc.factor_id });
    }
    if (Math.abs(Number(row[4]) - Math.round(calc.emission_kgco2e) / 1000) > 0.0015) {
      mismatches.push({ record_id: rid, description: String(row[1]).slice(0, 40), report_t: row[4], ledger_t: Number((calc.emission_kgco2e / 1000).toFixed(3)) });
    }
  }
  // Excluded records must be disclosed, and they must not be counted.
  for (const [rid, rec] of records) {
    if (!rec.excluded_from_calc) continue;
    if (!excludedIds.has(rid)) mismatches.push({ record_id: rid, reason: 'excluded from the calculation but absent from the report exclusion list' });
  }
  const totalOk = Math.abs(report.report.meta.total_kgco2e - dashboard.total_kgco2e) < 1;
  if (!totalOk) mismatches.push({ reason: 'report total differs from the ledger total', report_t: report.report.meta.total_t, ledger_t: Number((dashboard.total_kgco2e / 1000).toFixed(3)) });

  const ok = mismatches.length === 0;
  if (!ok) failures += 1;
  results.push({ task_id: taskId, ok, rows: rows.length, mismatches });
  console.log(`${taskId}: ${ok ? 'PASS' : 'FAIL'} (${rows.length} rows, ${mismatches.length} mismatch(es))`);
  for (const m of mismatches.slice(0, 4)) console.log('    ', JSON.stringify(m));
}

mkdirSync(join(ROOT, 'progress/evidence/T-050'), { recursive: true });
writeFileSync(join(ROOT, 'progress/evidence/T-050/consistency.json'), JSON.stringify({
  base_url: BASE,
  generated_at: new Date().toISOString(),
  tasks_checked: taskIds.length,
  tasks_failed: failures,
  results,
  overall: failures === 0 ? 'PASS' : 'FAIL',
}, null, 2));

console.log(`\nReport/ledger consistency: ${taskIds.length - failures}/${taskIds.length} tasks consistent -> ${failures === 0 ? 'PASS' : 'FAIL'}`);
process.exit(failures === 0 ? 0 : 1);
