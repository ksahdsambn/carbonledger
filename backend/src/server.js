// HTTP entrypoint. Minimal at this stage: health check, structured request
// logging, and a uniform error envelope backed by the error registry.

import express from 'express';
import { pathToFileURL } from 'node:url';
import multer from 'multer';
import { log } from './logging.js';
import { errorResponse, AppError } from './errors.js';
import { getConfig } from './config.js';
import { createStore } from './store/index.js';
import { createStorage } from './storage/index.js';
import { loadFactorLibrary, getFactorById, searchFactorsByKeyword, listFactors } from './services/factorLibrary.js';
import { createTask, getTask } from './services/taskService.js';
import { ingestFile, resolveDuplicate, setDocumentStatus, getDocumentFile } from './services/fileService.js';
import { runPipeline } from './services/pipeline.js';
import { listReviewQueue, editRecordFields, assignFactorManually, excludeRecord, closeReviewItem, recalculateTask } from './services/reviewQueue.js';
import { scanReportCitations, assembleReport } from './services/reportService.js';
import { computeScenarios } from './services/scenarios.js';
import { activityDetailCsv, categorySummaryCsv, reportPdf } from './services/exportService.js';
import { buildMockCatalogFromDataset } from './services/mockCatalog.js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const upload = multer({ storage: multer.memoryStorage() });

