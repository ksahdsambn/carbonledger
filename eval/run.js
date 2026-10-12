#!/usr/bin/env node
// Evaluation tool (PRD 10.1, output contract EV-1..EV-6).
//
// Usage:
//   node eval/run.js                  -> run all metric groups
//   node eval/run.js --group matching -> run a single metric group
//   node eval/run.js --out <dir>      -> result output directory
//
// EV-1  single complete table with columns: Metric | Target | Measured | Result
// EV-2  Result column carries exactly PASS or FAIL
// EV-3  summary row with passed/failed counts and overall verdict
// EV-4  a non-zero invalid-reference count vetoes the overall verdict
// EV-5  run-all or run-single-group modes
// EV-6  writes a machine-readable JSON file and a human-readable summary

import { mkdirSync, writeFileSync } from 'node:fs';
import { METRICS, METRIC_GROUPS } from './metrics.js';
import { makeCollector } from './collectors.js';

const EVIDENCE_FILES = Object.fromEntries(
  METRICS.map((m) => [m.id, `${m.id}.json`])
);

function parseArgs(argv) {
  const args = { group: 'all', out: 'eval/results/run' };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--group') args.group = argv[i + 1];
    else if (argv[i] === '--out') args.out = argv[i + 1];
  }
  return args;
}

function collectRows(group, resultsDir) {
  const collector = makeCollector(resultsDir, EVIDENCE_FILES);
  const selected = group === 'all' ? METRICS : METRICS.filter((m) => m.group === group);
  if (selected.length === 0) {
    throw new Error(`Unknown group '${group}'. Available: all, ${METRIC_GROUPS.join(', ')}`);
  }
  return selected.map((m) => {
    const c = collector.collect(m.id);
    return {
      id: m.id,
      group: m.group,
      name: m.name,
      target: m.target,
      measured: c.measured,
      pass: c.pass,
      mandatory: m.mandatory,
      veto: Boolean(m.veto),
      evidence: c.evidence,
      result: c.pass ? 'PASS' : 'FAIL',
    };
  });
}

function summarize(rows) {
  const passed = rows.filter((r) => r.pass).length;
  const failed = rows.length - passed;
  const vetoed = rows.some((r) => r.veto && !r.pass);
  const overall = rows.length > 0 && failed === 0 && !vetoed ? 'PASS' : 'FAIL';
  return { passed, failed, overall, vetoed };
}

function renderTable(rows, summary) {
  const lines = [];
  lines.push('| Metric | Target | Measured | Result |');
  lines.push('|---|---|---|---|');
  for (const r of rows) {
    lines.push(`| ${r.name} | ${r.target} | ${r.measured === '' ? '(not measured)' : r.measured} | ${r.result} |`);
  }
  lines.push(`| **Summary** | rows=${rows.length} | passed=${summary.passed} failed=${summary.failed}${summary.vetoed ? ' (VETO triggered)' : ''} | **${summary.overall}** |`);
  return lines.join('\n');
}

const args = parseArgs(process.argv);
const resultsDir = 'eval/results';
const rows = collectRows(args.group, resultsDir);
const summary = summarize(rows);

const table = renderTable(rows, summary);
const machine = {
  run_at: new Date().toISOString(),
  mode: args.group,
  rows: rows.map(({ result, ...rest }) => ({ ...rest, result })),
  summary,
};

mkdirSync(args.out, { recursive: true });
writeFileSync(`${args.out}/evaluation.json`, JSON.stringify(machine, null, 2));
writeFileSync(`${args.out}/evaluation.md`, `${table}\n`);

console.log(table);
console.log(`\nOverall verdict: ${summary.overall}${summary.vetoed ? ' (invalid-reference veto)' : ''}`);
console.log(`Machine-readable: ${args.out}/evaluation.json`);
console.log(`Human-readable:   ${args.out}/evaluation.md`);
process.exitCode = summary.overall === 'PASS' ? 0 : 1;
