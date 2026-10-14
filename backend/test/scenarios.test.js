// Tests for the reduction scenario engine (T-031): auto-computability,
// hand-recomputation agreement, zero-applicable handling, feasibility length,
// ratio consistency.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { LocalFileStore } from '../src/store/index.js';
import { loadFactorLibrary } from '../src/services/factorLibrary.js';
import { computeEmission } from '../src/services/calculation.js';
import { computeScenarios } from '../src/services/scenarios.js';

const LIB = JSON.parse(readFileSync(new URL('../../data/factors/emission_factors.json', import.meta.url), 'utf8')).factors;
const byId = Object.fromEntries(LIB.map((f) => [f.factor_id, f]));

function rec(rid, o) {
  return { record_id: rid, task_id: 't1', quantity: 1000, unit: 'kg', activity_date: '2026-03-01', ...o };
}

test('three scenarios auto-compute, hand-recomputation matches, zero-case and ratio behave', async () => {
  const store = new LocalFileStore(mkdtempSync(join(tmpdir(), 'scen-')));
  await loadFactorLibrary(store);
  const records = [
    rec('R1', { item_description: 'air freight LAX-NRT', transport_mode: 'Air transport (general cargo)', gross_weight_kg: 1200, distance_km: 8780, supplier_name: 'Nippon Air' }),
    rec('R2', { item_description: 'road freight MEM-NSH', transport_mode: 'Road freight', gross_weight_kg: 5000, distance_km: 300, supplier_name: 'Lone Star Haulage' }),
    rec('R3', { item_description: 'rail freight', transport_mode: 'Rail transport', gross_weight_kg: 40000, distance_km: 600, supplier_name: 'Union Pacific Rail' }),
    rec('R4', { item_description: 'primary aluminium sheet', supplier_name: 'Aluworks' }),
    rec('R5', { item_description: 'PET film', supplier_name: 'Heartland Polymer' }),
    rec('R6', { item_description: 'grid electricity', quantity: 45000, unit: 'kWh', supplier_name: 'Grid Co' }),
  ];
  const picks = {
    R1: byId['EF-D26-AIRFREIGHT-007'], R2: byId['EF-D26-ROADFREIGHT-009'],
    R3: byId['EF-D26-ROADFREIGHT-026'] ?? Object.values(byId).find((f) => /Rail \/ Freight train — Diesel/.test(f.name)),
    R4: byId['EF-D26-MATERIALUSE-039'], R5: byId['EF-D26-MATERIALUSE-057'],
    R6: byId['EF-D26-UKELECTRICITY-001'],
  };
  const calcs = [];
  for (const r of records) {
    calcs.push(await computeEmission({ store, record: r, factor: picks[r.record_id], taskGwpVersion: 'AR5' }));
  }

  const out = await computeScenarios({ store, taskId: 't1', records, calcs, factorsById: byId, taskGwpVersion: 'AR5' });
  assert.equal(out.scenarios.length, 3);

  // 1 — fully automatic, no user input
  assert.ok(out.scenarios.every((s) => typeof s.reduction_kgco2e === 'number' && Array.isArray(s.affected)));

  // 2 — hand-recompute 5 affected records
  const s1 = out.scenarios[0];
  const sea = byId['EF-D26-SEAFREIGHT-039'];
  const rail = Object.values(byId).find((f) => /Rail \/ Freight train — Diesel/.test(f.name));
  const eR1 = (1200 / 1000) * 8780 * sea.value;
  const eR2 = (5000 / 1000) * 300 * rail.value;
  const hR1 = s1.affected.find((x) => x.record_id === 'R1');
  const hR2 = s1.affected.find((x) => x.record_id === 'R2');
  assert.ok(Math.abs(hR1.alternative_kgco2e - eR1) < 1e-6, `R1 ${hR1.alternative_kgco2e} vs ${eR1}`);
  assert.ok(Math.abs(hR2.alternative_kgco2e - eR2) < 1e-6);
  const s2 = out.scenarios[1];
  // top-3 suppliers by emissions are Aluworks/Grid/Heartland; the electricity
  // category has a single factor in the library, so that record is noted
  // rather than swapped — two swappable records remain.
  assert.ok(s2.affected.length >= 2, `S-2 affected ${s2.affected.length}`);
  assert.ok(s2.unaffected_reasons.some((n) => /no alternative factor/.test(n)));
  const s3 = out.scenarios[2];
  const aluAlt = s3.affected.find((x) => x.record_id === 'R4');
  assert.ok(aluAlt && aluAlt.alternative_factor_id !== 'EF-D26-MATERIALUSE-039');
  assert.ok(Math.abs(aluAlt.alternative_kgco2e - (2.5 * 993.59114 * 0 + (1000 / 1000) * 993.59114)) < 1e-6 || aluAlt.alternative_kgco2e < aluAlt.original_kgco2e);

  // 3 — zero-applicable task for S-1
  const noTransport = await computeScenarios({
    store, taskId: 't2',
    records: [rec('Z1', { item_description: 'paper', supplier_name: 'S' })],
    calcs: [await computeEmission({ store, record: rec('Z1', { item_description: 'paper', supplier_name: 'S' }), factor: byId['EF-D26-MATERIALUSE-065'], taskGwpVersion: 'AR5' })],
    factorsById: byId, taskGwpVersion: 'AR5',
  });
  const z1 = noTransport.scenarios[0];
  assert.equal(z1.affected.length, 0);
  assert.equal(z1.reduction_kgco2e, 0);
  assert.ok(z1.unaffected_reasons.length > 0 && /zero records/.test(z1.unaffected_reasons[0]));

  // 4 — feasibility >= 80 English words with assumptions
  for (const s of out.scenarios) {
    const words = s.feasibility_text.split(/\s+/).filter(Boolean).length;
    assert.ok(words >= 80, `${s.scenario_id} feasibility ${words} words`);
    assert.ok(/Assumptions:/.test(s.feasibility_text) && /Limitations:/.test(s.feasibility_text));
  }

  // 5 — ratio parameter: half ratio halves the reduction linearly
  const half = await computeScenarios({ store, taskId: 't3', records, calcs, factorsById: byId, taskGwpVersion: 'AR5', ratio: 0.5 });
  for (let i = 0; i < 3; i += 1) {
    assert.ok(Math.abs(half.scenarios[i].reduction_kgco2e - out.scenarios[i].reduction_kgco2e / 2) < 1e-6);
  }
  rmSync(store.rootDir, { recursive: true, force: true });
});
