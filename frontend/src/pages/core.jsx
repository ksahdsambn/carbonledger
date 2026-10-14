// Core workflow pages: navigation shell, P1 task creation, P2 upload with
// per-page classification, P3 activity records with the factor-selection view.
import React, { useEffect, useState } from 'react';
import api from '../api.js';
import { useData, Empty, Err, Level, Status, downloadFile, t3 } from './shared.jsx';

export function Nav({ taskId, route, onSwitchTask }) {
  const { data: list } = useData(() => api.listTasks(), []);
  const items = taskId
    ? [['upload', 'P2 Upload'], ['records', 'P3 Records'], ['match', 'P4 Matching'],
       ['dashboard', 'P5 Dashboard'], ['scenarios', 'P6 Scenarios'], ['report', 'P7 Report'],
       ['review', 'P8 Review'], ['traces', 'P9 Traces']]
    : [];
  const tasks = list?.tasks ?? [];
  const known = tasks.some((t) => t.task_id === taskId);
  return (
    <nav className="nav" aria-label="Primary">
      <a href="#/" className="brand">CarbonLedger</a>
      {items.map(([r, label]) => (
        <a key={r} href={`#/${r}`} className={route === r ? 'active' : ''}>{label}</a>
      ))}
      <span className="nav-spacer" aria-hidden />
      <a href="#/library" className={route === 'library' ? 'active' : ''}>Factor library</a>
      <a href="#/tasks" className={route === 'tasks' ? 'active' : ''}>Tasks</a>
      {taskId && (
        <label className="task-switch">
          <span className="visually-hidden">Switch accounting task</span>
          <select value={taskId} onChange={(e) => onSwitchTask(e.target.value)} aria-label="Switch accounting task">
            {!known && <option value={taskId}>{taskId} (current)</option>}
            {tasks.map((t) => (
              <option key={t.task_id} value={t.task_id}>
                {t.entity_name} · {t.period_from}→{t.period_to} · {String(t.created_at ?? '').slice(5, 16).replace('T', ' ')}
              </option>
            ))}
          </select>
        </label>
      )}
    </nav>
  );
}

