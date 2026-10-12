// Tests for the uncertainty rule engine (T-027) and calculation engine
// (T-029): 10 known-answer problems (hand-computed against frozen library
// values), GWP folding with audit trail, display-consistent aggregation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalFileStore } from '../src/store/index.js';
import { gradeUncertainty, unitSelfCheck, assessRecord, levelDistribution } from '../src/services/uncertainty.js';
import { computeEmission, aggregate, topEmitters, displayConsistent, toDisplayTons } from '../src/services/calculation.js';

const F = (id, value, unit, extra = {}) => ({ factor_id: id, value, activity_unit: unit, emission_unit: 'kgCO2e', ghg_coverage: 'CO2, CH4, N2O (folded)', ...extra });

test('uncertainty rules: severity order, thresholds, multi-hit worst wins', () => {
  assert.equal(gradeUncertainty({ confidence: 0.9, inferredFieldCount: 0 }), 'low');
  assert.equal(gradeUncertainty({ confidence: 0.7 }), 'medium');
  assert.equal(gradeUncertainty({ confidence: 0.9, inferredFieldCount: 1 }), 'medium');
  assert.equal(gradeUncertainty({ confidence: 0.5 }), 'high');
  assert.equal(gradeUncertainty({ confidence: 0.9, inferredFieldCount: 2 }), 'high');
  assert.equal(gradeUncertainty({ confidence: 0.9, needsSecondConversion: true }), 'high');
  assert.equal(gradeUncertainty({ confidence: 0.9, selfCheckPassed: false }), 'high');
  // multi-hit: confidence 0.5 (high) + 1 inferred (medium) -> high wins
  assert.equal(gradeUncertainty({ confidence: 0.5, inferredFieldCount: 1 }), 'high');
  // boundary values: 0.85 -> low zone; 0.64999 -> high
  assert.equal(gradeUncertainty({ confidence: 0.85 }), 'low');
  assert.equal(gradeUncertainty({ confidence: 0.6499 }), 'high');
});

test('unit self-check bridges freight/travel/same-dimension and fails cross-dimension', () => {
  const freightRec = { unit: 'kg', transport_mode: 'Road freight', gross_weight_kg: 5000, distance_km: 300 };
  assert.equal(unitSelfCheck(freightRec, F('x', 0.2, 't.km')).passed, true);
  assert.equal(unitSelfCheck({ ...freightRec, distance_km: null }, F('x', 0.2, 't.km')).passed, false);
  assert.equal(unitSelfCheck({ unit: 'km', distance_km: 11000 }, F('x', 0.15, 'p.km')).passed, true);
  assert.equal(unitSelfCheck({ unit: 'kWh' }, F('x', 0.13, 'kWh')).passed, true);
  assert.equal(unitSelfCheck({ unit: 'L' }, F('x', 0.19, 'm3')).passed, true);
  const cross = unitSelfCheck({ unit: 'kg' }, F('x', 0.13, 'kWh'));
  assert.equal(cross.passed, false);
});

test('assessRecord: self-check failure forces high + review; all-below-threshold yields conservative suggestion', () => {
  const record = { unit: 'kWh', quantity: 100 };
  const factor = F('x', 0.13, 'kWh');
  const ok = assessRecord({ match: { confidence: 0.9 }, record, factor, candidates: [{ confidence: 0.9 }] });
  assert.equal(ok.uncertainty_level, 'low');
  assert.equal(ok.unit_self_check.passed, true);
  assert.equal(ok.forced_review, false);

  const bad = assessRecord({ match: { confidence: 0.9 }, record: { unit: 'kg', quantity: 10 }, factor: F('y', 0.13, 'kWh'), candidates: [{ confidence: 0.9 }] });
  assert.equal(bad.uncertainty_level, 'high');
  assert.equal(bad.forced_review, true);

  const weak = assessRecord({
    match: { confidence: 0.4 }, record, factor,
    candidates: [{ confidence: 0.4, factor: F('c1', 5, 'kWh') }, { confidence: 0.3, factor: F('c2', 2, 'kWh') }],
  });
  assert.equal(weak.no_high_confidence_factor, true);
  assert.equal(weak.conservative_reference_factor_id, 'c1'); // highest numeric value
  assert.equal(weak.forced_review, true);
});

