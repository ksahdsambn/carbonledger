// Reduction scenario engine (T-031, PRD 4.9): S-1 mode shift, S-2 supplier
// swap, S-3 material substitution. Deterministic numerical core; feasibility
// narratives are structured English templates (>80 words, assumptions and
// limitations derived from the actual replacement data) — the Pro-model
// narrative path activates with credentials without changing the numbers.
import { computeEmission } from './calculation.js';
import { unitSelfCheck } from './uncertainty.js';

function familyOf(factorName) {
  // "Materials — Metal / Metal: aluminium cans and foil …" -> "materials-metal"
  const first = factorName.split(' — ')[1]?.split(' / ')[0] ?? '';
  return first.toLowerCase().trim();
}

async function rerunWithFactor({ store, record, factor, taskGwpVersion }) {
  // persist:false — scenario numbers are computed, never recorded (D-05).
  const calc = await computeEmission({ store, record, factor, taskGwpVersion, persist: false });
  return calc.emission_kgco2e;
}

function unitCompatible(record, factor) {
  return unitSelfCheck(record, factor).passed;
}

function feasibilityTemplate(name, body) {
  return `${name}: ${body} Assumptions: the replacement factors come from the same public 2026 UK Government conversion factor set and cover equivalent service levels; activity volumes are held constant; the replacement ratio can be tuned between 0% and 100% and only the replaced share is recomputed. Limitations: actual feasibility depends on route schedules, service contracts, supplier availability and material specifications that this tool cannot verify; cold-chain and time-critical flows may not tolerate slower modes; factor values are industry averages, so site-specific results will differ; secondary effects such as packaging changes or inventory shifts are out of scope.`;
}

/**
 * @param {object} o
 * @param {Array} o.records activity records (with matches attached: record.matched_factor)
 * @param {Array} o.calcs calculation results indexed by activity_record_id
 * @param {object} o.factorsById library lookup
 */
