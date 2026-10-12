// The nine pages of PRD 9.1 (P1..P9). Compact functional components sharing
// a light professional theme; keyboard-operable controls; uncertainty levels
// carry outline icons in addition to color (NFR-404).
import React, { useEffect, useState, useMemo } from 'react';
import api from './api.js';

export const LEVEL_ICON = { high: '▲', medium: '■', low: '●' };
const LEVEL_LABEL = { high: 'High uncertainty', medium: 'Medium uncertainty', low: 'Low uncertainty' };
const t3 = (kg) => (Math.round((kg / 1000) * 1000) / 1000).toLocaleString('en-US');

export function Nav({ taskId, route }) {
  const items = taskId
    ? [['upload', 'P2 Upload'], ['records', 'P3 Records'], ['match', 'P4 Matching'],
       ['dashboard', 'P5 Dashboard'], ['scenarios', 'P6 Scenarios'], ['report', 'P7 Report'],
       ['review', 'P8 Review'], ['traces', 'P9 Traces']]
    : [];
  return (
    <nav className="nav" aria-label="Primary">
      <a href="#/" className="brand">CarbonLedger</a>
      {items.map(([r, label]) => (
        <a key={r} href={`#/${r}`} className={route === r ? 'active' : ''}>{label}</a>
      ))}
    </nav>
  );
}

// ---------------------------------------------------------------- P1
export function P1Home({ onTask }) {
  const [form, setForm] = useState({ entity_name: '', period_from: '2026-01-01', period_to: '2026-06-30', gwp_version: 'AR6' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
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
    <main className="page">
      <section className="hero">
        <h1>CarbonLedger</h1>
        <p className="value-prop">CarbonLedger compresses the cost of producing a Scope 3 report
          from "RMB 30,000 + 3 weeks" to "1 hour + near-zero marginal cost", while making every
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
          {['AR5', 'AR6'].map((v) => (
            <label key={v} className="radio"><input type="radio" name="gwp" checked={form.gwp_version === v} onChange={() => setForm({ ...form, gwp_version: v })} />{v}</label>
          ))}
        </fieldset>
        {err && <p className="error" role="alert">{err}</p>}
        <button type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create task and continue'}</button>
      </form>
    </main>
  );
}

// ---------------------------------------------------------------- P2
const STATUS_ICON = { queued: '…', parsing: '⧉', extracting: '✎', matching: '⇄', completed: '✓', needs_review: '!', failed: '✗', pending_duplicate: '?' };
export function P2Upload({ taskId, onProgress }) {
  const [docs, setDocs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const refresh = async () => setDocs((await api.getTask(taskId)).documents);
  useEffect(() => { refresh(); const t = setInterval(refresh, 2500); return () => clearInterval(t); }, [taskId]);
  const upload = async (files) => {
    setBusy(true); setNote(null);
    const res = await api.uploadFiles(taskId, [...files]);
    const dup = res.results.find((r) => r.status === 'pending_duplicate');
    if (dup) {
      const keep = window.confirm(`"${dup.filename}" has the same content as an existing document. Click OK to keep both copies, Cancel to discard the new copy.`);
      await api.resolveDuplicate(taskId, dup.document_id, keep);
    }
    const rejects = res.results.filter((r) => !r.ok);
    if (rejects.length) setNote(rejects.map((r) => `${r.filename}: ${r.message}`).join(' | '));
    await refresh(); setBusy(false);
  };
  const run = async () => {
    setBusy(true); setNote('Processing — the pipeline is running…');
    try {
      const summary = await api.runPipeline(taskId);
      setNote(`Done: ${summary.records} records, ${summary.calculated} calculated, total ${t3(summary.total_kgco2e)} t CO2e.`);
      onProgress();
    } catch (ex) { setNote(ex.message); }
    setBusy(false);
  };
  const demo = async () => {
    setBusy(true); setNote('Loading demo dataset and running the full pipeline…');
    try { const s = await api.loadDemo(); setNote(`Demo task ${s.task_id}: ${s.records} records, total ${t3(s.total_kgco2e)} t CO2e.`); }
    catch (ex) { setNote(ex.message); }
    setBusy(false);
  };
  return (
    <main className="page">
      <h2>Upload and process documents</h2>
      <div className="card drop" onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files); }}
        tabIndex={0} role="button" aria-label="Drop files here or press Enter to choose files"
        onKeyDown={(e) => e.key === 'Enter' && document.getElementById('file-input').click()}>
        Drag and drop PDF, JPG, PNG, XLSX or CSV files here (max 10 MB each), or
        <label className="linklike"> browse…<input id="file-input" type="file" multiple hidden onChange={(e) => upload(e.target.files)} /></label>
      </div>
      <div className="row actions">
        <button onClick={run} disabled={busy || docs.filter((d) => d.status === 'queued').length === 0}>Process all documents</button>
        <button onClick={demo} disabled={busy}>Load demo dataset (one click)</button>
        {busy && <span className="progress-note" role="status">Working…</span>}
      </div>
      {note && <p className="note" role="status">{note}</p>}
      <h3>Documents ({docs.length})</h3>
      <table className="tbl"><thead><tr><th>File</th><th>Format</th><th>Pages</th><th>Status</th></tr></thead>
        <tbody>{docs.map((d) => (
          <tr key={d.id}><td>{d.original_filename}</td><td>{d.format}</td><td>{d.page_count}</td>
            <td><span className={`st st-${d.status}`}><span aria-hidden>{STATUS_ICON[d.status] ?? '?'}</span> {d.status}</span></td></tr>
        ))}</tbody></table>
    </main>
  );
}

