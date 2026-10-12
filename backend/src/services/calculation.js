// Emission calculation and aggregation engine (T-029, PRD 4.8).
// Full float precision throughout; sums computed on unrounded values and
// rounded once for display; tonne CO2e to 3 decimals; GWP folding for
// gas-separated factors written to the audit trail; four-dimension
// aggregation with display-consistent part sums (FR-805).
import { GWP_FACTORS } from './uncertainty.js';

/** Converts the normalized record quantity into the factor's activity basis. */
function activityBasis(record, factor) {
  const ru = record.unit;
  const fu = factor.activity_unit;
  const q = record.quantity;
  if (fu === 't.km') {
    return { value: (record.gross_weight_kg / 1000) * record.distance_km, detail: `${record.gross_weight_kg / 1000} t x ${record.distance_km} km` };
  }
  if (fu === 'p.km') {
    const km = record.distance_km ?? (ru === 'km' ? q : null);
    return { value: km * (record.passengers ?? 1), detail: `${km ?? '?'} km x ${record.passengers ?? 1} passenger` };
  }
  if (ru === fu) return { value: q, detail: `${q} ${fu}` };
  if (ru === 'kWh' && fu.startsWith('kWh (')) {
    return { value: q, detail: `${q} kWh taken on the factor's ${fu} calorific basis` };
  }
  if (ru === 'kg' && fu === 't') return { value: q / 1000, detail: `${q} kg -> ${q / 1000} t` };
  if (ru === 'kWh' && fu === 'MMBtu') return { value: q / 293, detail: `${q} kWh -> ${(q / 293).toFixed(6)} MMBtu` };
  if (ru === 'L' && fu === 'm3') return { value: q / 1000, detail: `${q} L -> ${q / 1000} m3` };
  if (ru === 'L' && fu === 'L') return { value: q, detail: `${q} L` };
  return null; // unbridgeable — the self-check should have flagged this
}

/**
 * Computes one record's emission (kg CO2e) with a complete audit chain.
 * Gas-separated factors (ghg_coverage includes 'folding required') are folded
 * with the task's GWP version and the step is audited (PRD 4.8).
 */
export async function computeEmission({ store, record, factor, taskGwpVersion = 'AR6' }) {
  const steps = [];
  const basis = activityBasis(record, factor);
  if (!basis) throw new Error(`cannot bridge record unit ${record.unit} to factor unit ${factor.activity_unit}`);
  steps.push({ action: 'activity_basis', detail: basis.detail, value: basis.value, unit: factor.activity_unit });

  let factorValue = factor.value;
  let folded = false;
  if (/folding required/i.test(factor.ghg_coverage) && factor.gas_breakdown) {
    const gwp = GWP_FACTORS[taskGwpVersion] ?? GWP_FACTORS.AR6;
    const co2 = factor.gas_breakdown.co2_kg_per_mmbtu ?? 0;
    const ch4 = (factor.gas_breakdown.ch4_g_per_mmbtu ?? 0) / 1000 * gwp.CH4;
    const n2o = (factor.gas_breakdown.n2o_g_per_mmbtu ?? 0) / 1000 * gwp.N2O;
    factorValue = co2 + ch4 + n2o;
    folded = true;
    steps.push({
      action: 'gwp_folding', from: `${co2} kgCO2 + ${factor.gas_breakdown.ch4_g_per_mmbtu} g CH4 + ${factor.gas_breakdown.n2o_g_per_mmbtu} g N2O per MMBtu`,
      coefficients: `GWP ${taskGwpVersion}: CH4=${gwp.CH4}, N2O=${gwp.N2O} (source: IPCC ${taskGwpVersion} 100-year)`,
      to: `${factorValue} kgCO2e per MMBtu`,
    });
  }

  const emissionKg = basis.value * factorValue;
  steps.push({
    action: 'multiplication', formula: `${basis.value} ${factor.activity_unit} x ${factorValue} ${factor.emission_unit}/${factor.activity_unit}`,
    result_kgco2e: emissionKg,
    factor_id: factor.factor_id, factor_value: factorValue, folded,
  });

  const calcId = `calc_${record.record_id}`;
  const calc = {
    task_id: record.task_id ?? null,
    activity_record_id: record.record_id,
    activity_value: basis.value,
    activity_unit: factor.activity_unit,
    factor_id: factor.factor_id,
    factor_value: factorValue,
    emission_kgco2e: emissionKg,
    gwp_folded: folded,
    gwp_version: taskGwpVersion,
    steps,
    ts: new Date().toISOString(),
  };
  await store.put('calculations', calcId, calc);
  await store.put('audit_trail', `aud_${calcId}`, {
    task_id: record.task_id ?? null,
    action_type: 'calculation',
    actor: 'calculation-engine',
    object_id: record.record_id,
    details: { steps },
    ts: new Date().toISOString(),
  });
  return calc;
}

export const toDisplayTons = (kg) => Math.round((kg / 1000) * 1000) / 1000;

/**
 * Display-consistent breakdown (FR-805): parts and total both rendered at
 * 3-decimal tonnes such that the sum of displayed parts equals the displayed
 * total EXACTLY, using largest-remainder adjustment of the displayed parts.
 * Unrounded values are never modified.
 */
export function displayConsistent(parts) {
  const totalKg = parts.reduce((a, p) => a + p.value, 0);
  const totalT = round3(totalKg / 1000);
  const rounded = parts.map((p) => ({ ...p, display_t: round3(p.value / 1000) }));
  let diff = Math.round((totalT - rounded.reduce((a, p) => a + p.display_t, 0)) * 1000);
  if (diff !== 0) {
    const step = diff > 0 ? 1 : -1;
    const order = [...rounded].sort((a, b) => (b.value - b.display_t * 1000) - (a.value - a.display_t * 1000));
    let i = 0;
    while (diff !== 0 && order.length > 0) {
      const target = step > 0
        ? order[i % order.length]
        : [...order].reverse()[i % order.length];
      target.display_t = round3(target.display_t + step * 0.001);
      diff -= step;
      i += 1;
    }
  }
  return { total_display_t: totalT, parts: rounded };
}

const round3 = (x) => Math.round(x * 1000) / 1000;

/** Aggregates calculated records by scope, category, supplier and month. */
export function aggregate(calcsWithMeta) {
  const by = (keyFn) => {
    const map = new Map();
    for (const { calc, meta } of calcsWithMeta) {
      const k = keyFn(meta, calc) ?? 'Unspecified';
      map.set(k, (map.get(k) ?? 0) + calc.emission_kgco2e);
    }
    return [...map.entries()].map(([key, value]) => ({ key, value }));
  };
  const scope = by((m) => m.scope);
  const category = by((m) => (m.scope === 'Scope 3' ? m.category : m.scope));
  const supplier = by((m) => m.supplier_name);
  const month = by((m) => (m.activity_date ?? '').slice(0, 7));
  return { scope, category, supplier, month };
}

/** Top emitters, default 10, descending (FR-803). */
export function topEmitters(calcsWithMeta, n = 10) {
  return calcsWithMeta
    .map(({ calc, meta }) => ({ record_id: calc.activity_record_id, description: meta.item_description, emission_kgco2e: calc.emission_kgco2e }))
    .sort((a, b) => b.emission_kgco2e - a.emission_kgco2e)
    .slice(0, n);
}
