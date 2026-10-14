// Report-side pages: P7 report reader with a chapter TOC and clickable
// citation anchors (PRD 9.1: clickable citation jumps), P8 review queue, P9 AI traces.
import React, { useMemo, useState } from 'react';
import api from '../api.js';
import { useData, Empty, Err, Level, downloadFile } from './shared.jsx';

// ---------------------------------------------------------------- P7
/** Turns a ref_type:ref_id citation into a jump target inside the SPA. */
function CiteRef({ n }) {
  const label = `${n.ref_type}:${n.ref_id}${n.locator ? ` (${n.locator})` : ''}`;
  let href = null;
  if (n.ref_type === 'record') href = `#/records?record=${encodeURIComponent(n.ref_id)}`;
  else if (n.ref_type === 'factor') href = `#/library?factor=${encodeURIComponent(n.ref_id)}`;
  else if (n.ref_type === 'scenario') href = '#/scenarios';
  else if (n.ref_type === 'aggregation' || n.ref_type === 'calculation-set') href = '#/dashboard';
  if (!href) return <span className="mono">{label}</span>;
  return <a className="cite-ref" href={href} title={`Jump to ${n.ref_type}`}>{label}</a>;
}

/** Scrolls a numeric conclusion's row in the citation index into view. */
function jumpToCite(i) {
  document.getElementById(`cite-${i}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

function CiteMark({ idx, title }) {
  if (idx == null) return null;
  return <button className="cite-link" title={`Citation: ${title}`} aria-label={`Show citation for ${title}`}
    onClick={() => jumpToCite(idx)}>⧉</button>;
}

function Blocks({ blocks, renderExtra }) {
  return blocks.map((b, i) => {
    if (b.type === 'text') return <p key={i}>{b.text}{renderExtra?.(b, i)}</p>;
    if (b.type === 'list') return <ol key={i}>{b.items.map((x, j) => <li key={j}>{x}</li>)}</ol>;
    if (b.type === 'kv') return <dl key={i}>{b.rows.map(([k, v]) => <React.Fragment key={k}><dt>{k}</dt><dd>{String(v)}</dd></React.Fragment>)}</dl>;
    return (
      <div key={i} className="tablewrap"><table className="tbl mini">
        <thead><tr>{b.header.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{b.rows.map((r, j) => <tr key={j}>{r.map((cell, k) => <td key={k}>{String(cell ?? '')}</td>)}</tr>)}</tbody>
      </table></div>
    );
  });
}

export function P7Report({ taskId }) {
  const { data, err, loading, reload } = useData(() => api.report(taskId), [taskId]);
  if (err && !data) return <main className="page"><h2>Report</h2><Err error={err} onRetry={reload} /></main>;
  if (!data) {
    return <main className="page"><h2>Report</h2>{loading
      ? <p className="hint" role="status">Loading report…</p>
      : <Empty title="Generate the report by running the pipeline on P2.">The ten-chapter report, citations and exports appear here.</Empty>}</main>;
  }
  const { report: rep, citations } = data;
  // Anchor index: context string -> row number in the chapter 9 citation
  // table, so headline numbers elsewhere can link straight to their citation.
  const anchorIdx = new Map((rep.numeric_conclusions ?? []).map((n, i) => [n.context, i]));
  const citeFor = (context) => (anchorIdx.has(context) ? <CiteMark idx={anchorIdx.get(context)} title={context} /> : null);
  const chapterBlocks = (c) => {
    if (c.no === 2) {
      // Executive summary: the total sentence and the scope rows are exactly
      // the contexts anchor() used, so each gets its citation jump.
      return c.blocks.map((b, i) => {
        if (b.type === 'text') return <p key={i}>{b.text}{citeFor('Total emissions')}</p>;
        if (b.type === 'table' && b.header[0] === 'Scope') {
          return (
            <div key={i} className="tablewrap"><table className="tbl mini">
              <thead><tr>{b.header.map((h) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>{b.rows.map((r, j) => (
                <tr key={j}>{r.map((cell, k) => <td key={k}>{String(cell ?? '')}</td>)}
                  <td className="cite-cell">{citeFor(`Scope breakdown: ${r[0]}`)}</td></tr>
              ))}</tbody>
            </table></div>
          );
        }
        return <Blocks key={i} blocks={[b]} />;
      });
    }
    if (c.no === 9) {
      // Citation index: every row carries an id (the jump target) and its
      // reference renders as a link into the object it points at.
      const rows = rep.numeric_conclusions ?? [];
      return (
        <div className="tablewrap"><table className="tbl mini cite-table">
          <thead><tr><th>Data point</th><th>t CO2e</th><th>Reference</th></tr></thead>
          <tbody>{rows.map((n, i) => (
            <tr key={i} id={`cite-${i}`}>
              <td>{n.context}</td><td className="num">{n.value_t}</td><td><CiteRef n={n} /></td>
            </tr>
          ))}</tbody>
        </table></div>
      );
    }
    return <Blocks blocks={c.blocks} />;
  };
  return (
    <main className="page page-report">
      <div className="report-head">
        <h2>Emissions report — {rep.meta.entity}</h2>
        <p className="hint">Citation coverage {citations.coverage_pct.toFixed(0)}% · invalid anchors {citations.invalid_count} · narrative adapter: {rep.narrative_adapter}</p>
        <div className="row actions">
          <button className="button" onClick={() => downloadFile(`/api/tasks/${taskId}/report/export?fmt=pdf`, 'carbonledger_report.pdf')}>Export PDF</button>
          <button className="button ghost" onClick={() => downloadFile(`/api/tasks/${taskId}/report/export?fmt=csv-detail`, 'activity_detail.csv')}>Export activity CSV</button>
          <button className="button ghost" onClick={() => downloadFile(`/api/tasks/${taskId}/report/export?fmt=csv-category`, 'category_summary.csv')}>Export category CSV</button>
        </div>
      </div>
      <div className="report-layout">
        <nav className="toc card" aria-label="Report chapters">
          <h3>Chapters</h3>
          <ol>{rep.chapters.map((c) => (
            <li key={c.no}><button className="linklike" onClick={() => document.getElementById(`ch-${c.no}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' })}>
              {c.no}. {c.title}</button></li>
          ))}</ol>
        </nav>
        <div className="report-body">
          {rep.chapters.map((c) => (
            <section key={c.no} id={`ch-${c.no}`} className="card chapter">
              <h3>{c.no}. {c.title}</h3>
              {chapterBlocks(c)}
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------- P8
export function P8Review({ taskId }) {
  const { data, err, reload } = useData(() => api.review(taskId), [taskId]);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const act = async (recordId, body, label) => {
    setBusy(true);
    try {
      await api.reviewAction(taskId, recordId, body);
      setMsg(`${label} applied; aggregates recalculated.`);
      await reload();
    } catch (ex) { setMsg(ex.message); }
    setBusy(false);
  };
  const items = data?.items ?? [];
  return (
    <main className="page">
      <h2>Review queue</h2>
      <p className="hint">Sorted by uncertainty (highest first). Editing a field recalculates the affected totals immediately.</p>
      <Err error={err} onRetry={reload} />
      {msg && <p className="note" role="status">{msg}</p>}
      {items.length === 0 && <Empty title="Queue is empty">Records land here when classification confidence is low or a unit self-check fails.</Empty>}
      {items.map((it) => it.record && (
        <ReviewCard key={it.id} item={it} act={act} busy={busy} />
      ))}
    </main>
  );
}
function ReviewCard({ item, act, busy }) {
  const r = item.record;
  const [patch, setPatch] = useState({});
  const [reason, setReason] = useState('');
  const fields = ['quantity', 'unit', 'transport_mode', 'origin_location', 'destination_location', 'activity_date', 'amount', 'currency'];
  return (
    <section className="card review-card">
      <h3><Level level={item.uncertainty_level} /> — <span className="mono">{r.record_id}</span></h3>
      <p>{r.item_description} · reason: {item.reason}</p>
      <div className="field-grid">
        {fields.map((f) => (
          <label key={f}>{f}<input value={patch[f] ?? r[f] ?? ''} onChange={(e) => setPatch({ ...patch, [f]: e.target.value })} /></label>
        ))}
      </div>
      <div className="row actions">
        <button disabled={busy} onClick={() => act(r.record_id, { action: 'edit', patch }, 'Field edit')}>Save &amp; recalculate</button>
        <button className="ghost" disabled={busy} onClick={() => { if (window.confirm('Exclude this record from accounting?')) act(r.record_id, { action: 'exclude', reason: reason || 'not applicable to the reporting boundary' }, 'Exclusion'); }}>Exclude from accounting</button>
        <input placeholder="Exclusion reason (English)" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Exclusion reason" />
        <button className="ghost" disabled={busy} onClick={() => act(r.record_id, { action: 'close', note: 'reviewed' }, 'Close')}>Close item</button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- P9
export function P9Traces({ taskId }) {
  const [stage, setStage] = useState('');
  const { data, err, reload } = useData(() => api.traces(taskId, stage), [taskId, stage]);
  const [expanded, setExpanded] = useState(null);
  const traces = data?.traces ?? [];
  const totals = useMemo(() => {
    const cost = traces.reduce((a, t) => a + (t.usage?.est_cost_usd ?? 0), 0);
    const latency = traces.length ? Math.round(traces.reduce((a, t) => a + (t.latency_ms ?? 0), 0) / traces.length) : 0;
    const failed = traces.filter((t) => !t.ok).length;
    return { cost, latency, failed };
  }, [traces]);
  return (
    <main className="page">
      <h2>AI call traces</h2>
      <div className="row" role="tablist" aria-label="Stage filter">
        <button className={`chip${!stage ? ' active' : ''}`} role="tab" aria-selected={!stage} onClick={() => setStage('')}>All</button>
        {['classification', 'extraction', 'boundary', 'factor_selection', 'report_narrative', 'embedding'].map((s) => (
          <button key={s} className={`chip${stage === s ? ' active' : ''}`} role="tab" aria-selected={stage === s} onClick={() => setStage(s)}>{s}</button>
        ))}
      </div>
      <Err error={err} onRetry={reload} />
      {traces.length === 0 && !err && <Empty title="No traces recorded yet">Every generative and embedding call the pipeline makes is recorded here.</Empty>}
      {traces.length > 0 && (
        <p className="hint" role="status">
          {data.count ?? traces.length} trace records · total cost ≈ ${totals.cost.toFixed(5)} · avg latency {totals.latency} ms · {totals.failed} failed
        </p>
      )}
      {traces.length > 0 && (
        <table className="tbl"><thead><tr><th>Stage</th><th>Model</th><th>Latency ms</th><th>Usage (in/out)</th><th>Cost USD</th><th>OK</th><th>Output summary</th></tr></thead>
          <tbody>{traces.map((t) => (
            <React.Fragment key={t.id}>
              <tr className="rowlink" tabIndex={0} onClick={() => setExpanded(expanded === t.id ? null : t.id)}
                onKeyDown={(e) => e.key === 'Enter' && setExpanded(expanded === t.id ? null : t.id)}
                aria-expanded={expanded === t.id}>
                <td>{t.stage}</td><td className="mono">{t.model}</td><td className="num">{t.latency_ms}</td>
                <td className="num">{t.usage?.input_tokens}/{t.usage?.output_tokens}</td>
                <td className="num">{t.usage?.est_cost_usd?.toFixed(6)}</td>
                <td><span className={t.ok ? 'st st-completed' : 'st st-failed'}><span aria-hidden>{t.ok ? '✓' : '✗'}</span></span></td>
                <td title={t.input_summary}>{String(t.output_summary).slice(0, 80)}</td>
              </tr>
              {expanded === t.id && (
                <tr className="detail"><td colSpan={7}>
                  <h4>Trace detail — {t.id}</h4>
                  <table className="tbl mini"><tbody>
                    <tr><td>Stage</td><td>{t.stage}</td></tr>
                    <tr><td>Model</td><td className="mono">{t.model}</td></tr>
                    <tr><td>Adapter</td><td>{t.adapter ?? '—'}</td></tr>
                    <tr><td>Latency</td><td>{t.latency_ms} ms</td></tr>
                    <tr><td>Usage</td><td>{JSON.stringify(t.usage ?? {})}</td></tr>
                    <tr><td>Input summary</td><td>{t.input_summary}</td></tr>
                    <tr><td>Output summary</td><td>{String(t.output_summary)}</td></tr>
                  </tbody></table>
                </td></tr>
              )}
            </React.Fragment>
          ))}</tbody></table>
      )}
    </main>
  );
}
