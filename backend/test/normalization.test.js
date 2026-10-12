// Tests for the normalization engine (T-018): all 10 conversion pairs,
// location normalization, transport-mode enum, currency identification,
// gap list, audit-trail writing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalFileStore } from '../src/store/index.js';
import {
  convertUnit, normalizeLocation, validateTransportMode, identifyCurrency,
  computeGapList, normalizeRecord,
} from '../src/services/normalization.js';

test('all 10 PRD 4.4 conversion pairs are exact', () => {
  const cases = [
    ['t', 'kg', 2.5, 2500], ['lb', 'kg', 5500, 2494.8], ['g', 'kg', 500, 0.5],
    ['MWh', 'kWh', 95, 95000], ['GJ', 'kWh', 108, 30000.24], ['BTU', 'kWh', 41e6, 12013],
    ['m3', 'L', 780.9, 780900], ['gal', 'L', 45000, 170325],
    ['mile', 'km', 350, 563.15], ['nmi', 'km', 100, 185.2],
  ];
  for (const [from, to, q, expected] of cases) {
    const r = convertUnit(q, from);
    assert.ok(r, `${from} convertible`);
    assert.equal(r.unit, to);
    assert.ok(Math.abs(r.quantity - expected) < 1e-9, `${from}: ${r.quantity} != ${expected}`);
  }
  assert.equal(convertUnit(1, 'kg').quantity, 1); // identity
});

test('bilingual locations normalize identically (FR-402)', () => {
  const a = normalizeLocation('香港葵涌码头');
  const b = normalizeLocation('Hong Kong Kwai Chung');
  assert.equal(a, 'HK/Kwai Chung');
  assert.equal(b, 'HK/Kwai Chung');
  assert.equal(a, b);
  assert.equal(normalizeLocation('yan tian, shenzhen'), null); // unknown stays null
  assert.equal(normalizeLocation('GB/london'), 'GB/London'); // already-normalized passthrough
});

test('transport mode closed enum accepts canonical and rejects garbage', () => {
  assert.deepEqual(validateTransportMode('Sea transport (container)'), { ok: true, mode: 'Sea transport (container)' });
  assert.deepEqual(validateTransportMode('road freight'), { ok: true, mode: 'Road freight' });
  assert.equal(validateTransportMode('teleport').ok, false);
  assert.equal(validateTransportMode(null).ok, true);
});

test('currency identification without FX', () => {
  assert.equal(identifyCurrency('Total: USD 12,400.00'), 'USD');
  assert.equal(identifyCurrency('金额：人民币 96,000'), 'CNY');
  assert.equal(identifyCurrency('€ 2,300'), 'EUR');
  assert.equal(identifyCurrency('JPY 4,500'), 'JPY');
  assert.equal(identifyCurrency('HKD 1,750'), 'HKD');
  assert.equal(identifyCurrency('no money here'), null);
});

test('gap list flags missing required fields and normalization writes audit steps', async () => {
  const store = new LocalFileStore(mkdtempSync(join(tmpdir(), 'norm-')));
  const rec = {
    record_id: 'GR-T1', task_id: 't', quantity: 5500, unit: 'lb',
    item_description: 'aluminium foil, $12,400', amount: 12400, currency: null,
    activity_date: null, transport_mode: 'Road freight',
    origin_location: '香港葵涌码头', destination_location: 'Tokyo',
  };
  const { record, steps, gaps } = await normalizeRecord(rec, { store });
  assert.equal(record.unit, 'kg');
  assert.ok(Math.abs(record.quantity - 2494.8) < 1e-9);
  assert.equal(record.origin_location, 'HK/Kwai Chung');
  assert.equal(record.destination_location, 'JP/Tokyo');
  assert.ok(gaps.includes('activity_date'));
  assert.ok(steps.some((s) => s.action === 'unit_conversion'));
  assert.ok(steps.some((s) => s.action === 'location_normalization'));
  const audits = await store.list('audit_trail');
  assert.equal(audits.length, 1);
  assert.equal(audits[0].action_type, 'normalization');
  assert.ok(audits[0].details.steps.length >= 3);
  assert.ok(audits[0].details.gaps.includes('activity_date'));
  rmSync(store.rootDir, { recursive: true, force: true });
});