// ---------------------------------------------------------------- P1
export function P1Home({ onTask }) {
  const [form, setForm] = useState({ entity_name: '', period_from: '2026-01-01', period_to: '2026-06-30', gwp_version: 'AR6' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const { data: recent, err: listErr, reload } = useData(() => api.listTasks(), []);
  const create = async (e) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      const task = await api.createTask(form);
      onTask(task.task_id);
      location.hash = '#/upload';
    } catch (ex) { setErr(ex.message); }
    setBusy(false);
  };
  return (
    <main className="page page-narrow">
      <section className="hero">
        <h1>CarbonLedger</h1>
        <p className="value-prop">CarbonLedger compresses the cost of producing a Scope 3 report
          from "$30,000 + 3 weeks" to "1 hour + near-zero marginal cost", while making every
          single number traceable back to its source document.</p>
        <p className="hint">Track: Sustainability &amp; Social Impact</p>
      </section>
      <form onSubmit={create} className="card task-form" aria-label="Create accounting task">
        <h2>Create an accounting task</h2>
        <label>Reporting entity name
          <input required value={form.entity_name} onChange={(e) => setForm({ ...form, entity_name: e.target.value })} /></label>
        <div className="row">
          <label>Period from<input type="date" required value={form.period_from} onChange={(e) => setForm({ ...form, period_from: e.target.value })} /></label>
          <label>Period to<input type="date" required value={form.period_to} onChange={(e) => setForm({ ...form, period_to: e.target.value })} /></label>
        </div>
        <fieldset>
          <legend>GWP version</legend>
          <div className="gwp-options">
            {['AR5', 'AR6'].map((v) => (
              <label key={v} className="radio">
                <input type="radio" name="gwp" checked={form.gwp_version === v} onChange={() => setForm({ ...form, gwp_version: v })} />
                {v}
                <span className="radio-hint">{v === 'AR6' ? 'IPCC Sixth Assessment · default' : 'IPCC Fifth Assessment'}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {err && <p className="error" role="alert">{err}</p>}
        <button type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create task and continue'}</button>
      </form>
      <section className="card" aria-label="Recent tasks">
        <h2>Recent tasks</h2>
        <Err error={listErr} onRetry={reload} />
        {recent && (recent.tasks.length === 0
          ? <Empty title="No tasks yet">Create one above, or load the demo dataset from the upload page.</Empty>
          : (
            <div className="tablewrap"><table className="tbl">
              <thead><tr><th>Entity</th><th>Period</th><th>GWP</th><th>Documents</th><th>Created</th><th></th></tr></thead>
              <tbody>{recent.tasks.map((t) => (
                <tr key={t.task_id}>
                  <td>{t.entity_name}</td>
                  <td>{t.period_from} → {t.period_to}</td>
                  <td>{t.gwp_version}</td>
                  <td className="num">{t.document_count}</td>
                  <td>{String(t.created_at ?? '').slice(0, 16).replace('T', ' ')}</td>
                  <td className="rowactions">
                    <button className="btn sm" onClick={() => { onTask(t.task_id); location.hash = '#/dashboard'; }}>Open</button>
                    <button className="btn sm ghost" onClick={() => { onTask(t.task_id); location.hash = '#/report'; }}>Report</button>
                  </td>
                </tr>
              ))}</tbody>
            </table></div>
          ))}
      </section>
    </main>
  );
}

// ---------------------------------------------------------------- P2
export function P2Upload({ taskId, onProgress, chooseTaskIfSet }) {
  const [docs, setDocs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const [err, setErr] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const refresh = async () => {
    try {
      setDocs((await api.getTask(taskId)).documents ?? []);
      setErr(null);
    } catch (e) { setErr(e); }
  };
  useEffect(() => { refresh(); const t = setInterval(refresh, 2500); return () => clearInterval(t); }, [taskId]);
  const upload = async (files) => {
    setBusy(true); setNote(null);
    try {
      const res = await api.uploadFiles(taskId, [...files]);
      const dup = res.results.find((r) => r.status === 'pending_duplicate');
      if (dup) {
        const keep = window.confirm(`"${dup.filename}" has the same content as an existing document. Click OK to keep both copies, Cancel to discard the new copy.`);
        await api.resolveDuplicate(taskId, dup.document_id, keep);
      }
      const rejects = res.results.filter((r) => !r.ok);
      if (rejects.length) setNote(rejects.map((r) => `${r.filename}: ${r.message}`).join(' | '));
    } catch (ex) { setNote(ex.message); }
    await refresh(); setBusy(false);
  };
  const run = async () => {
    setBusy(true); setNote('Processing — statuses below update live; totals appear on P5 when done.');
    try {
      await api.runPipeline(taskId);
      await refresh();
    } catch (ex) { setNote(ex.message); }
    setBusy(false);
  };
  const demo = async () => {
    setBusy(true); setNote('Demo task created — the pipeline is running in the background; statuses update live below.');
    try {
      const s = await api.loadDemo();
      if (s.task_id && s.task_id !== taskId) { chooseTaskIfSet?.(s.task_id); }
      await refresh();
    } catch (ex) { setNote(ex.message); }
    setBusy(false);
  };
  const counts = {};
  for (const d of docs) counts[d.status] = (counts[d.status] ?? 0) + 1;
  const done = counts.completed ?? 0;
  const inFlight = ['parsing', 'extracting', 'matching'].reduce((a, k) => a + (counts[k] ?? 0), 0);
  return (
    <main className="page">
      <h2>Upload and process documents</h2>
      <Err error={err} onRetry={refresh} />
      <div className="card drop" onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files); }}
        tabIndex={0} role="button" aria-label="Drop files here or press Enter to choose files"
        onKeyDown={(e) => e.key === 'Enter' && document.getElementById('file-input').click()}>
        Drag and drop PDF, JPG, PNG, XLSX or CSV files here (max 10 MB each), or
        <label className="linklike"> browse…<input id="file-input" type="file" multiple hidden onChange={(e) => upload(e.target.files)} /></label>
      </div>
      <div className="row actions">
        <button onClick={run} disabled={busy || docs.filter((d) => d.status === 'queued').length === 0}>Process all documents</button>
        <button className="ghost" onClick={demo} disabled={busy}>Load demo dataset (one click)</button>
        {busy && <span className="progress-note" role="status">Working…</span>}
      </div>
      {note && <p className="note" role="status">{note}</p>}
      {docs.length > 0 && (
        <section className="card progress-card" aria-label="Processing progress">
          <div className="row progress-meta">
            <span><b>{docs.length}</b> documents</span>
            <span className="st st-completed"><span aria-hidden>✓</span> {done} completed</span>
            {inFlight > 0 && <span className="st st-matching" role="status"><span aria-hidden>⇄</span> {inFlight} in progress</span>}
            {(counts.needs_review ?? 0) > 0 && <span className="st st-needs_review"><span aria-hidden>!</span> {counts.needs_review} need review</span>}
            {(counts.failed ?? 0) > 0 && <span className="st st-failed"><span aria-hidden>✗</span> {counts.failed} failed</span>}
          </div>
          <div className="progress-track" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={docs.length}
            aria-label={`${done} of ${docs.length} documents completed`}>
            <div className="progress-fill" style={{ width: `${(done / docs.length) * 100}%` }} />
          </div>
        </section>
      )}
      <h3>Documents ({docs.length})</h3>
      {docs.length === 0 && <Empty title="No documents uploaded yet">Drop files above, or load the one-click demo dataset.</Empty>}
      {docs.length > 0 && (
        <table className="tbl"><thead><tr><th aria-hidden></th><th>File</th><th>Format</th><th>Pages</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>{docs.map((d) => (
            <React.Fragment key={d.id}>
              <tr className="rowlink" tabIndex={0}
                onClick={() => setExpanded(expanded === d.id ? null : d.id)}
                onKeyDown={(e) => e.key === 'Enter' && setExpanded(expanded === d.id ? null : d.id)}
                aria-expanded={expanded === d.id}>
                <td aria-hidden className="chevron">{expanded === d.id ? '▾' : '▸'}</td>
                <td>{d.original_filename}</td><td>{d.format}</td><td className="num">{d.page_count}</td>
                <td><Status status={d.status} /></td>
                <td className="rowactions">
                  <button className="linklike" onClick={(e) => { e.stopPropagation(); downloadFile(`/api/tasks/${taskId}/documents/${d.id}/file`, d.original_filename); }}>file</button>
                </td>
              </tr>
              {expanded === d.id && (
                <tr className="detail"><td colSpan={6}>
                  <UnitsPanel taskId={taskId} doc={d} />
                </td></tr>
              )}
            </React.Fragment>
          ))}</tbody></table>
      )}
    </main>
  );
}

/** Per-page classification of one document (document_units), lazily fetched. */
function UnitsPanel({ taskId, doc }) {
  const { data, err, reload } = useData(() => api.docUnits(taskId, doc.id), [taskId, doc.id]);
  if (err) return <Err error={err} onRetry={reload} />;
  if (!data) return <p className="hint" role="status">Loading page classification…</p>;
  if (data.units.length === 0) {
    return <p className="hint">No page units recorded for this document yet — they are created during ingestion and classified during processing.</p>;
  }
  return (
    <div>
      <h4>Page classification ({data.units.length} unit{data.units.length === 1 ? '' : 's'})</h4>
      <div className="tablewrap"><table className="tbl mini">
        <thead><tr><th>Page</th><th>Classified as</th><th>Confidence</th><th>Manual confirmation</th></tr></thead>
        <tbody>{data.units.map((u) => (
          <tr key={u.id}>
            <td className="num">{u.page_number}</td>
            <td>{u.doc_type ?? <span className="muted">— not classified yet</span>}</td>
            <td>{u.type_confidence != null ? `${(u.type_confidence * 100).toFixed(0)}%` : '—'}</td>
            <td>{u.needs_manual_confirmation ? <span className="st st-needs_review"><span aria-hidden>!</span> requested</span> : <span className="muted">no</span>}</td>
          </tr>
        ))}</tbody>
      </table></div>
      <p className="hint">Each PDF page is split into one unit; images, spreadsheets and CSV files form a single unit referencing the original file.</p>
    </div>
  );
}

// ---------------------------------------------------------------- P3
function AuditView({ taskId, recordId }) {
  const [audit, setAudit] = useState(null);
  const [open, setOpen] = useState(false);
  const load = async () => {
    setOpen(!open);
    if (!audit) {
      try { setAudit(await api.audit(taskId, recordId)); }
      catch (e) { setAudit({ error: e.message ?? String(e) }); }
    }
  };
  return (
    <div>
      <button className="linklike" onClick={load} aria-expanded={open}>{open ? 'Hide' : 'Show'} full audit calculation steps</button>
      {open && audit?.error && <p className="error" role="alert">Audit view failed to load: {audit.error}</p>}
      {open && audit && !audit.error && (
        <div className="tablewrap"><table className="tbl mini"><tbody>
          {(audit.calculation?.steps ?? []).map((s, i) => (
            <tr key={i}><td>{s.action}</td><td>{JSON.stringify(s).slice(0, 160)}</td></tr>
          ))}
          {(audit.audit_trail ?? []).map((a, i) => (
            <tr key={'a' + i}><td>{a.action_type}</td><td>{JSON.stringify(a.details).slice(0, 160)}</td></tr>
          ))}
        </tbody></table></div>
      )}
    </div>
  );
}

/** Selected-vs-runner-up factor decision for one record (stored match). */
function MatchPanel({ taskId, record }) {
  const { data, err, reload } = useData(() => api.candidates(taskId, record.record_id), [taskId, record.record_id]);
  if (err) return <Err error={err} onRetry={reload} />;
  if (!data) return <p className="hint" role="status">Loading factor selection…</p>;
  const m = data.match;
  if (!m) return <p className="hint">No stored factor selection for this record yet — run the pipeline first, or assign one on the matching viewer.</p>;
  return (
    <section className="compare-inline" aria-label="Factor selection">
      <h4>Factor selection — best vs runner-up</h4>
      <div className="compare-grid">
        <div className="compare-col best">
          <span className="badge badge-best">✓ Selected</span>
          <p className="factor-name">{m.selected?.name ?? m.selected_factor_id}</p>
          <p className="mono">{m.selected_factor_id}{m.selected?.value != null ? ` · ${m.selected.value} kgCO2e/${m.selected.activity_unit}` : ''}</p>
        </div>
        <div className="compare-col runner">
          <span className="badge badge-runner">Runner-up</span>
          {m.runner_up || m.runner_up_factor_id ? (
            <>
              <p className="factor-name">{m.runner_up?.name ?? m.runner_up_factor_id}</p>
              <p className="mono">{m.runner_up_factor_id}{m.runner_up?.value != null ? ` · ${m.runner_up.value} kgCO2e/${m.runner_up.activity_unit}` : ''}</p>
            </>
          ) : <p className="muted">No runner-up retained for this selection.</p>}
        </div>
      </div>
      <p className="match-meta">Match confidence: <b>{Math.round((m.confidence ?? 0) * 100)}%</b></p>
      {m.rationale && <blockquote className="rationale">{m.rationale}</blockquote>}
      <a className="button ghost" href={`#/match?record=${record.record_id}`}>Open matching viewer</a>
    </section>
  );
}

export function P3Records({ taskId, params }) {
  const { data, err, reload } = useData(() => api.dashboard(taskId), [taskId]);
  const wanted = params.get('record');
  const [expanded, setExpanded] = useState(wanted);
  useEffect(() => { if (wanted) setExpanded(wanted); }, [wanted]);
  const recs = data?.records ?? [];
  // The "Factor" column must show the factor actually selected for a record
  // (the dashboard's calc rows carry it), not the internal match id (D-53).
  const factorByRecord = new Map((data?.calcs ?? []).map((c) => [c.activity_record_id, c.factor_id]));
  return (
    <main className="page">
      <h2>Activity records</h2>
      <Err error={err} onRetry={reload} />
      {data && recs.length === 0 && <Empty title="No activity records yet">Run the pipeline on P2 — extracted rows will appear here.</Empty>}
      <table className="tbl">
        <thead><tr><th>Record</th><th>Description</th><th>Quantity</th><th>Scope</th><th>Factor</th><th>Uncertainty</th></tr></thead>
        <tbody>{recs.map((r) => (
          <React.Fragment key={r.record_id}>
            <tr className={`rowlink${expanded === r.record_id ? ' selected' : ''}`} tabIndex={0} onClick={() => setExpanded(expanded === r.record_id ? null : r.record_id)}
              onKeyDown={(e) => e.key === 'Enter' && setExpanded(expanded === r.record_id ? null : r.record_id)}>
              <td className="mono">{r.record_id}</td><td>{r.item_description}</td>
              <td className="num">{r.quantity != null ? `${r.quantity} ${r.unit ?? ''}` : '—'}</td>
              <td>{r.scope}{r.category ? ` ${r.category}` : ''}</td>
              <td className="mono">{factorByRecord.get(r.record_id) ?? '—'}</td>
              <td><Level level={r.uncertainty_level} /></td>
            </tr>
            {expanded === r.record_id && (
              <tr className="detail"><td colSpan={6}>
                <h4>Fields &amp; per-field confidence</h4>
                <table className="tbl mini"><tbody>
                  {Object.entries(r).filter(([k]) => !['field_confidence', 'id'].includes(k)).map(([k, v]) => (
                    <tr key={k}><td>{k}</td><td>{v === null ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v ?? '—')}</td>
                      <td>{r.field_confidence?.[k] != null ? r.field_confidence[k].toFixed(2) : ''}</td></tr>
                  ))}
                </tbody></table>
                <p><b>Unit self-check:</b> {r.unit_self_check ? `${r.unit_self_check.passed ? 'PASS' : 'FAIL'} — ${r.unit_self_check.detail}` : '—'}</p>
                <p><b>Boundary rationale:</b> {r.boundary_rationale ?? '—'}</p>
                <MatchPanel taskId={taskId} record={r} />
                <AuditView taskId={taskId} recordId={r.record_id} />
                <a className="button" href={`#/match?record=${r.record_id}`}>Open matching viewer</a>{' '}
                {(r.source_ref ?? '').split('#')[0] && (
                  <button className="linklike" onClick={() => downloadFile(`/api/tasks/${taskId}/documents/${(r.source_ref ?? '').split('#')[0]}/file`, 'source_document')}>View source document</button>
                )}
              </td></tr>
            )}
          </React.Fragment>
        ))}</tbody>
      </table>
      {data && (
        <section className="card">
          <h3>Totals</h3>
          <p>Total: <b>{t3(data.total_kgco2e)} t CO2e</b></p>
          <table className="tbl mini"><thead><tr><th>Scope</th><th>t CO2e</th></tr></thead>
            <tbody>{data.agg?.scope.map((s) => <tr key={s.key}><td>{s.key}</td><td className="num">{t3(s.value)}</td></tr>)}</tbody></table>
        </section>
      )}
    </main>
  );
}