// ---------------------------------------------------------------- P3 + P4
async function loadRecords(taskId) {
  const [taskRes, dash] = await Promise.all([api.getTask(taskId), api.dashboard(taskId)]);
  return { records: dash.records ?? [], raw: taskRes, dash };
}

export function P3Records({ taskId }) {
  const [data, setData] = useState(null);
  const [expanded, setExpanded] = useState(null);
  useEffect(() => { api.dashboard(taskId).then((d) => setData(d)).catch(() => setData(null)); }, [taskId]);
  const records = data?.records ?? [];
  // dashboard returns aggregates; records themselves come from the task view
  const [recs, setRecs] = useState([]);
  useEffect(() => { api.getTask(taskId).then((t) => setRecs(t.records ?? [])).catch(() => {}); }, [taskId, data]);
  return (
    <main className="page">
      <h2>Activity records</h2>
      <table className="tbl">
        <thead><tr><th>Record</th><th>Description</th><th>Quantity</th><th>Scope</th><th>Factor</th><th>Uncertainty</th></tr></thead>
        <tbody>{recs.map((r) => (
          <React.Fragment key={r.record_id}>
            <tr className="rowlink" tabIndex={0} onClick={() => setExpanded(expanded === r.record_id ? null : r.record_id)}
              onKeyDown={(e) => e.key === 'Enter' && setExpanded(expanded === r.record_id ? null : r.record_id)}>
              <td>{r.record_id}</td><td>{r.item_description}</td>
              <td>{r.quantity != null ? `${r.quantity} ${r.unit ?? ''}` : '—'}</td>
              <td>{r.scope}{r.category ? ` ${r.category}` : ''}</td>
              <td>{r.match_id ? r.match_id.replace('match_', '') : '—'}</td>
              <td><span className={`lvl lvl-${r.uncertainty_level}`}><span aria-hidden>{LEVEL_ICON[r.uncertainty_level]}</span> {LEVEL_LABEL[r.uncertainty_level]}</span></td>
            </tr>
            {expanded === r.record_id && (
              <tr className="detail"><td colSpan={6}>
                <h4>Fields &amp; per-field confidence</h4>
                <table className="tbl mini"><tbody>
                  {Object.entries(r).filter(([k]) => !['field_confidence', 'id'].includes(k)).map(([k, v]) => (
                    <tr key={k}><td>{k}</td><td>{typeof v === 'object' ? JSON.stringify(v) : String(v ?? '—')}</td>
                      <td>{r.field_confidence?.[k] != null ? r.field_confidence[k].toFixed(2) : ''}</td></tr>
                  ))}
                </tbody></table>
                <p><b>Unit self-check:</b> {r.unit_self_check ? `${r.unit_self_check.passed ? 'PASS' : 'FAIL'} — ${r.unit_self_check.detail}` : '—'}</p>
                <p><b>Boundary rationale:</b> {r.boundary_rationale ?? '—'}</p>
                <a className="button" href={`#/match?record=${r.record_id}`}>Open matching viewer</a>{' '}
                <a className="button" href={`/api/tasks/${taskId}/documents/${(r.source_ref ?? '').split('#')[0]}/file`} target="_blank" rel="noreferrer">View source document</a>
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
            <tbody>{data.agg?.scope.map((s) => <tr key={s.key}><td>{s.key}</td><td>{t3(s.value)}</td></tr>)}</tbody></table>
        </section>
      )}
    </main>
  );
}

export function P4Matching({ taskId, params }) {
  const recordId = params.get('record');
  const [dash, setDash] = useState(null);
  const [task, setTask] = useState(null);
  const [msg, setMsg] = useState(null);
  const [factors, setFactors] = useState([]);
  useEffect(() => { api.dashboard(taskId).then(setDash); api.getTask(taskId).then(setTask); api.factors('').catch(() => {}); }, [taskId]);
  const rec = task?.records?.find((r) => r.record_id === recordId);
  useEffect(() => { if (rec) api.factorSearch(rec.item_description).then((r) => setFactors(r.factors.slice(0, 15))); }, [rec?.record_id]);
  if (!rec) return <main className="page"><h2>Factor matching viewer</h2><p>Select a record on P3.</p></main>;
  const assign = async (fid) => {
    await api.reviewAction(taskId, recordId, { action: 'assign', factor_id: fid });
    setMsg('Factor manually assigned; results recalculated.');
    api.getTask(taskId).then(setTask);
  };
  return (
    <main className="page">
      <h2>Factor matching — {rec.record_id}</h2>
      <p>{rec.item_description} · {rec.quantity} {rec.unit}</p>
      {msg && <p className="note" role="status">{msg}</p>}
      <h3>Candidates (recall channel output)</h3>
      <table className="tbl"><thead><tr><th>Factor</th><th>Unit</th><th>Value</th><th>Action</th></tr></thead>
        <tbody>{factors.map((f) => (
          <tr key={f.factor_id}><td title={f.name}>{f.factor_id}</td><td>{f.activity_unit}</td>
            <td>{f.value}</td><td><button onClick={() => assign(f.factor_id)}>Assign manually</button></td></tr>
        ))}</tbody></table>
    </main>
  );
}

// ---------------------------------------------------------------- P5
function Bars({ rows, unitLabel }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <table className="bars"><tbody>
      {rows.map((r) => (
        <tr key={r.key}><th scope="row">{r.key}</th>
          <td><div className="bar" style={{ width: `${(r.value / max) * 100}%` }} /><span>{unitLabel === 't' ? t3(r.value) : r.value}</span></td></tr>
      ))}
    </tbody></table>
  );
}
export function P5Dashboard({ taskId }) {
  const [dash, setDash] = useState(null);
  const [dim, setDim] = useState('scope');
  useEffect(() => { api.dashboard(taskId).then(setDash).catch(() => {}); }, [taskId]);
  if (!dash) return <main className="page"><h2>Dashboard</h2><p>No data yet — run the pipeline on P2.</p></main>;
  const dims = { scope: dash.agg?.scope ?? [], category: dash.agg?.category ?? [], supplier: dash.agg?.supplier ?? [], month: dash.agg?.month ?? [] };
  return (
    <main className="page">
      <h2>Emissions dashboard</h2>
      <p>Total: <b>{t3(dash.total_kgco2e)} t CO2e</b></p>
      <div className="row" role="tablist" aria-label="Dimension">
        {Object.keys(dims).map((d) => <button key={d} className={dim === d ? 'active' : ''} onClick={() => setDim(d)}>{d}</button>)}
      </div>
      <Bars rows={dims[dim]} unitLabel="t" />
      <h3>Top emission sources</h3>
      <table className="tbl"><thead><tr><th>Record</th><th>Description</th><th>t CO2e</th></tr></thead>
        <tbody>{dash.top?.map((x) => <tr key={x.record_id}><td>{x.record_id}</td><td>{x.description}</td><td>{t3(x.emission_kgco2e)}</td></tr>)}</tbody></table>
      <h3>Uncertainty distribution</h3>
      <Bars rows={Object.entries(dash.distribution ?? {}).map(([key, value]) => ({ key, value }))} />
    </main>
  );
}

// ---------------------------------------------------------------- P6
export function P6Scenarios({ taskId }) {
  const [rep, setRep] = useState(null);
  const [ratio, setRatio] = useState(1.0);
  useEffect(() => { api.report(taskId).then((r) => setRep(r.report)).catch(() => {}); }, [taskId]);
  const chapter = rep?.chapters.find((c) => c.no === 7);
  if (!chapter) return <main className="page"><h2>Scenarios</h2><p>Run the pipeline first.</p></main>;
  return (
    <main className="page">
      <h2>Reduction scenarios</h2>
      <label>Replacement ratio: <output>{Math.round(ratio * 100)}%</output>
        <input type="range" min="0" max="100" value={ratio * 100}
          onChange={(e) => setRatio(Number(e.target.value) / 100)}
          onBlur={async () => { await api.runPipeline(taskId); api.report(taskId).then((r) => setRep(r.report)); }}
          aria-label="Replacement ratio percent" /></label>
      <p className="hint">Adjust the slider and release to recompute at the selected ratio.</p>
      {chapter.blocks.map((b, i) => b.type === 'table'
        ? <table key={i} className="tbl mini"><thead><tr>{b.header.map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>{b.rows.map((r, j) => <tr key={j}>{r.map((c, k) => <td key={k}>{String(c)}</td>)}</tr>)}</tbody></table>
        : <p key={i} className="feasible">{b.text}</p>)}
    </main>
  );
}

// ---------------------------------------------------------------- P7
export function P7Report({ taskId }) {
  const [data, setData] = useState(null);
  useEffect(() => { api.report(taskId).then(setData).catch(() => {}); }, [taskId]);
  if (!data) return <main className="page"><h2>Report</h2><p>Generate the report by running the pipeline on P2.</p></main>;
  const { report: rep, citations } = data;
  return (
    <main className="page">
      <h2>Emissions report — {rep.meta.entity}</h2>
      <p className="hint">Citation coverage {citations.coverage_pct.toFixed(0)}% · invalid anchors {citations.invalid_count} · narrative adapter: {rep.narrative_adapter}</p>
      <div className="row actions">
        <a className="button" href={`/api/tasks/${taskId}/report/export?fmt=pdf`}>Export PDF</a>
        <a className="button" href={`/api/tasks/${taskId}/report/export?fmt=csv-detail`}>Export activity CSV</a>
        <a className="button" href={`/api/tasks/${taskId}/report/export?fmt=csv-category`}>Export category CSV</a>
      </div>
      {rep.chapters.map((c) => (
        <section key={c.no} className="card chapter">
          <h3>{c.no}. {c.title}</h3>
          {c.blocks.map((b, i) => {
            if (b.type === 'text') return <p key={i}>{b.text}</p>;
            if (b.type === 'list') return <ol key={i}>{b.items.map((x, j) => <li key={j}>{x}</li>)}</ol>;
            if (b.type === 'kv') return <dl key={i}>{b.rows.map(([k, v]) => <React.Fragment key={k}><dt>{k}</dt><dd>{String(v)}</dd></React.Fragment>)}</dl>;
            return (
              <div key={i} className="tablewrap"><table className="tbl mini">
                <thead><tr>{b.header.map((h) => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>{b.rows.map((r, j) => <tr key={j}>{r.map((cell, k) => <td key={k}>{String(cell ?? '')}</td>)}</tr>)}</tbody>
              </table></div>
            );
          })}
        </section>
      ))}
    </main>
  );
}

// ---------------------------------------------------------------- P8
export function P8Review({ taskId }) {
  const [items, setItems] = useState([]);
  const [msg, setMsg] = useState(null);
  const refresh = () => api.review(taskId).then((r) => setItems(r.items)).catch(() => setItems([]));
  useEffect(() => { refresh(); }, [taskId]);
  const act = async (recordId, body, label) => {
    await api.reviewAction(taskId, recordId, body);
    setMsg(`${label} applied; aggregates recalculated.`);
    refresh();
  };
  return (
    <main className="page">
      <h2>Review queue</h2>
      <p className="hint">Sorted by uncertainty (highest first). Editing a field recalculates the affected totals immediately.</p>
      {msg && <p className="note" role="status">{msg}</p>}
      {items.length === 0 && <p>Queue is empty.</p>}
      {items.map((it) => it.record && (
        <ReviewCard key={it.id} item={it} act={act} />
      ))}
    </main>
  );
}
function ReviewCard({ item, act }) {
  const r = item.record;
  const [patch, setPatch] = useState({});
  const [reason, setReason] = useState('');
  const fields = ['quantity', 'unit', 'transport_mode', 'origin_location', 'destination_location', 'activity_date', 'amount', 'currency'];
  return (
    <section className="card review-card">
      <h3><span className={`lvl lvl-${item.uncertainty_level}`}><span aria-hidden>{LEVEL_ICON[item.uncertainty_level]}</span> {LEVEL_LABEL[item.uncertainty_level]}</span> — {r.record_id}</h3>
      <p>{r.item_description} · reason: {item.reason}</p>
      <div className="row">
        {fields.map((f) => (
          <label key={f}>{f}<input value={patch[f] ?? r[f] ?? ''} onChange={(e) => setPatch({ ...patch, [f]: e.target.value })} /></label>
        ))}
        <button onClick={() => act(r.record_id, { action: 'edit', patch }, 'Field edit')}>Save &amp; recalculate</button>
      </div>
      <div className="row">
        <button onClick={() => { if (window.confirm('Exclude this record from accounting?')) act(r.record_id, { action: 'exclude', reason: reason || 'not applicable to the reporting boundary' }, 'Exclusion'); }}>Exclude from accounting</button>
        <input placeholder="Exclusion reason (English)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <button onClick={() => act(r.record_id, { action: 'close', note: 'reviewed' }, 'Close')}>Close item</button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- P9
export function P9Traces({ taskId }) {
  const [stage, setStage] = useState('');
  const [data, setData] = useState({ traces: [] });
  useEffect(() => { api.traces(taskId, stage).then(setData).catch(() => setData({ traces: [] })); }, [taskId, stage]);
  const stages = useMemo(() => [...new Set(data.traces.map((t) => t.stage))], [data]);
  return (
    <main className="page">
      <h2>AI call traces</h2>
      <div className="row" role="tablist" aria-label="Stage filter">
        <button className={!stage ? 'active' : ''} onClick={() => setStage('')}>All</button>
        {['classification', 'extraction', 'boundary', 'factor_selection', 'report_narrative', 'embedding'].map((s) => (
          <button key={s} className={stage === s ? 'active' : ''} onClick={() => setStage(s)}>{s}</button>
        ))}
      </div>
      <p className="hint">{data.count ?? data.traces.length} trace records</p>
      <table className="tbl"><thead><tr><th>Stage</th><th>Model</th><th>Latency ms</th><th>Usage (in/out)</th><th>Cost USD</th><th>OK</th><th>Output summary</th></tr></thead>
        <tbody>{data.traces.map((t) => (
          <tr key={t.id}><td>{t.stage}</td><td>{t.model}</td><td>{t.latency_ms}</td>
            <td>{t.usage?.input_tokens}/{t.usage?.output_tokens}</td>
            <td>{t.usage?.est_cost_usd?.toFixed(6)}</td>
            <td>{t.ok ? '✓' : '✗'}</td><td title={t.input_summary}>{String(t.output_summary).slice(0, 80)}</td></tr>
        ))}</tbody></table>
    </main>
  );
}
