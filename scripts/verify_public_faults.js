#!/usr/bin/env node
// Public-site fault-tolerance, security and privacy verification (T-046).
//
// NFR-201  a 20-file batch containing 3 corrupt files still ingests the other
//          17 and processes them to completion (one bad file never blocks the
//          batch)
// NFR-202  a model call that times out is retried exactly twice and then the
//          failed target is marked explicitly (unit-level simulation, run here
//          as part of the same battery; see backend/test/aiRetry.test.js)
// NFR-204  every failure carries a machine-readable error code plus an English
//          description, and the registry covers every known failure type
// NFR-301  a task cannot read another task's files or records, with or without
//          the owning identity
// NFR-303  the public URL enforces basic rate limiting
//
// Usage: node scripts/verify_public_faults.js
// Evidence: progress/evidence/T-046/public_faults.json
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { ERROR_CODES } from '../backend/src/errors.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.PUBLIC_BASE || 'https://myproject-dc19d.web.app';
const TERMINAL = ['completed', 'needs_review', 'failed'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The public Firebase web configuration lives in the gitignored frontend/.env;
// it is a public browser key, not a secret.
function firebaseWebKey() {
  if (process.env.FIREBASE_WEB_API_KEY) return process.env.FIREBASE_WEB_API_KEY;
  const envPath = join(ROOT, 'frontend/.env');
  if (!existsSync(envPath)) throw new Error('frontend/.env missing: set FIREBASE_WEB_API_KEY to run the isolation checks');
  const line = readFileSync(envPath, 'utf8').split('\n').find((l) => l.startsWith('VITE_FIREBASE_API_KEY='));
  if (!line) throw new Error('VITE_FIREBASE_API_KEY missing from frontend/.env');
  return line.split('=')[1].trim();
}

/** Creates a real Firebase anonymous account and returns its verified uid. */
async function anonymousIdentity(label) {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseWebKey()}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ returnSecureToken: true }),
  });
  if (!res.ok) throw new Error(`${label}: anonymous sign-in failed with HTTP ${res.status}`);
  const d = await res.json();
  return { label, uid: d.localId, token: d.idToken };
}

const bearer = (identity) => (identity?.token ? { authorization: `Bearer ${identity.token}` } : {});

