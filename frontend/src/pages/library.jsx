// Global pages reachable without a task: the factor library browser (all 741
// public factors, searchable and filterable) and the task history view.
import React, { useEffect, useState } from 'react';
import api from '../api.js';
import { useData, Empty, Err } from './shared.jsx';

const PAGE_SIZE = 25;

export function FactorsLibrary({ params }) {
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [gwp, setGwp] = useState('');
  const [year, setYear] = useState('');
  // The query actually APPLIED: keyword search runs on submit (not per
  // keystroke), filters apply immediately, and Reset re-runs the browse —
  // so the load effect keys on this snapshot, never on the live inputs.
  const [applied, setApplied] = useState({ q: '', type: '', gwp: '', year: '' });
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const wantFactor = params.get('factor');

  // A ?factor= deep link (e.g. from a report citation) opens that factor's
  // detail card above the table regardless of the current filter.
  const [focus, setFocus] = useState(null);
  useEffect(() => {
    if (!wantFactor) { setFocus(null); return; }
    api.factorDetail(wantFactor).then(setFocus).catch(() => setFocus(null));
  }, [wantFactor]);

  const load = async () => {
    setBusy(true); setErr(null);
    try {
      setData(await api.factorBrowse({ ...applied, limit: PAGE_SIZE, offset: page * PAGE_SIZE }));
    } catch (e) { setErr(e); }
    setBusy(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [applied, page]);
  const applyFilters = () => { setPage(0); setApplied({ q, type, gwp, year }); };
  const onFilter = (setter, key) => (e) => {
    const v = e.target.value;
    setter(v);
    setApplied((a) => ({ ...a, [key]: v }));
    setPage(0);
  };
  const reset = () => {
    setQ(''); setType(''); setGwp(''); setYear('');
    setApplied({ q: '', type: '', gwp: '', year: '' });
    setPage(0);
  };
  const facets = data?.facets;
  const total = data?.count ?? 0;
  const lastPage = Math.max(Math.ceil(total / PAGE_SIZE) - 1, 0);
  return (
    <main className="page">
      <h2>Emission factor library</h2>
      <p className="hint">741 curated public factors (UK DESNZ 2026, US EPA 2025, USEEIO) shipped offline with the app. Keywords are ANDed; combine filters to narrow.</p>
      {focus && (
        <section className="card focus-card" aria-label="Factor detail">
          <div className="row card-head">
            <h3 className="mono">{focus.factor_id}</h3>
            <button className="btn sm ghost" onClick={() => setFocus(null)}>Close</button>
          </div>
          <FactorDetail f={focus} />
        </section>
      )}
      <form className="card lib-controls" onSubmit={(e) => { e.preventDefault(); applyFilters(); }}>
        <div className="row">
          <label className="grow">Keywords (comma-separated, ANDed)
            <input value={q} placeholder="e.g. air freight, electricity" onChange={(e) => setQ(e.target.value)} /></label>
          <label>Activity type
            <select value={type} onChange={onFilter(setType, 'type')} aria-label="Filter by activity type">
              <option value="">All</option>
              {(facets?.activity_types ?? []).map((t) => <option key={t} value={t}>{t}</option>)}
            </select></label>
          <label>GWP
            <select value={gwp} onChange={onFilter(setGwp, 'gwp')} aria-label="Filter by GWP version">
              <option value="">All</option>
              {(facets?.gwp_versions ?? []).map((g) => <option key={g} value={g}>{g}</option>)}
            </select></label>
          <label>Data year
            <select value={year} onChange={onFilter(setYear, 'year')} aria-label="Filter by data year">
              <option value="">All</option>
              {(facets?.data_years ?? []).map((y) => <option key={y} value={y}>{y}</option>)}
            </select></label>
          <button type="submit" disabled={busy}>{busy ? 'Searching…' : 'Search'}</button>
          {(q || type || gwp || year || applied.q) && <button type="button" className="ghost" onClick={reset}>Reset</button>}
        </div>
      </form>
      <Err error={err} onRetry={load} />
      {data && total === 0 && <Empty title="No factors match">Loosen the keywords or clear a filter — all 741 factors are available.</Empty>}
      {data && total > 0 && (
        <>
          <p className="hint" role="status">{total} factor{total === 1 ? '' : 's'} · page {page + 1} of {lastPage + 1}</p>
          <div className="tablewrap"><table className="tbl">
            <thead><tr><th>ID</th><th>Name</th><th>Type</th><th>Value</th><th>Year</th><th>GWP</th><th>Source</th></tr></thead>
            <tbody>{data.factors.map((f) => (
              <React.Fragment key={f.factor_id}>
                <tr className="rowlink" tabIndex={0} onClick={() => setExpanded(expanded === f.factor_id ? null : f.factor_id)}
                  onKeyDown={(e) => e.key === 'Enter' && setExpanded(expanded === f.factor_id ? null : f.factor_id)}
                  aria-expanded={expanded === f.factor_id}>
                  <td className="mono">{f.factor_id}</td>
                  <td>{f.name}</td>
                  <td>{f.activity_type}</td>
                  <td className="num">{f.value} <span className="muted">{f.emission_unit}/{f.activity_unit}</span></td>
                  <td className="num">{f.data_year}</td>
                  <td>{f.gwp_version}</td>
                  <td className="muted" title={f.source_name}>{f.source_name.split('(')[0]}</td>
                </tr>
                {expanded === f.factor_id && (
                  <tr className="detail"><td colSpan={7}><FactorDetail f={f} /></td></tr>
                )}
              </React.Fragment>
            ))}</tbody>
          </table></div>
          <div className="row actions">
            <button className="ghost" disabled={page === 0 || busy} onClick={() => setPage((p) => Math.max(p - 1, 0))}>← Previous</button>
            <span className="hint" aria-live="polite">Page {page + 1} / {lastPage + 1}</span>
            <button className="ghost" disabled={page >= lastPage || busy} onClick={() => setPage((p) => p + 1)}>Next →</button>
          </div>
        </>
      )}
    </main>
  );
}

function FactorDetail({ f }) {
  return (
    <div className="factor-detail">
      <p><b>{f.name}</b></p>
      <p>{f.description}</p>
      <dl>
        <dt>Factor value</dt><dd>{f.value} {f.emission_unit} / {f.activity_unit}</dd>
        <dt>Activity type</dt><dd>{f.activity_type}</dd>
        <dt>System boundary</dt><dd>{f.system_boundary}</dd>
        <dt>GHG coverage</dt><dd>{f.ghg_coverage}</dd>
        <dt>GWP version</dt><dd>{f.gwp_version} · data year {f.data_year}</dd>
        <dt>Source</dt><dd>{f.source_name}</dd>
      </dl>
    </div>
  );
}

export function TasksPage({ onTask, current }) {
  const { data, err, reload } = useData(() => api.listTasks(), []);
  const tasks = data?.tasks ?? [];
  return (
    <main className="page">
      <div className="row card-head">
        <h2>Tasks</h2>
        <a className="button ghost" href="#/">+ New task</a>
      </div>
      <p className="hint">Tasks you own in this anonymous session, plus ownerless public ones (demo, scripts). Switching re-points every page at the chosen task.</p>
      <Err error={err} onRetry={reload} />
      {tasks.length === 0 && !err && <Empty title="No tasks yet">Create one from the home page, or load the demo dataset on the upload page.</Empty>}
      {tasks.length > 0 && (
        <table className="tbl">
          <thead><tr><th></th><th>Entity</th><th>Period</th><th>GWP</th><th>Documents</th><th>Status</th><th>Created</th><th></th></tr></thead>
          <tbody>{tasks.map((t) => (
            <tr key={t.task_id} className={t.task_id === current ? 'selected' : ''}>
              <td aria-hidden>{t.task_id === current ? '●' : ''}</td>
              <td>{t.entity_name}</td>
              <td>{t.period_from} → {t.period_to}</td>
              <td>{t.gwp_version}</td>
              <td className="num">{t.document_count}</td>
              <td>{t.status}</td>
              <td>{String(t.created_at ?? '').slice(0, 16).replace('T', ' ')}</td>
              <td className="rowactions">
                {t.task_id !== current
                  ? <button className="btn sm" onClick={() => { onTask(t.task_id); location.hash = '#/dashboard'; }}>Switch to</button>
                  : <span className="muted">current</span>}
              </td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </main>
  );
}
