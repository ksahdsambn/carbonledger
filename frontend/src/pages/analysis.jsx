// Analysis pages: P4 factor matching viewer (best vs runner-up, PRD 9.1),
// P5 emissions dashboard with SVG charts, P6 reduction scenario cards.
import React, { useEffect, useState } from 'react';
import api from '../api.js';
import { Donut, HBars, LineChart, CompareBar } from '../charts.jsx';
import { useData, Empty, Err, Level, LEVEL_COLOR, fmtNum, t3 } from './shared.jsx';

// ---------------------------------------------------------------- P4
export function P4Matching({ taskId, params }) {
  const [recordId, setRecordId] = useState(params.get('record'));
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { const r = params.get('record'); if (r) setRecordId(r); }, [params]);
  const { data: dash, err, reload } = useData(() => api.dashboard(taskId), [taskId]);
  const recs = dash?.records ?? [];
  const rec = recs.find((r) => r.record_id === recordId);
  const { data: cand, err: candErr, reload: candReload } = useData(
    () => (rec ? api.candidates(taskId, rec.record_id) : Promise.resolve(null)),
    [taskId, rec?.record_id],
  );
  const assign = async (fid) => {
    setBusy(true); setMsg(null);
    try {
      await api.reviewAction(taskId, rec.record_id, { action: 'assign', factor_id: fid });
      setMsg('Factor manually assigned; results recalculated.');
      candReload();
    } catch (ex) { setMsg(ex.message); }
    setBusy(false);
  };
  if (err) return <main className="page"><h2>Factor matching viewer</h2><Err error={err} onRetry={reload} /></main>;
  return (
    <main className="page">
      <h2>Factor matching viewer</h2>
      <div className="row">
        <label>Record
          <select value={recordId ?? ''} onChange={(e) => setRecordId(e.target.value)} aria-label="Choose an activity record">
            <option value="">— choose a record —</option>
            {recs.map((r) => <option key={r.record_id} value={r.record_id}>{r.record_id} · {r.item_description.slice(0, 60)}</option>)}
          </select>
        </label>
      </div>
      {recs.length === 0 && <Empty title="No records to match yet">Run the pipeline on P2 first; every extracted record gets a candidate window here.</Empty>}
      {!rec && recs.length > 0 && <p className="hint">Choose a record above, or open one from P3.</p>}
      {rec && (
        <>
          <p><b className="mono">{rec.record_id}</b> · {rec.item_description} · {rec.quantity} {rec.unit}</p>
          {msg && <p className="note" role="status">{msg}</p>}
          <Err error={candErr} onRetry={candReload} />
          {cand?.match && (
            <section className="card compare-card" aria-label="Best versus runner-up comparison">
              <h3>Model selection — best vs runner-up</h3>
              <div className="compare-grid">
                <div className="compare-col best">
                  <span className="badge badge-best">✓ Best match</span>
                  <p className="factor-name">{cand.match.selected?.name ?? cand.match.selected_factor_id}</p>
                  <p className="mono">{cand.match.selected_factor_id}
                    {cand.match.selected?.value != null ? ` · ${cand.match.selected.value} kgCO2e/${cand.match.selected.activity_unit}` : ''}</p>
                </div>
                <div className="compare-col runner">
                  <span className="badge badge-runner">Runner-up</span>
                  {cand.match.runner_up || cand.match.runner_up_factor_id ? (
                    <>
                      <p className="factor-name">{cand.match.runner_up?.name ?? cand.match.runner_up_factor_id}</p>
                      <p className="mono">{cand.match.runner_up_factor_id}
                        {cand.match.runner_up?.value != null ? ` · ${cand.match.runner_up.value} kgCO2e/${cand.match.runner_up.activity_unit}` : ''}</p>
                    </>
                  ) : <p className="muted">No runner-up retained for this selection.</p>}
                </div>
              </div>
              <p className="match-meta">Match confidence: <b>{Math.round((cand.match.confidence ?? 0) * 100)}%</b></p>
              {cand.match.rationale && <blockquote className="rationale">{cand.match.rationale}</blockquote>}
            </section>
          )}
          <h3>Candidates (recall channel output)</h3>
          <div className="tablewrap"><table className="tbl">
            <thead><tr><th>Factor</th><th>Unit</th><th>Value</th><th>Recall score</th><th>Role</th><th>Action</th></tr></thead>
            <tbody>{(cand?.candidates ?? []).map((f) => {
              const isSel = cand?.match?.selected_factor_id === f.factor_id;
              const isRun = cand?.match?.runner_up_factor_id === f.factor_id;
              return (
                <tr key={f.factor_id} className={isSel ? 'best-row' : undefined}>
                  <td title={f.name} className="mono">{f.factor_id}</td>
                  <td>{f.activity_unit}</td>
                  <td className="num">{f.value}</td>
                  <td className="num">{f.score != null ? f.score.toFixed(3) : '—'}</td>
                  <td>{isSel ? <span className="badge badge-best">✓ selected</span> : isRun ? <span className="badge badge-runner">runner-up</span> : ''}</td>
                  <td><button className="btn sm" disabled={busy} onClick={() => assign(f.factor_id)}>Assign manually</button></td>
                </tr>
              );
            })}</tbody>
          </table></div>
        </>
      )}
    </main>
  );
}