export async function computeScenarios({ store, taskId, records, calcs, factorsById, taskGwpVersion = 'AR6', ratio = 1.0 }) {
  const calcOf = new Map(calcs.map((c) => [c.activity_record_id, c]));
  const baseline = calcs.reduce((a, c) => a + c.emission_kgco2e, 0);
  const scenarios = [];

  // ---------- S-1 transport mode shift ----------
  {
    const sea = factorsById['EF-D26-SEAFREIGHT-039']; // container 8000+ TEU
    const rail = factorsById['EF-D26-ROADFREIGHT-026'] ?? null; // rail freight train
    const railFactor = Object.values(factorsById).find(
      (f) => f.activity_type === 'freight_transport' && /Rail \/ Freight train — Diesel/.test(f.name),
    ) ?? rail;
    const affected = [];
    const reasons = [];
    for (const r of records) {
      const mode = r.transport_mode;
      if (!mode || mode === 'Not applicable') continue;
      let alt = null;
      if (mode.startsWith('Air transport') || mode === 'International express') alt = sea;
      else if (mode === 'Road freight') alt = railFactor;
      if (!alt) continue;
      const orig = calcOf.get(r.record_id)?.emission_kgco2e;
      if (orig == null) continue;
      const origFactor = factorsById[calcOf.get(r.record_id).factor_id];
      const newValue = await rerunWithFactor({ store, record: r, factor: alt, taskGwpVersion });
      affected.push({
        record_id: r.record_id, mode,
        original_factor_id: origFactor?.factor_id ?? null,
        alternative_factor_id: alt.factor_id,
        original_kgco2e: orig, alternative_kgco2e: newValue,
      });
    }
    const reduction = affected.reduce((a, x) => a + (x.original_kgco2e - x.alternative_kgco2e) * ratio, 0);
    if (affected.length === 0) reasons.push('No air (general/cold chain), express or road-freight records exist in this task; S-1 therefore affects zero records by design.');
    scenarios.push({
      scenario_id: 'S-1', name: 'Transport mode shift',
      params: { ratio },
      reduction_kgco2e: reduction,
      reduction_pct: baseline > 0 ? (reduction / baseline) * 100 : 0,
      affected,
      unaffected_reasons: reasons,
      feasibility_text: feasibilityTemplate('Transport mode shift',
        `replacing air and express legs with container shipping and road legs with rail for ${affected.length} record(s), cutting ${(reduction / 1000).toFixed(3)} t CO2e (${baseline > 0 ? ((reduction / baseline) * 100).toFixed(2) : '0'}% of the baseline).`),
    });
  }

  // ---------- S-2 supplier swap ----------
  {
    const bySupplier = new Map();
    for (const r of records) {
      const calc = calcOf.get(r.record_id);
      if (!calc) continue;
      const s = r.supplier_name || 'Unspecified';
      bySupplier.set(s, (bySupplier.get(s) ?? 0) + calc.emission_kgco2e);
    }
    const top3 = [...bySupplier.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s]) => s);
    const affected = [];
    const notes = [];
    for (const r of records) {
      if (!top3.includes(r.supplier_name || 'Unspecified')) continue;
      const calc = calcOf.get(r.record_id);
      if (!calc) continue;
      const current = factorsById[calc.factor_id];
      if (!current) continue;
      const sameType = Object.values(factorsById).filter(
        (f) => f.activity_type === current.activity_type && f.factor_id !== current.factor_id && unitCompatible(r, f),
      );
      if (sameType.length === 0) {
        notes.push(`${r.record_id}: no alternative factor in activity category ${current.activity_type}`);
        continue;
      }
      const alt = sameType.reduce((min, f) => (f.value < min.value ? f : min), sameType[0]);
      const newValue = await rerunWithFactor({ store, record: r, factor: alt, taskGwpVersion });
      affected.push({
        record_id: r.record_id, supplier: r.supplier_name ?? 'Unspecified',
        original_factor_id: current.factor_id, alternative_factor_id: alt.factor_id,
        original_kgco2e: calc.emission_kgco2e, alternative_kgco2e: newValue,
      });
    }
    const reduction = affected.reduce((a, x) => a + (x.original_kgco2e - x.alternative_kgco2e) * ratio, 0);
    if (affected.length === 0) notes.push('No swappable records under the top-3 suppliers by emissions.');
    scenarios.push({
      scenario_id: 'S-2', name: 'Supplier swap',
      params: { ratio, top_suppliers: top3 },
      reduction_kgco2e: reduction,
      reduction_pct: baseline > 0 ? (reduction / baseline) * 100 : 0,
      affected,
      unaffected_reasons: notes,
      feasibility_text: feasibilityTemplate('Supplier swap',
        `re-sourcing the activity of the three highest-emission suppliers (${top3.join(', ') || 'none'}) to the lowest-value factor available in the same activity category for ${affected.length} record(s), saving ${(reduction / 1000).toFixed(3)} t CO2e.`),
    });
  }

  // ---------- S-3 material substitution ----------
  {
    const affected = [];
    const notes = [];
    for (const r of records) {
      const calc = calcOf.get(r.record_id);
      if (!calc) continue;
      const current = factorsById[calc.factor_id];
      if (!current || current.activity_type !== 'purchased_goods') continue;
      const fam = familyOf(current.name);
      const alternatives = Object.values(factorsById).filter(
        (f) => f.activity_type === 'purchased_goods' && familyOf(f.name) === fam
          && f.factor_id !== current.factor_id && unitCompatible(r, f),
      );
      if (alternatives.length === 0) {
        notes.push(`${r.record_id}: material family "${fam}" has no alternative factor in the library; record unchanged`);
        continue;
      }
      const alt = alternatives.reduce((min, f) => (f.value < min.value ? f : min), alternatives[0]);
      if (alt.value >= current.value) {
        notes.push(`${r.record_id}: lowest alternative in family "${fam}" is not lower-carbon; record unchanged`);
        continue;
      }
      const newValue = await rerunWithFactor({ store, record: r, factor: alt, taskGwpVersion });
      affected.push({
        record_id: r.record_id,
        original_factor_id: current.factor_id, alternative_factor_id: alt.factor_id,
        original_kgco2e: calc.emission_kgco2e, alternative_kgco2e: newValue,
      });
    }
    const reduction = affected.reduce((a, x) => a + (x.original_kgco2e - x.alternative_kgco2e) * ratio, 0);
    scenarios.push({
      scenario_id: 'S-3', name: 'Material substitution',
      params: { ratio },
      reduction_kgco2e: reduction,
      reduction_pct: baseline > 0 ? (reduction / baseline) * 100 : 0,
      affected,
      unaffected_reasons: notes,
      feasibility_text: feasibilityTemplate('Material substitution',
        `switching high-emission material purchases to the lowest-carbon factor variant available within the same material family for ${affected.length} record(s), abating ${(reduction / 1000).toFixed(3)} t CO2e; records without a lower-carbon in-family alternative are kept unchanged and listed individually.`),
    });
  }

  for (const s of scenarios) {
    await store.put('scenarios', `${taskId}_${s.scenario_id}`, {
      task_id: taskId, ...s,
      reduction_kgco2e_display_t: Math.round((s.reduction_kgco2e / 1000) * 1000) / 1000,
      created_at: new Date().toISOString(),
    });
  }
  return { baseline_kgco2e: baseline, scenarios };
}
