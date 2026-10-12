// Tests for factor library loading and queries (T-007).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalFileStore } from '../src/store/index.js';
import {
  loadFactorLibrary,
  getFactorById,
  searchFactorsByKeyword,
  factorYearDistribution,
} from '../src/services/factorLibrary.js';

const dir = mkdtempSync(join(tmpdir(), 'clfactors-'));

test('factor library loads into the store and queries resolve', async () => {
  const store = new LocalFileStore(dir);
  const res = await loadFactorLibrary(store);
  assert.equal(res.total, 619);

  const byId = await getFactorById(store, 'EF-D26-FREIGHTINGGOODS-001');
  assert.ok(byId);
  assert.equal(byId.data_year, 2026);
  assert.equal(byId.emission_unit, 'kgCO2e');
  assert.equal(byId.embedding, null); // reserved for T-021 vector index

  const elec = await searchFactorsByKeyword(store, ['electricity']);
  assert.ok(elec.length > 0);
  const air = await searchFactorsByKeyword(store, ['air']);
  assert.ok(air.length > 0);
  const steel = await searchFactorsByKeyword(store, ['metal']);
  assert.ok(steel.length > 0);

  const dist = await factorYearDistribution(store);
  const total = Object.values(dist).reduce((a, b) => a + b, 0);
  assert.equal(total, res.total);
  assert.ok(dist[2026] > 0 && dist[2025] > 0);
  rmSync(dir, { recursive: true, force: true });
});
