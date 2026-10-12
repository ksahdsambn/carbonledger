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
import { loadFactorLibrary, getFactorById, searchFactorsByKeyword } from './services/factorLibrary.js';
import { createTask, getTask } from './services/taskService.js';
import { ingestFile, resolveDuplicate, setDocumentStatus, getDocumentFile } from './services/fileService.js';

const upload = multer({ storage: multer.memoryStorage() });

export function buildApp() {
  const app = express();
  app.use(express.json({ limit: '12mb' }));

  app.use((req, _res, next) => {
    log.info('http_request', { method: req.method, path: req.path });
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

  const store = createStore();
  const storage = createStorage();
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
    const task = await createTask(store, req.body || {});
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
    if (!doc || doc.task_id !== req.params.taskId) {
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

export function startServer(port = Number(process.env.PORT || 8080)) {
  const app = buildApp();
  return app.listen(port, () => {
    log.info('server_started', { port });
  });
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  startServer();
}