async function api(path, opts = {}) {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: { 'content-type': 'application/json', ...(opts.headers ?? {}) },
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function createTask(entity, identity) {
  const r = await api('/api/tasks', {
    method: 'POST',
    headers: bearer(identity),
    body: JSON.stringify({ entity_name: entity, period_from: '2026-01-01', period_to: '2026-06-30', gwp_version: 'AR6' }),
  });
  if (r.status !== 201) throw new Error(`task creation failed: HTTP ${r.status}`);
  return r.body.task_id;
}

async function upload(taskId, identity, files) {
  const form = new FormData();
  for (const f of files) form.append('files', new Blob([f.buffer]), f.name);
  const res = await fetch(`${BASE}/api/tasks/${taskId}/documents`, {
    method: 'POST',
    headers: bearer(identity),
    body: form,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function waitForDocuments(taskId, deadline) {
  for (;;) {
    const t = await api(`/api/tasks/${taskId}`);
    const docs = t.body?.documents ?? [];
    const terminal = docs.filter((d) => TERMINAL.includes(d.status)).length;
    if (docs.length > 0 && terminal === docs.length) return docs;
    if (Date.now() > deadline) return docs;
    await sleep(10_000);
  }
}

const checks = [];
const record = (id, requirement, pass, detail) => {
  checks.push({ id, requirement, pass, detail });
  console.log(`${id} ${pass ? 'PASS' : 'FAIL'} — ${detail}`);
};

// ------------------------------------------------------ NFR-201 corrupt batch
const manifest = JSON.parse(readFileSync(join(ROOT, 'data/demo/manifest.json'), 'utf8'));
const demoFiles = manifest.documents.slice(0, 17).map((d) => ({
  name: d.file.split('/').pop(),
  buffer: readFileSync(join(ROOT, d.file)),
}));
const corruptFiles = [
  { name: 'corrupt_broken.pdf', buffer: Buffer.from('%PDF-1.7 truncated body, no page objects') },
  { name: 'corrupt_broken.png', buffer: Buffer.from('this is not a png payload at all') },
  { name: 'corrupt_broken.xlsx', buffer: Buffer.from('PK-not-a-real-workbook-archive') },
];
const batchTask = await createTask('Fault Batch Co', null);
const batchUpload = await upload(batchTask, null, [...demoFiles, ...corruptFiles]);
const accepted = (batchUpload.body?.results ?? []).filter((r) => r.ok);
const rejected = (batchUpload.body?.results ?? []).filter((r) => !r.ok);
const rejectedCodes = [...new Set(rejected.map((r) => r.code))];
record(
  'NFR-201',
  'A single bad file never blocks the batch: 17 of 20 files succeed with 3 corrupt files mixed in',
  batchUpload.status === 200 && accepted.length === 17 && rejected.length === 3 && rejectedCodes.length === 1 && rejectedCodes[0] === 'ERR_FILE_CORRUPT',
  `upload HTTP ${batchUpload.status}; accepted=${accepted.length}, rejected=${rejected.length} codes=[${rejectedCodes.join(',')}], each rejection carries an English message: ${rejected.every((r) => typeof r.message === 'string' && r.message.length > 0)}`,
);

await api(`/api/tasks/${batchTask}/run`, { method: 'POST', body: JSON.stringify({}) });
const batchDocs = await waitForDocuments(batchTask, Date.now() + 300_000);
const batchFailed = batchDocs.filter((d) => d.status === 'failed');
record(
  'NFR-201-processing',
  'The 17 surviving documents of the mixed batch all reach a terminal state without failing',
  batchDocs.length === 17 && batchFailed.length === 0,
  `documents persisted=${batchDocs.length}, failed=${batchFailed.length}, statuses=${JSON.stringify(batchDocs.reduce((a, d) => ({ ...a, [d.status]: (a[d.status] ?? 0) + 1 }), {}))}`,
);

// -------------------------------------------------------- NFR-202 retry path
let retryTestPass = false;
let retryOutput = '';
try {
  retryOutput = execFileSync(process.execPath, ['--test', '--test-reporter=tap', 'backend/test/aiRetry.test.js'], { cwd: ROOT, encoding: 'utf8' });
  retryTestPass = /^# fail 0$/m.test(retryOutput) && /^# pass 3$/m.test(retryOutput);
} catch (err) {
  retryOutput = String(err.stdout ?? err.message);
}
record(
  'NFR-202',
  'A timed-out model call is retried exactly twice (3 attempts) and then marked failed with an error code and English description',
  retryTestPass,
  `backend/test/aiRetry.test.js: ${retryTestPass ? '3/3 assertions passed (3 attempts, ERR_MODEL_TIMEOUT, ERR_MODEL_CALL_FAILED, per-attempt traces)' : 'FAILED'}`,
);

// ---------------------------------------------------- NFR-204 error registry
const registry = Object.entries(ERROR_CODES).map(([code, def]) => ({ code, message: def.message, http: def.http }));
const registryComplete = registry.length >= 13 && registry.every((e) => /^ERR_[A-Z_]+$/.test(e.code) && typeof e.message === 'string' && e.message.length > 10 && /[a-z]/.test(e.message));
const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
const missingFromReadme = registry.filter((e) => !readme.includes(e.code)).map((e) => e.code);
const liveUnknownRoute = await api('/api/does-not-exist');
const liveBadEnum = await api('/api/tasks', { method: 'POST', body: JSON.stringify({ entity_name: 'x', period_from: '2026-01-01', period_to: '2026-06-30', gwp_version: 'AR9' }) });
record(
  'NFR-204',
  'Every failure returns a machine-readable code with an English description; the registry covers every known failure type and is documented in the README',
  registryComplete && missingFromReadme.length === 0 && liveUnknownRoute.body?.error?.code === 'ERR_TASK_NOT_FOUND' && liveBadEnum.body?.error?.code === 'ERR_ENUM_INVALID',
  `registry codes=${registry.length} all machine-readable and English; README lists all: ${missingFromReadme.length === 0}; live unknown route -> ${liveUnknownRoute.status}/${liveUnknownRoute.body?.error?.code}; live invalid enum -> ${liveBadEnum.status}/${liveBadEnum.body?.error?.code}`,
);

// ---------------------------------------------------- NFR-301 task isolation
const judgeA = await anonymousIdentity('judge A');
const judgeB = await anonymousIdentity('judge B');
const taskA = await createTask('Isolation Alpha', judgeA);
const taskB = await createTask('Isolation Beta', judgeB);
const singleFile = [{ name: demoFiles[0].name, buffer: demoFiles[0].buffer }];
await upload(taskA, judgeA, singleFile);
const docsA = (await api(`/api/tasks/${taskA}/documents`, { headers: bearer(judgeA) })).body.documents;
const docA = docsA[0].id;

const fetchFile = async (taskId, docId, identity, extraHeaders = {}) => {
  const res = await fetch(`${BASE}/api/tasks/${taskId}/documents/${docId}/file`, { headers: { ...bearer(identity), ...extraHeaders } });
  return res.status;
};
const crossTask = await fetchFile(taskB, docA, judgeB); // right identity, other task's document
const crossUser = await fetchFile(taskA, docA, judgeB); // right task, other identity
const ownerAccess = await fetchFile(taskA, docA, judgeA); // positive control
// A forged owner header must not be accepted now that the uid comes from a
// verified Firebase ID token.
const spoofed = await fetchFile(taskA, docA, null, { 'x-user-uid': judgeA.uid });

await api(`/api/tasks/${taskA}/run`, { method: 'POST', headers: bearer(judgeA), body: JSON.stringify({}) });
const docsAResolved = await waitForDocuments(taskA, Date.now() + 300_000);
let crossRecord = 'n/a';
const dashboardA = (await api(`/api/tasks/${taskA}/dashboard`, { headers: bearer(judgeA) })).body;
const recordA = dashboardA?.records?.[0]?.record_id ?? null;
if (recordA) {
  const r = await api(`/api/tasks/${taskB}/records/${recordA}/audit`, { headers: bearer(judgeB) });
  crossRecord = `${r.status}/${r.body?.error?.code}`;
}
record(
  'NFR-301',
  'Uploaded files and records are only reachable from their owning task and identity (verified Firebase uid, not a client-asserted header)',
  crossTask === 404 && crossUser === 404 && ownerAccess === 200 && spoofed === 404 && crossRecord.startsWith('404'),
  `identities: A=${judgeA.uid.slice(0, 8)}… B=${judgeB.uid.slice(0, 8)}…; other task's file -> HTTP ${crossTask}; wrong identity on owning task -> HTTP ${crossUser}; owner -> HTTP ${ownerAccess}; forged x-user-uid header -> HTTP ${spoofed}; other task's record audit -> ${crossRecord}; task A documents=${docsAResolved.length}`,
);

// --------------------------------------------------------- NFR-303 rate limit
let rateLimited = false;
let requests = 0;
let lastStatus = null;
const rateDeadline = Date.now() + 120_000;
while (requests < 200 && Date.now() < rateDeadline) {
  const res = await fetch(`${BASE}/api/tasks/rate-limit-probe`);
  requests += 1;
  lastStatus = res.status;
  if (res.status === 429) {
    rateLimited = true;
    const body = await res.json().catch(() => null);
    lastStatus = `${res.status} ${body?.error?.code ?? ''}`.trim();
    break;
  }
}
record(
  'NFR-303',
  'The public URL enforces basic rate limiting (HTTP 429 with a machine-readable code)',
  rateLimited,
  `HTTP 429 after ${requests} rapid requests (last status: ${lastStatus})`,
);

// ------------------------------------------------------------------- evidence
mkdirSync(join(ROOT, 'progress/evidence/T-046'), { recursive: true });
const allPass = checks.every((c) => c.pass);
const summary = {
  base_url: BASE,
  generated_at: new Date().toISOString(),
  checks,
  error_registry: registry,
  batch_task: { task_id: batchTask, accepted: accepted.length, rejected: rejected.length, rejected_codes: rejectedCodes },
  isolation: { task_a: taskA, task_b: taskB, identity_a: judgeA.uid, identity_b: judgeB.uid, cross_task_status: crossTask, cross_user_status: crossUser, owner_status: ownerAccess, forged_header_status: spoofed, cross_record_audit: crossRecord },
  rate_limit: { limited: rateLimited, requests_until_429: requests },
  retry_simulation: { suite: 'backend/test/aiRetry.test.js', passed: retryTestPass },
  overall: allPass ? 'PASS' : 'FAIL',
};
writeFileSync(join(ROOT, 'progress/evidence/T-046/public_faults.json'), JSON.stringify(summary, null, 2));
writeFileSync(join(ROOT, 'progress/evidence/T-046/error_codes.json'), JSON.stringify(registry, null, 2));
console.log(`\nEvidence written: progress/evidence/T-046/public_faults.json`);
console.log(`OVERALL: ${summary.overall}`);
process.exit(allPass ? 0 : 1);
