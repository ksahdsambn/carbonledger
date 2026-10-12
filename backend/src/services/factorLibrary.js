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

/** Loads every factor from the static file into the store. Idempotent. */
export async function loadFactorLibrary(store) {
  const raw = JSON.parse(readFileSync(FACTOR_FILE, 'utf8'));
  const existing = await store.list('emission_factors');
  if (existing.length === raw.factors.length) {
    return { loaded: 0, total: existing.length, skipped: true };
  }
  for (const f of raw.factors) {
    await store.put('emission_factors', f.factor_id, { ...f, embedding: null });
  }
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
  const all = await store.list('emission_factors');
  const lowered = terms.map((t) => String(t).toLowerCase());
  return all.filter((f) => {
    const hay = `${f.name} ${f.description} ${f.activity_type} ${f.system_boundary}`.toLowerCase();
    return lowered.every((t) => hay.includes(t));
  });
}

/** Year distribution for the report appendix (FR-606). */
export async function factorYearDistribution(store) {
  const all = await store.list('emission_factors');
  const dist = {};
  for (const f of all) dist[f.data_year] = (dist[f.data_year] || 0) + 1;
  return dist;
}

export const FACTOR_LIBRARY_FILE = FACTOR_FILE;
