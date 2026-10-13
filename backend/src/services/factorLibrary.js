// Emission factor library service (T-007): loads the static factor data file
// into the structured store (collection `emission_factors`, PRD 8.4), and
// provides by-id lookup, keyword search, and the year distribution used by
// report appendices (FR-606). Vector data (`embedding`) is reserved here and
// filled by the semantic index build in T-021.

import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { log } from '../logging.js';

// Resolve relative to this module so the path is CWD-independent; the env
// override (if relative) resolves from the current working directory.
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const FACTOR_FILE = process.env.FACTOR_FILE
  ? resolve(process.env.FACTOR_FILE)
  : join(REPO_ROOT, 'data/factors/emission_factors.json');

// The factor library is static data shipped with the application (FR-605) and
// never changes at runtime, so it is read from the store once per store.
// A full list carries one 3072-dimension vector per factor; re-reading it for
// every record dominated end-to-end latency on the managed store (T-044).
// Keyed by store so several stores in one process (tests) stay independent.
const cache = new WeakMap();

export function invalidateFactorCache(store) {
  if (store) cache.delete(store);
}

/** Returns the whole factor library, memoized for the store's lifetime. */
export async function listFactors(store) {
  let factors = cache.get(store);
  if (!factors) {
    factors = await store.list('emission_factors');
    cache.set(store, factors);
  }
  return factors;
}

/** Persists factor rows and drops the memoized copy so the next read refreshes. */
export async function saveFactors(store, rows) {
  for (const row of rows) await store.put('emission_factors', row.factor_id, row);
  invalidateFactorCache(store);
}

/** Loads every factor from the static file into the store. Idempotent. */
export async function loadFactorLibrary(store) {
  const raw = JSON.parse(readFileSync(FACTOR_FILE, 'utf8'));
  const existing = await listFactors(store);
  if (existing.length === raw.factors.length) {
    return { loaded: 0, total: existing.length, skipped: true };
  }
  await saveFactors(store, raw.factors.map((f) => ({ ...f, embedding: null })));
  log.info('factor_library_loaded', { count: raw.factors.length });
  return { loaded: raw.factors.length, total: raw.factors.length, skipped: false };
}

export async function getFactorById(store, factorId) {
  return store.get('emission_factors', factorId);
}

/**
 * Keyword search over name / description / activity_type / system_boundary
 * (recall channel one of the dual-channel design, FR-604).
 * @param {string[]} terms
 */
export async function searchFactorsByKeyword(store, terms) {
  const all = await listFactors(store);
  const lowered = terms.map((t) => String(t).toLowerCase());
  return all.filter((f) => {
    const hay = `${f.name} ${f.description} ${f.activity_type} ${f.system_boundary}`.toLowerCase();
    return lowered.every((t) => hay.includes(t));
  });
}

/** Year distribution for the report appendix (FR-606). */
export async function factorYearDistribution(store) {
  const all = await listFactors(store);
  const dist = {};
  for (const f of all) dist[f.data_year] = (dist[f.data_year] || 0) + 1;
  return dist;
}

export const FACTOR_LIBRARY_FILE = FACTOR_FILE;
