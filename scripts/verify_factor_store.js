#!/usr/bin/env node
// T-007 verification: factor store loading + queries (run from repo root).
// 1) 20 random factor ids resolve with field values equal to the source file.
// 2) Keyword queries (electricity / air freight / steel-related) non-empty.
// 3) Year distribution sums to the total factor count.
import { readFileSync } from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalFileStore } from '../backend/src/store/index.js';
import {
  loadFactorLibrary,
  getFactorById,
  searchFactorsByKeyword,
  factorYearDistribution,
} from '../backend/src/services/factorLibrary.js';

function pick(rng, arr, n) {
  const copy = [...arr];
  const out = [];
  while (out.length < n && copy.length) out.push(copy.splice(Math.floor(rng() * copy.length), 1)[0]);
  return out;
}

const rng = (seed => () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)(20261007);
const dir = mkdtempSync(join(tmpdir(), 't007-'));
const store = new LocalFileStore(dir);
const raw = JSON.parse(readFileSync('data/factors/emission_factors.json', 'utf8'));

const loadRes = await loadFactorLibrary(store);
console.log(`load: total=${loadRes.total} skipped=${loadRes.skipped}`);

let failures = 0;

// 1 — id resolution + field equality for 20 random factors
const sample = pick(rng, raw.factors, 20);
let resolved = 0;
for (const src of sample) {
  const stored = await getFactorById(store, src.factor_id);
  if (!stored) { console.log(`MISSING ${src.factor_id}`); failures += 1; continue; }
  const same = Object.entries(src).every(([k, v]) => JSON.stringify(stored[k]) === JSON.stringify(v));
  if (same) resolved += 1;
  else { console.log(`FIELD MISMATCH ${src.factor_id}`); failures += 1; }
}
console.log(`[1] id_resolution: ${resolved}/20 field-identical`);
if (resolved !== 20) failures += 1;

// 2 — keyword queries non-empty
const probes = [['electricity'], ['air'], ['metal'], ['waste'], ['hotel']];
for (const terms of probes) {
  const hits = await searchFactorsByKeyword(store, terms);
  console.log(`[2] keyword ${JSON.stringify(terms)} -> ${hits.length} hits`);
  if (hits.length === 0) failures += 1;
}

// 3 — year distribution sums to total
const dist = await factorYearDistribution(store);
const sum = Object.values(dist).reduce((a, b) => a + b, 0);
console.log(`[3] year_distribution=${JSON.stringify(dist)} sum=${sum} total=${loadRes.total}`);
if (sum !== loadRes.total) failures += 1;

rmSync(dir, { recursive: true, force: true });
console.log(failures === 0 ? 'RESULT: PASS' : `RESULT: FAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
