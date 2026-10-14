// Dependency-free SVG charts for the dashboard and scenario pages (PRD 9.1
// P5/P6). Every chart carries an aria-label summarising its data, so the
// information is not colour- or shape-only (NFR-404 spirit). The palette is
// a restrained, colour-blind-aware set on the light theme (PRD 9.2).
import React from 'react';

export const CHART_COLORS = ['#1d6f54', '#2b6cb0', '#b7791f', '#6b46c1', '#2c7a7b', '#718096', '#a12622', '#975a16'];
const sum = (rows) => rows.reduce((a, r) => a + (Number(r.value) || 0), 0);

/** Donut chart with a centred total and a legend beside it. */
export function Donut({ rows, unitLabel = 't CO2e', formatValue }) {
  const fmt = formatValue ?? ((v) => v.toLocaleString('en-US', { maximumFractionDigits: 3 }));
  const total = sum(rows);
  const size = 180;
  const r = 70;
  const c = 2 * Math.PI * r;
  // One shared key->colour map feeds both the arcs and the legend, so a
  // zero-value group can never shift the arc colours against the legend.
  const colorByKey = new Map(rows.map((x, i) => [x.key, CHART_COLORS[i % CHART_COLORS.length]]));
  let acc = 0;
  const arcs = rows.filter((x) => x.value > 0).map((x) => {
    const frac = total > 0 ? x.value / total : 0;
    const arc = { ...x, frac, dash: `${frac * c} ${c}`, offset: -acc * c, color: colorByKey.get(x.key) };
    acc += frac;
    return arc;
  });
  return (
    <div className="chart-block" role="img"
      aria-label={`Donut chart, ${unitLabel} by ${rows.length} group(s): ${rows.map((x) => `${x.key} ${fmt(x.value)}`).join('; ')}`}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="donut">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e9edf1" strokeWidth="22" />
        {arcs.map((a) => (
          <circle key={a.key} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={a.color}
            strokeWidth="22" strokeDasharray={a.dash} strokeDashoffset={a.offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            <title>{`${a.key}: ${fmt(a.value)} ${unitLabel} (${(a.frac * 100).toFixed(1)}%)`}</title>
          </circle>
        ))}
        <text x={size / 2} y={size / 2 - 4} textAnchor="middle" className="donut-total">{fmt(total)}</text>
        <text x={size / 2} y={size / 2 + 14} textAnchor="middle" className="donut-unit">{unitLabel}</text>
      </svg>
      <ul className="legend">
        {rows.map((x, i) => (
          <li key={x.key}>
            <span className="legend-swatch" style={{ background: colorByKey.get(x.key) }} aria-hidden />
            <span className="legend-key">{x.key}</span>
            <span className="legend-val">{fmt(x.value)} · {total > 0 ? `${((x.value / total) * 100).toFixed(1)}%` : '0%'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Horizontal bar chart; color is per-row (function) or single accent. */
export function HBars({ rows, unitLabel = '', formatValue, color, maxRows = 12 }) {
  const fmt = formatValue ?? ((v) => v.toLocaleString('en-US', { maximumFractionDigits: 3 }));
  const data = rows.filter((x) => Number(x.value) > 0).slice(0, maxRows);
  const max = Math.max(...data.map((x) => x.value), 1);
  if (!data.length) return <p className="empty">No positive values to chart.</p>;
  return (
    <div className="chart-block hbars" role="img"
      aria-label={`Bar chart${unitLabel ? `, ${unitLabel}` : ''}: ${data.map((x) => `${x.key} ${fmt(x.value)}`).join('; ')}`}>
      {data.map((x, i) => (
        <div className="hbar-row" key={x.key}>
          <span className="hbar-key" title={x.key}>{x.key}</span>
          <span className="hbar-track">
            <span className="hbar-fill" style={{ width: `${Math.max((x.value / max) * 100, 1.5)}%`, background: color ? color(x, i) : undefined }} />
          </span>
          <span className="hbar-val">{fmt(x.value)}{unitLabel ? ` ${unitLabel}` : ''}</span>
        </div>
      ))}
    </div>
  );
}

/** Line chart for the monthly trend with dots, gridlines and min/max labels. */
export function LineChart({ rows, unitLabel = 't CO2e', formatValue }) {
  const fmt = formatValue ?? ((v) => v.toLocaleString('en-US', { maximumFractionDigits: 3 }));
  const data = rows.filter((x) => Number.isFinite(Number(x.value)));
  if (data.length < 2) return <p className="empty">Not enough points for a trend line.</p>;
  const w = 640; const h = 220; const padL = 14; const padR = 14; const padT = 18; const padB = 30;
  const max = Math.max(...data.map((x) => x.value));
  const min = Math.min(...data.map((x) => x.value));
  const span = max - min || 1;
  const x = (i) => padL + (i * (w - padL - padR)) / (data.length - 1);
  const y = (v) => padT + (1 - (v - min) / span) * (h - padT - padB);
  const pts = data.map((d, i) => `${x(i)},${y(d.value)}`).join(' ');
  const ticks = [max, min + span / 2, min];
  return (
    <div className="chart-block" role="img"
      aria-label={`Line chart, ${unitLabel} by month: ${data.map((x) => `${x.key} ${fmt(x.value)}`).join('; ')}`}>
      <svg viewBox={`0 0 ${w} ${h}`} className="linechart" width="100%">
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} className="grid" />
            <text x={padL + 2} y={y(t) - 3} className="tick">{fmt(Number(t.toFixed(3)))}</text>
          </g>
        ))}
        <polyline points={pts} className="trend" />
        {data.map((d, i) => (
          <circle key={d.key} cx={x(i)} cy={y(d.value)} r="4" className="trend-dot">
            <title>{`${d.key}: ${fmt(d.value)} ${unitLabel}`}</title>
          </circle>
        ))}
        <text x={x(0)} y={h - 8} textAnchor="middle" className="tick">{data[0].key}</text>
        <text x={x(data.length - 1)} y={h - 8} textAnchor="end" className="tick">{data[data.length - 1].key}</text>
      </svg>
    </div>
  );
}

/** Paired before/after bars for the scenario cards (baseline vs remaining). */
export function CompareBar({ baseline, remaining, formatValue }) {
  const fmt = formatValue ?? ((v) => v.toLocaleString('en-US', { maximumFractionDigits: 3 }));
  const max = Math.max(baseline, remaining, 1);
  return (
    <div className="chart-block comparebar" role="img"
      aria-label={`Baseline ${fmt(baseline)} versus remaining ${fmt(remaining)} t CO2e`}>
      <div className="hbar-row">
        <span className="hbar-key">Baseline</span>
        <span className="hbar-track"><span className="hbar-fill muted" style={{ width: `${(baseline / max) * 100}%` }} /></span>
        <span className="hbar-val">{fmt(baseline)}</span>
      </div>
      <div className="hbar-row">
        <span className="hbar-key">After</span>
        <span className="hbar-track"><span className="hbar-fill" style={{ width: `${Math.max((remaining / max) * 100, 1.5)}%` }} /></span>
        <span className="hbar-val">{fmt(remaining)}</span>
      </div>
    </div>
  );
}
