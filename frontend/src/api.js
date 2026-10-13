// Backend API helpers. All calls are same-origin (dev proxy /api -> 8080).
// The Firebase anonymous ID token is attached when a session exists; the
// backend verifies it and uses the verified uid as the task owner.
const base = '';
const authHeaders = () => (window.__idToken ? { authorization: `Bearer ${window.__idToken}` } : {});
const json = async (path, opts = {}) => {
  const headers = { 'content-type': 'application/json', ...authHeaders() };
  const res = await fetch(base + path, {
    headers,
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error?.message ?? res.statusText);
  return res.json();
};
export const api = {
  createTask: (body) => json('/api/tasks', { method: 'POST', body }),
  getTask: (id) => json(`/api/tasks/${id}`),
  uploadFiles: async (taskId, files) => {
    const fd = new FormData();
    for (const f of files) fd.append('files', f, f.name);
    const res = await fetch(`/api/tasks/${taskId}/documents`, { method: 'POST', body: fd, headers: authHeaders() });
    return res.json();
  },
  resolveDuplicate: (taskId, docId, keep) => json(`/api/tasks/${taskId}/documents/${docId}/duplicate`, { method: 'POST', body: { keep } }),
  runPipeline: (taskId) => json(`/api/tasks/${taskId}/run`, { method: 'POST', body: { useMockCatalog: !window.__REAL_AI__ } }),
  loadDemo: () => json('/api/demo/load', { method: 'POST' }),
  dashboard: (taskId) => json(`/api/tasks/${taskId}/dashboard`),
  report: (taskId) => json(`/api/tasks/${taskId}/report`),
  review: (taskId) => json(`/api/tasks/${taskId}/review`),
  reviewAction: (taskId, recordId, body) => json(`/api/tasks/${taskId}/review/${recordId}`, { method: 'POST', body }),
  traces: (taskId, stage) => json(`/api/tasks/${taskId}/traces${stage ? `?stage=${stage}` : ''}`),
  records: async (taskId) => (await api.getTask(taskId)).documents,
  factorSearch: async (q) => json(`/factors?q=${encodeURIComponent(q.split(/\s+/).slice(0, 6).join(','))}`),
};
export default api;