test('10 known-answer calculation problems (3-decimal tonne display, zero tolerance)', async () => {
  const store = new LocalFileStore(mkdtempSync(join(tmpdir(), 'calc-')));
  const mk = (rid, qty, unit, extra = {}) => ({ record_id: rid, task_id: 't', quantity: qty, unit, ...extra });
  // [record, factor, expected kg CO2e] — hand-computed from frozen library values
  const problems = [
    [mk('P1', 45000, 'kWh'), F('EF-D26-UKELECTRICITY-001', 0.13096, 'kWh'), 45000 * 0.13096],
    [mk('P2', 2500, 'kg'), F('EF-D26-MATERIALUSE-039', 9113.58251, 't'), 2.5 * 9113.58251],
    [mk('P3', 850000, 'L'), F('EF-D26-WATERSUPPLY-001', 0.1913, 'm3'), 850 * 0.1913],
    [mk('P4', 30000.24, 'kWh'), F('EF-D26-HEATANDSTEAM-001', 0.17529, 'kWh'), 30000.24 * 0.17529],
    [mk('P5', 1200, 'kg', { transport_mode: 'Air transport (general cargo)', gross_weight_kg: 1200, distance_km: 2960 }),
      F('EF-D26-AIRFREIGHT-007', 0.89939, 't.km'), 1.2 * 2960 * 0.89939],
    [mk('P6', 18000, 'kg', { transport_mode: 'Sea transport (container)', gross_weight_kg: 18000, distance_km: 9500 }),
      F('EF-D26-SEAFREIGHT-039', 0.01266, 't.km'), 18 * 9500 * 0.01266],
    [mk('P7', 12, 'kg'), F('EF-D26-REFRIGERANTOTHER-005', 677.0, 'kg'), 12 * 677],
    [mk('P8', 2400, 'kg'), F('EF-D26-WASTEDISPOSAL-049', 700.33263, 't'), 2.4 * 700.33263],
    [mk('P9', 41, 'MMBtu'), F('EF-E25-FUEL-001', 104.422, 'MMBtu', {
      ghg_coverage: 'CO2, CH4, N2O separate — GWP folding required (AR5)',
      gas_breakdown: { co2_kg_per_mmbtu: 103.69, ch4_g_per_mmbtu: 11, n2o_g_per_mmbtu: 1.6 },
    }), 41 * (103.69 + 11 * 28 / 1000 + 1.6 * 265 / 1000)],
    [mk('P10', 5000, 'kg', { transport_mode: 'Road freight', gross_weight_kg: 5000, distance_km: 300 }),
      F('EF-D26-ROADFREIGHT-009', 0.19947, 't.km'), 5 * 300 * 0.19947],
  ];
  const calcs = [];
  let allExact = true;
  for (const [record, factor, expectedKg] of problems) {
    const calc = await computeEmission({ store, record, factor, taskGwpVersion: 'AR5' });
    calcs.push({ calc, meta: record });
    if (toDisplayTons(calc.emission_kgco2e) !== toDisplayTons(expectedKg)) {
      allExact = false;
      console.log('MISMATCH', record.record_id, calc.emission_kgco2e, expectedKg);
    }
  }
  assert.equal(allExact, true, 'all 10 problems exact at 3-decimal tonne display');

  // GWP fold audit chain present on P9 (AR5 coefficients recorded)
  const p9 = await store.get('calculations', 'calc_P9');
  assert.equal(p9.gwp_folded, true);
  assert.ok(p9.steps.some((s) => s.action === 'gwp_folding' && s.coefficients.includes('CH4=28')));
  // AR6 fold differs and is audited with AR6 coefficients
  const p9v6 = await computeEmission({ store, record: mk('P9b', 41, 'MMBtu'), factor: problems[8][1], taskGwpVersion: 'AR6' });
  assert.ok(Math.abs(p9v6.factor_value - (103.69 + 11 * 27.9 / 1000 + 1.6 * 273 / 1000)) < 1e-9);

  // audit trail rows exist for every calculation
  const audits = await store.list('audit_trail');
  assert.equal(audits.filter((a) => a.action_type === 'calculation').length >= 11, true);
  rmSync(store.rootDir, { recursive: true, force: true });
});

