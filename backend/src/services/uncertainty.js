// Uncertainty grading rule engine + unit-caliber self-check (T-027, PRD 4.7
// stage 3, 6.4). Pure rules, no model calls — reproducible and auditable.
import { getConfig } from '../config.js';
import { CONVERSIONS, UNIT_DIMENSION } from './normalization.js';

export const GWP_FACTORS = {
  AR5: { CH4: 28, N2O: 265 },
  AR6: { CH4: 27.9, N2O: 273 },
};

/**
 * Grades a match result. Inputs:
 *  - confidence: factor match confidence in [0,1]
 *  - inferredFieldCount: required fields inferred (not directly extracted)
 *  - needsSecondConversion: record unit and factor unit require a cross-unit
 *    conversion beyond the base-table normalization
 * Order per PRD 4.7: check HIGH conditions first, then MEDIUM, else LOW;
 * the most severe hit wins.
 */
export function gradeUncertainty({ confidence, inferredFieldCount = 0, needsSecondConversion = false, selfCheckPassed = true }) {
  const high =
    confidence < 0.65 ||
    inferredFieldCount >= 2 ||
    needsSecondConversion ||
    selfCheckPassed === false;
  if (high) return 'high';
  const medium = (confidence >= 0.65 && confidence < 0.85) || inferredFieldCount === 1;
  if (medium) return 'medium';
  return 'low';
}

/** Unit pairs the engine can bridge when computing the activity basis. */
const BRIDGEABLE = {
  'kg->t': (q) => q / 1000, 't->kg': (q) => q * 1000,
  'kWh->MMBtu': (q) => q / 293, 'MMBtu->kWh': (q) => q * 293,
  'kWh->t': null, // meaningful only via fuel properties — treated as unbridgeable
};

/**
 * Unit-caliber self-check (AI-301): can the selected factor's activity unit
 * be reconciled with the normalized record? Freight factors (t.km) need
 * weight + distance; travel factors (p.km) need a distance; same-dimension
 * units bridge via the base table; cross-dimension pairs fail.
 */
export function unitSelfCheck(record, factor) {
  const fu = factor.activity_unit;
  const ru = record.unit;
  const isFreightRecord = record.transport_mode && record.transport_mode !== 'Not applicable'
    && record.gross_weight_kg != null && record.distance_km != null;

  if (fu === 't.km') {
    const ok = isFreightRecord;
    return { passed: ok, detail: ok
      ? 'freight factor reconciled with gross weight (t) and distance (km)'
      : 'freight factor selected but weight/distance missing for t.km basis' };
  }
  if (fu === 'p.km') {
    const ok = record.distance_km != null || ru === 'km';
    return { passed: ok, detail: ok
      ? 'passenger factor reconciled with travel distance'
      : 'passenger factor selected but no distance available' };
  }
  const bridge = `${ru}->${fu}`;
  if (ru === fu || CONVERSIONS[ru]?.to === fu || CONVERSIONS[fu]?.to === ru) {
    return { passed: true, detail: `record unit ${ru} reconciles with factor unit ${fu}` };
  }
  if (BRIDGEABLE[bridge]) {
    return { passed: true, detail: `bridgeable units ${bridge}` };
  }
  if (UNIT_DIMENSION[fu] === 'energy' && UNIT_DIMENSION[ru] === 'energy') {
    return { passed: true, detail: `same-dimension energy units ${ru} -> ${fu}` };
  }
  return { passed: false, detail: `cannot reconcile record unit ${ru} with factor unit ${fu}` };
}

/**
 * Full grading pipeline for one matched record: self-check, no-high-confidence
 * handling (PRD 3.2), level, and review-queue routing.
 */
export function assessRecord({ match, record, factor, candidates = [] }) {
  const cfg = getConfig().values;
  const selfCheck = factor ? unitSelfCheck(record, factor) : { passed: false, detail: 'no factor selected' };
  const needsSecondConversion = factor ? needsCrossUnitConversion(record, factor) : false;
  const level = gradeUncertainty({
    confidence: match?.confidence ?? 0,
    inferredFieldCount: record.inferred_field_count ?? 0,
    needsSecondConversion,
    selfCheckPassed: selfCheck.passed,
  });

  const allBelowThreshold = candidates.length > 0
    && candidates.every((c) => (c.match_confidence ?? c.confidence ?? 1) < cfg.FACTOR_MATCH_CONFIDENCE_THRESHOLD);
  // Conservative reference when nothing clears the bar (PRD 3.2): suggest the
  // candidate with the highest numeric factor value, never auto-apply it.
  let conservativeReference = null;
  if (allBelowThreshold) {
    conservativeReference = [...candidates]
      .sort((a, b) => ((b.factor?.value ?? b.value) ?? 0) - ((a.factor?.value ?? a.value) ?? 0))[0];
  }
  const forceReview = level === 'high' || allBelowThreshold;
  return {
    uncertainty_level: level,
    unit_self_check: selfCheck,
    no_high_confidence_factor: allBelowThreshold,
    conservative_reference_factor_id: conservativeReference?.factor_id ?? conservativeReference?.factor?.factor_id ?? null,
    forced_review: forceReview,
  };
}

export function needsCrossUnitConversion(record, factor) {
  const ru = record.unit;
  const fu = factor.activity_unit;
  if (ru === fu) return false;
  if (CONVERSIONS[ru]?.to === fu) return false; // base-table normalization already covers
  if (CONVERSIONS[fu]?.to === ru) return true; // e.g. record L, factor m3: extra ÷1000 needed
  return true;
}

/** Three-level distribution for reports (FR-704). */
export function levelDistribution(assessedRecords) {
  const dist = { low: 0, medium: 0, high: 0 };
  for (const r of assessedRecords) dist[r.uncertainty_level] += 1;
  return dist;
}
