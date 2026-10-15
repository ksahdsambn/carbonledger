// Emission factor library service (T-007): loads the static factor data file
// into the structured store (collection `emission_factors`, PRD 8.4), and
// provides by-id lookup, keyword search, and the year distribution used by
// report appendices (FR-606). Vector data (`embedding`) is reserved here and
// filled by the semantic index build in T-021.

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
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
// Bumped on every invalidation (D-108): a listFactors read that started
// before a refresh and resolves after its final invalidation must not write
// its stale snapshot back into the cache.
const generation = new WeakMap();

export function invalidateFactorCache(store) {
  if (store) {
    cache.delete(store);
    generation.set(store, (generation.get(store) ?? 0) + 1);
  }
}

// Collection-internal bookkeeping document holding the loaded library's
// content fingerprint (D-104). '_' ids never surface as factors.
const META_ID = '_library_meta';

/** Returns the whole factor library, memoized for the store's lifetime. */
export async function listFactors(store) {
  let factors = cache.get(store);
  if (!factors) {
    const g = generation.get(store) ?? 0;
    factors = (await store.list('emission_factors'))
      .filter((f) => typeof f.id !== 'string' || !f.id.startsWith('_'));
    if ((generation.get(store) ?? 0) === g) cache.set(store, factors);
  }
  return factors;
}

/** Persists factor rows and drops the memoized copy so the next read refreshes. */
export async function saveFactors(store, rows) {
  for (const row of rows) await store.put('emission_factors', row.factor_id, row);
  invalidateFactorCache(store);
}

/**
 * Loads every factor from the static file into the store. Idempotent.
 * The skip decision uses a content fingerprint of the file (D-104): a count
 * comparison missed same-count value edits, and an upsert-only refresh left
 * rows that had been removed from the file behind as ghost factors in
 * long-lived stores (the 743 -> 741 data refresh shipped exactly such
 * removals). On refresh, rows absent from the file are deleted.
 * @param {object} store
 * @param {string} [file] data file to load; defaults to the resolved FACTOR_FILE
 */
export async function loadFactorLibrary(store, file = FACTOR_FILE) {
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  const fingerprint = createHash('sha256').update(JSON.stringify(raw.factors)).digest('hex');
  if ((await store.get('emission_factors', META_ID))?.fingerprint === fingerprint) {
    return { loaded: 0, total: (await listFactors(store)).length, skipped: true };
  }
  const existing = await listFactors(store);
  const freshIds = new Set(raw.factors.map((f) => f.factor_id));
  await saveFactors(store, raw.factors.map((f) => ({ ...f, embedding: null })));
  let removed = 0;
  for (const f of existing) {
    if (!freshIds.has(f.factor_id)) {
      await store.delete('emission_factors', f.factor_id);
      removed += 1;
    }
  }
  await store.put('emission_factors', META_ID, { fingerprint, loaded_at: new Date().toISOString() });
  invalidateFactorCache(store);
  log.info('factor_library_loaded', { count: raw.factors.length, removed_stale: removed });
  return { loaded: raw.factors.length, total: raw.factors.length, skipped: false };
}

export async function getFactorById(store, factorId) {
  // '_' ids are collection bookkeeping (the D-104 fingerprint doc), never
  // factors — a lookup must not hand them out as selectable factors.
  if (typeof factorId === 'string' && factorId.startsWith('_')) return null;
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