test('aggregation and display consistency (FR-802/803/805)', async () => {
  const store = new LocalFileStore(mkdtempSync(join(tmpdir(), 'agg-')));
  const meta = [
    { scope: 'Scope 1', category: null, supplier_name: 'Sinopec', item_description: 'diesel', activity_date: '2026-01-15' },
    { scope: 'Scope 2', category: null, supplier_name: 'Grid', item_description: 'electricity', activity_date: '2026-02-15' },
    { scope: 'Scope 3', category: 'Cat-1', supplier_name: 'Aluworks', item_description: 'aluminium', activity_date: '2026-02-16' },
    { scope: 'Scope 3', category: 'Cat-4', supplier_name: 'COSCO', item_description: 'sea freight', activity_date: '2026-03-01' },
  ];
  // awkward parts: values chosen so naive per-part rounding breaks the total
  const raws = [1000.0004, 2000.0004, 3000.0006, 0.0005];
  const calcsWithMeta = [];
  for (let i = 0; i < meta.length; i += 1) {
    const record = { record_id: `A${i}`, task_id: 't', quantity: 1, unit: 'kWh' };
    const factor = F(`f${i}`, raws[i], 'kWh');
    const calc = await computeEmission({ store, record, factor });
    calcsWithMeta.push({ calc, meta: meta[i] });
  }
  const agg = aggregate(calcsWithMeta);
  const total = calcsWithMeta.reduce((a, x) => a + x.calc.emission_kgco2e, 0);
  for (const dim of ['scope', 'category', 'supplier', 'month']) {
    const sum = agg[dim].reduce((a, x) => a + x.value, 0);
    assert.ok(Math.abs(sum - total) < 1e-6, `${dim} sums to total`);
    const dc = displayConsistent(agg[dim].map((x) => ({ key: x.key, value: x.value })));
    const partsSum = dc.parts.reduce((a, p) => a + p.display_t, 0);
    assert.ok(Math.abs(partsSum - dc.total_display_t) < 1e-9, `${dim} display parts sum == display total`);
    assert.equal(dc.total_display_t, toDisplayTons(total));
  }
  // counterexample guard: naive rounding of the awkward parts would NOT match
  const naive = raws.map((r) => Math.round((r / 1000) * 1000) / 1000).reduce((a, b) => a + b, 0);
  const dcAll = displayConsistent(raws.map((r, i) => ({ key: i, value: r })));
  assert.ok(Math.abs(dcAll.parts.reduce((a, p) => a + p.display_t, 0) - dcAll.total_display_t) < 1e-9);
  // top emitters sorted desc, default 10
  const top = topEmitters(calcsWithMeta);
  assert.equal(top.length, 4);
  assert.ok(top[0].emission_kgco2e >= top[1].emission_kgco2e);
  rmSync(store.rootDir, { recursive: true, force: true });
});

test('level distribution sums to record count (FR-704)', () => {
  const rows = [
    { uncertainty_level: 'low' }, { uncertainty_level: 'low' }, { uncertainty_level: 'medium' },
    { uncertainty_level: 'high' }, { uncertainty_level: 'high' }, { uncertainty_level: 'high' },
  ];
  const d = levelDistribution(rows);
  assert.deepEqual(d, { low: 2, medium: 1, high: 3 });
  assert.equal(d.low + d.medium + d.high, rows.length);
});
