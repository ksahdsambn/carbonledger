// Shared helpers and small presentational components for the page modules.
import React, { useEffect, useState } from 'react';
import api from '../api.js';

// Uncertainty levels carry outline icons in addition to colour (NFR-404).
export const LEVEL_ICON = { high: '▲', medium: '■', low: '●' };
export const LEVEL_LABEL = { high: 'High uncertainty', medium: 'Medium uncertainty', low: 'Low uncertainty' };
export const LEVEL_COLOR = { high: '#a12622', medium: '#8a6100', low: '#1d6f54' };
export const STATUS_ICON = { queued: '…', parsing: '⧉', extracting: '✎', matching: '⇄', completed: '✓', needs_review: '!', failed: '✗', pending_duplicate: '?' };
export const STATUS_LABEL = {
  queued: 'Queued', parsing: 'Parsing', extracting: 'Extracting', matching: 'Matching',
  completed: 'Completed', needs_review: 'Needs review', failed: 'Failed', pending_duplicate: 'Duplicate?',
};

/** kg CO2e -> t CO2e at the display-consistent 3-decimal rounding. */
export const t3 = (kg) => (Math.round((kg / 1000) * 1000) / 1000).toLocaleString('en-US');
export const fmtNum = (v, digits = 3) => (Number(v) || 0).toLocaleString('en-US', { maximumFractionDigits: digits });

/**
 * Tiny data-fetch hook: fetcher runs whenever deps (or a reload tick)
 * change; stale data is dropped while the new request is in flight, so a
 * page can never act on the previous key's response (e.g. assign the
 * previous record's factor after switching records).
 */
export function useData(fetcher, deps = []) {
  const [state, setState] = useState({ data: null, err: null, loading: true });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setState({ data: null, err: null, loading: true });
    fetcher()
      .then((d) => { if (alive) setState({ data: d, err: null, loading: false }); })
      .catch((e) => { if (alive) setState((s) => ({ data: s.data, err: e, loading: false })); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { ...state, reload: () => setTick((t) => t + 1) };
}

/** Download with a visible failure path (PRD 9.2: no silent dead ends). */
export async function downloadFile(path, filename) {
  try {
    await api.download(path, filename);
  } catch (e) {
    window.alert(`Download failed: ${e.message ?? e}. You can retry from the same button.`);
  }
}

/** Uncertainty chip: icon + label + colour (never colour alone). */
export function Level({ level }) {
  const l = level ?? 'medium';
  return <span className={`lvl lvl-${l}`}><span aria-hidden>{LEVEL_ICON[l]}</span> {LEVEL_LABEL[l]}</span>;
}

/** Document status chip with icon. */
export function Status({ status }) {
  return <span className={`st st-${status}`}><span aria-hidden>{STATUS_ICON[status] ?? '?'}</span> {STATUS_LABEL[status] ?? status}</span>;
}

/** Friendly empty state (PRD 9.2: no dead ends, always a way forward). */
export function Empty({ title = 'Nothing here yet', children }) {
  return (
    <div className="empty card">
      <p className="empty-title" role="status">{title}</p>
      {children && <p className="empty-body">{children}</p>}
    </div>
  );
}

/** Error note with a retry path (PRD 9.2: every error offers recovery). */
export function Err({ error, onRetry }) {
  if (!error) return null;
  return (
    <p className="error" role="alert">
      {String(error.message ?? error)}
      {onRetry && <> · <button className="linklike" onClick={onRetry}>Retry</button></>}
    </p>
  );
}