// ---------------------------------------------------------------- P5
export function P5Dashboard({ taskId }) {
  const { data: dash, err, reload } = useData(() => api.dashboard(taskId), [taskId]);
  const [dim, setDim] = useState('scope');
  if (err) return <main className="page"><h2>Dashboard</h2><Err error={err} onRetry={reload} /></main>;
  if (!dash) return <main className="page"><h2>Dashboard</h2><p className="hint" role="status">Loading…</p></main>;
  if (!dash.records?.length) return <main className="page"><h2>Dashboard</h2><Empty title="No data yet">Run the pipeline on P2 — charts appear as soon as records are calculated.</Empty></main>;
  const dims = { scope: dash.agg?.scope ?? [], category: dash.agg?.category ?? [], supplier: dash.agg?.supplier ?? [], month: dash.agg?.month ?? [] };
  const total = t3(dash.total_kgco2e);
  const high = dash.distribution?.high ?? 0;
  const highShare = dash.records.length ? `${Math.round((high / dash.records.length) * 100)}%` : '—';
  const top = dash.top?.[0];
  const chart = dim === 'scope'
    ? <Donut rows={dims.scope} formatValue={t3} />
    : dim === 'month'
      ? <LineChart rows={dims.month} />
      : <HBars rows={dims[dim]} unitLabel="t CO2e" formatValue={t3} />;
  return (
    <main className="page">
      <h2>Emissions dashboard</h2>
      <div className="kpi-grid">
        <div className="kpi"><span className="kpi-label">Total emissions</span><span className="kpi-value">{total}<span className="kpi-unit">t CO2e</span></span></div>
        <div className="kpi"><span className="kpi-label">Activity records</span><span className="kpi-value">{dash.records.length}</span></div>
        <div className="kpi"><span className="kpi-label">Largest source</span><span className="kpi-value kpi-text" title={top?.description}>{top ? top.description.slice(0, 38) : '—'}</span>
          {top && <span className="kpi-sub">{t3(top.emission_kgco2e)} t CO2e</span>}</div>
        <div className="kpi"><span className="kpi-label">High-uncertainty records</span><span className="kpi-value">{high}<span className="kpi-unit">({highShare} of records)</span></span></div>
      </div>
      <section className="card">
        <div className="row card-head">
          <h3>Breakdown by dimension</h3>
          <div className="row" role="tablist" aria-label="Dimension">
            {Object.keys(dims).map((d) => <button key={d} className={`chip${dim === d ? ' active' : ''}`} role="tab" aria-selected={dim === d} onClick={() => setDim(d)}>{d}</button>)}
          </div>
        </div>
        {chart}
      </section>
      <div className="two-col">
        <section className="card">
          <h3>Top emission sources</h3>
          <table className="tbl"><thead><tr><th>Record</th><th>Description</th><th>t CO2e</th></tr></thead>
            <tbody>{dash.top?.map((x) => <tr key={x.record_id}><td className="mono">{x.record_id}</td><td>{x.description}</td><td className="num">{t3(x.emission_kgco2e)}</td></tr>)}</tbody></table>
        </section>
        <section className="card">
          <h3>Uncertainty distribution</h3>
          <HBars rows={Object.entries(dash.distribution ?? {}).map(([key, value]) => ({ key, value }))}
            formatValue={(v) => String(v)} maxRows={3} color={({ key }) => LEVEL_COLOR[key] ?? '#718096'} />
          <table className="tbl mini"><tbody>{Object.entries(dash.distribution ?? {}).map(([k, v]) => (
            <tr key={k}><td><Level level={k} /></td><td className="num">{v} records</td></tr>
          ))}</tbody></table>
        </section>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------- P6
export function P6Scenarios({ taskId }) {
  const [rep, setRep] = useState(null);
  const [err, setErr] = useState(null);
  const [ratio, setRatio] = useState(1.0);
  const [busy, setBusy] = useState(false);
  // Rerun errors surface here (D-103): a failed ratio recompute must be
  // visible, not silently swallowed while the old numbers stay on screen.
  const [runErr, setRunErr] = useState(null);
  const load = () => api.report(taskId).then((r) => { setRep(r.report); setErr(null); }).catch((e) => setErr(e));
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [taskId]);
  if (err) {
    return <main className="page"><h2>Scenarios</h2><Err error={err} onRetry={load} /></main>;
  }
  const chapter = rep?.chapters.find((c) => c.no === 7);
  if (!rep) return <main className="page"><h2>Scenarios</h2><Empty title="Run the pipeline first">The three reduction scenarios are computed together with the report.</Empty></main>;
  // Chapter 7 alternates a one-row table (name, reduction, pct) with the
  // feasibility narrative that belongs to it.
  const scenarios = [];
  for (const b of chapter?.blocks ?? []) {
    if (b.type === 'table' && b.rows?.[0]) {
      const [name, redT, pct] = b.rows[0];
      scenarios.push({ name: String(name), reduction_t: Number(redT) || 0, pct: String(pct), feasibility: null });
    } else if (b.type === 'text' && scenarios.length) {
      scenarios[scenarios.length - 1].feasibility = b.text;
    }
  }
  const baseline = Number(rep.meta?.total_t ?? 0);
  return (
    <main className="page">
      <h2>Reduction scenarios</h2>
      <section className="card">
        <label>Replacement ratio: <output><b>{Math.round(ratio * 100)}%</b></output>
          <input type="range" min="0" max="100" value={ratio * 100} disabled={busy}
            onChange={(e) => setRatio(Number(e.target.value) / 100)}
            onBlur={async () => {
              setBusy(true);
              setRunErr(null);
              try {
                await api.runPipeline(taskId, ratio);
                const r = await api.report(taskId);
                setRep(r.report);
                // A background run failure arrives as 200 + last_run_error:
                // the stored report is the previous run's, so say so (D-107).
                if (r.last_run_error) setRunErr(`The recompute failed on the server: ${r.last_run_error}. The numbers below are from the previous run.`);
              } catch (e) {
                // A report-fetch timeout means the run is still going (real-AI
                // runs outlast the 60 s fetch budget) — not a failed recompute.
                const timedOut = e?.name === 'TimeoutError' || /timed out|aborted/i.test(String(e?.message ?? ''));
                setRunErr(timedOut
                  ? 'The recompute is still running; the numbers below are from the previous run until it finishes.'
                  : `Recompute at the selected ratio failed: ${e.message ?? String(e)}. The numbers below are from the previous run.`);
              }
              setBusy(false);
            }}
            aria-label="Replacement ratio percent" /></label>
        <p className="hint">{busy ? 'Recomputing scenarios at the selected ratio…' : 'Adjust the slider and release to recompute at the selected ratio.'}</p>
        {runErr && <p className="error" role="alert">{runErr}</p>}
      </section>
      <div className="scenario-grid">
        {scenarios.map((s, i) => (
          <section key={i} className="card scenario-card" aria-label={s.name}>
            <h3>{s.name}</h3>
            <p className="scenario-figures"><b>−{fmtNum(s.reduction_t)} t CO2e</b> <span className="kpi-unit">({s.pct} of baseline {fmtNum(baseline)} t)</span></p>
            <CompareBar baseline={baseline} remaining={Math.max(baseline - s.reduction_t, 0)} />
            {s.feasibility && <details className="feasible"><summary>Feasibility analysis</summary><p>{s.feasibility}</p></details>}
          </section>
        ))}
      </div>
    </main>
  );
}