export async function buildApp() {
  const app = express();
  app.use(express.json({ limit: '12mb' }));

  // Express 4 does not catch async rejections: auto-wrap async handlers.
  const wrapAsync = (mw) => (mw.constructor && mw.constructor.name === 'AsyncFunction')
    ? (req, res, next) => Promise.resolve(mw(req, res, next)).catch(next)
    : mw;
  for (const method of ['get', 'post', 'put', 'delete']) {
    const orig = app[method].bind(app);
    app[method] = (path, ...mws) => orig(path, ...mws.map(wrapAsync));
  }

  app.use((req, res, next) => {
    log.info('http_request', { method: req.method, path: req.path });
    req.uid = req.headers['x-user-uid'] ?? null; // anonymous-auth identity
    res.setHeader('Cache-Control', 'no-store'); // dynamic API responses must bypass CDNs
    next();
  });

  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/config', (_req, res) => {
    // Returns non-secret configuration entries only.
    const { entries } = getConfig();
    res.json({
      parameters: Object.fromEntries(
        Object.entries(entries).map(([k, e]) => [k, { value: e.value, default: e.default, overriddenByEnv: e.overriddenByEnv }]),
      ),
    });
  });

  const store = await createStore();
  const storage = await createStorage();

  // CORS for the Firebase Hosting origin (and local dev).
  const allowed = (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',');
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && (allowed.includes(origin) || /\.web\.app$|\.firebaseapp\.com$/.test(new URL(origin).hostname))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'content-type,x-user-uid');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      if (req.method === 'OPTIONS') { res.status(204).end(); return; }
    }
    next();
  });

  // Basic per-IP rate limiting for the public deployment (NFR-303).
  const rateBuckets = new Map();
  const RATE_LIMIT = Number(process.env.RATE_LIMIT_PER_MIN || 60);
  app.use((req, res, next) => {
    if (req.path === '/healthz') { next(); return; }
    const ip = req.headers['x-forwarded-for']?.split(',')[0] ?? req.socket.remoteAddress ?? 'unknown';
    const now = Date.now();
    const b = rateBuckets.get(ip) ?? { tokens: RATE_LIMIT, ts: now };
    if (now - b.ts > 60000) { b.tokens = RATE_LIMIT; b.ts = now; }
    if (b.tokens <= 0) {
      res.status(429).json({ error: { code: 'ERR_RATE_LIMITED', message: 'Too many requests; please slow down.' } });
      return;
    }
    b.tokens -= 1;
    rateBuckets.set(ip, b);
    next();
  });
  loadFactorLibrary(store).catch((err) => log.error('factor_library_load_failed', { error: String(err) }));

  app.get('/factors', async (req, res) => {
    const q = String(req.query.q || '').trim();
    if (!q) {
      res.status(400).json({ error: { code: 'ERR_INTERNAL', message: 'Provide ?q=<keywords> (comma separated).' } });
      return;
    }
    const terms = q.split(',').map((s) => s.trim()).filter(Boolean);
    const hits = await searchFactorsByKeyword(store, terms);
    res.json({ count: hits.length, factors: hits.map(({ embedding, ...f }) => f) });
  });

  app.get('/factors/:id', async (req, res) => {
    const factor = await getFactorById(store, req.params.id);
    if (!factor) throw new AppError('ERR_REFERENCE_INVALID', { factor_id: req.params.id });
    const { embedding, ...rest } = factor;
    res.json(rest);
  });

  app.post('/api/tasks', async (req, res) => {
    const task = await createTask(store, { ...req.body, owner_uid: req.uid });
    res.status(201).json(task);
  });

  app.get('/api/tasks/:taskId', async (req, res) => {
    const task = await getTask(store, req.params.taskId);
    const documents = await store.query('documents', 'task_id', req.params.taskId);
    res.json({ ...task, documents });
  });

  app.post('/api/tasks/:taskId/documents', upload.array('files', 50), async (req, res) => {
    await getTask(store, req.params.taskId); // 404 if unknown task
    const results = [];
    for (const f of req.files || []) {
      results.push(await ingestFile({
        store, storage, taskId: req.params.taskId,
        filename: f.originalname, buffer: f.buffer,
      }));
    }
    res.json({ count: results.length, results });
  });

  app.get('/api/tasks/:taskId/documents', async (req, res) => {
    res.json({ documents: await store.query('documents', 'task_id', req.params.taskId) });
  });

  app.get('/api/tasks/:taskId/documents/:docId/file', async (req, res) => {
    const doc = await store.get('documents', req.params.docId);
    const task = await store.get('tasks', req.params.taskId);
    // NFR-301: uploaded files are only accessible within their owning task.
    if (!doc || doc.task_id !== req.params.taskId || (task?.owner && task.owner !== req.headers['x-user-uid'])) {
      throw new AppError('ERR_TASK_NOT_FOUND', { document_id: req.params.docId });
    }
    const buf = await getDocumentFile(storage, doc);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.send(buf);
  });

  app.post('/api/tasks/:taskId/documents/:docId/duplicate', async (req, res) => {
    const doc = await resolveDuplicate({
      store, taskId: req.params.taskId, documentId: req.params.docId, keep: Boolean(req.body?.keep),
    });
    res.json(doc);
  });

  app.post('/api/tasks/:taskId/documents/:docId/status', async (req, res) => {
    const doc = await setDocumentStatus(store, req.params.taskId, req.params.docId, req.body?.status);
    res.json(doc);
  });

  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');
  const latestReport = async (taskId) => {
    const reports = await store.query('reports', 'task_id', taskId);
    return reports.sort((a, b) => String(b.generated_at).localeCompare(String(a.generated_at)))[0] ?? null;
  };

  app.post('/api/tasks/:taskId/run', async (req, res) => {
    const catalog = req.body?.useMockCatalog
      ? buildMockCatalogFromDataset(join(repoRoot, 'data/demo'), readFileSync)
      : new Map();
    // Async job pattern: the pipeline continues on the instance after the
    // response (CPU allocation is always-on); clients poll task state.
    runPipeline({ store, storage, taskId: req.params.taskId, mockCatalog: catalog })
      .then((out) => log.info('pipeline_job_done', { task_id: req.params.taskId, ...out.summary }))
      .catch((err) => log.error('pipeline_job_failed', { task_id: req.params.taskId, error: String(err.message).slice(0, 200) }));
    res.status(202).json({ task_id: req.params.taskId, started: true });
  });

  app.post('/api/demo/load', async (_req, res) => {
    // One-click demo dataset (FR-1203): create the task, upload all 20 demo
    // documents, run the full pipeline, return the summary.
    const demoDir = join(repoRoot, 'data/demo');
    const manifest = JSON.parse(readFileSync(join(demoDir, 'manifest.json'), 'utf8'));
    const task = await createTask(store, {
      entity_name: manifest.company.name,
      period_from: manifest.company.reporting_period.from,
      period_to: manifest.company.reporting_period.to,
      gwp_version: 'AR6',
    });
    for (const d of manifest.documents) {
      const file = d.file.split('/').pop();
      await ingestFile({ store, storage, taskId: task.task_id, filename: file, buffer: readFileSync(join(repoRoot, d.file)) });
    }
    runPipeline({ store, storage, taskId: task.task_id, mockCatalog: buildMockCatalogFromDataset(demoDir, readFileSync) })
      .then((out) => log.info('pipeline_job_done', { task_id: task.task_id, ...out.summary }))
      .catch((err) => log.error('pipeline_job_failed', { task_id: task.task_id, error: String(err.message).slice(0, 200) }));
    res.status(202).json({ task_id: task.task_id, started: true });
  });

  app.get('/api/tasks/:taskId/dashboard', async (req, res) => {
    res.json(await recalculateTask({ store, taskId: req.params.taskId }));
  });

  app.get('/api/tasks/:taskId/report', async (req, res) => {
    let report = await latestReport(req.params.taskId);
    if (!report) {
      // Lazy self-healing generation: if the background job was interrupted
      // (e.g. instance scaled to zero), assemble the report on demand from
      // the persisted records and calculations.
      const task = await getTask(store, req.params.taskId);
      const records = await store.query('activity_records', 'task_id', req.params.taskId);
      if (records.length === 0) throw new AppError('ERR_TASK_NOT_FOUND', { hint: 'no report can be generated yet' });
      const { aggregate, topEmitters } = await import('./services/calculation.js');
      const calcsWithMeta = [];
      for (const r of records) {
        if (r.excluded_from_calc) continue;
        const calc = await store.get('calculations', `calc_${r.record_id}`);
        if (calc) calcsWithMeta.push({ calc, meta: r });
      }
      const factorsById = Object.fromEntries((await listFactors(store)).map((f) => [f.factor_id, f]));
      const agg = aggregate(calcsWithMeta);
      const top = topEmitters(calcsWithMeta);
      const scenarioOut = await computeScenarios({
        store, taskId: req.params.taskId, records: records.filter((r) => !r.excluded_from_calc),
        calcs: calcsWithMeta.map((x) => x.calc), factorsById, taskGwpVersion: task.gwp_version,
      });
      report = await assembleReport({ store, taskId: req.params.taskId, task, records, calcs: calcsWithMeta.map((x) => x.calc), calcsWithMeta, agg, top, scenarios: scenarioOut, factorsById });
      log.info('report_lazy_generated', { task_id: req.params.taskId });
    }
    const citations = await scanReportCitations(store, report);
    res.json({ report, citations });
  });

  app.get('/api/tasks/:taskId/report/export', async (req, res) => {
    const report = await latestReport(req.params.taskId);
    if (!report) throw new AppError('ERR_TASK_NOT_FOUND', { hint: 'no report generated yet' });
    const records = await store.query('activity_records', 'task_id', req.params.taskId);
    const calcs = await store.query('calculations', 'task_id', req.params.taskId);
    if (req.query.fmt === 'csv-detail') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="activity_detail.csv"');
      res.send(activityDetailCsv(report, calcs, records));
    } else if (req.query.fmt === 'csv-category') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="category_summary.csv"');
      res.send(categorySummaryCsv(report));
    } else {
      const pdf = await reportPdf(report);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="carbonledger_report.pdf"');
      res.send(pdf);
    }
  });

  app.get('/api/tasks/:taskId/review', async (req, res) => {
    res.json({ items: await listReviewQueue(store, req.params.taskId) });
  });

  app.post('/api/tasks/:taskId/review/:recordId', async (req, res) => {
    const { action } = req.body ?? {};
    const taskId = req.params.taskId;
    const recordId = req.params.recordId;
    if (action === 'edit') await editRecordFields({ store, taskId, recordId, patch: req.body.patch });
    else if (action === 'assign') await assignFactorManually({ store, taskId, recordId, factorId: req.body.factor_id });
    else if (action === 'exclude') await excludeRecord({ store, taskId, recordId, reason: req.body.reason });
    else if (action === 'close') await closeReviewItem({ store, taskId, recordId, note: req.body.note });
    else throw new AppError('ERR_ENUM_INVALID', { action });
    const refreshed = await recalculateTask({ store, taskId });
    res.json(refreshed);
  });

  app.get('/api/tasks/:taskId/records/:recordId/audit', async (req, res) => {
    const records = await store.query('activity_records', 'task_id', req.params.taskId);
    const record = records.find((r) => r.record_id === req.params.recordId);
    if (!record) throw new AppError('ERR_TASK_NOT_FOUND', { record_id: req.params.recordId });
    const calc = await store.get('calculations', `calc_${record.record_id}`);
    const audits = (await store.list('audit_trail')).filter(
      (a) => a.object_id === record.record_id || a.object_id === `calc_${record.record_id}`,
    );
    res.json({ record, calculation: calc, audit_trail: audits });
  });

  app.get('/api/tasks/:taskId/traces', async (req, res) => {
    const stage = req.query.stage;
    let traces = await store.query('ai_traces', 'task_id', req.params.taskId);
    if (stage) traces = traces.filter((t) => t.stage === stage);
    res.json({ count: traces.length, traces });
  });

  app.use((_req, _res, next) => {
    next(new AppError('ERR_TASK_NOT_FOUND', { hint: 'route not implemented yet' }));
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    const { status, body } = errorResponse(err);
    if (status >= 500) log.error('http_error', { status, code: body.error.code });
    res.status(status).json(body);
  });

  return app;
}

export async function startServer(port = Number(process.env.PORT || 8080)) {
  const app = await buildApp();
  return app.listen(port, () => {
    log.info('server_started', { port });
  });
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  startServer().catch((err) => { console.error(err); process.exit(1); });
}
