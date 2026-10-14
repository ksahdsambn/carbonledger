// Report generator (T-033, PRD 4.10): strict ten-chapter English report with
// citation anchors on every numeric conclusion, invalid-anchor-proof
// references (AI-201/202), cross-GWP-version disclosure, excluded-records
// list, factor-year distribution. Narratives use the Pro model in real mode
// and structured deterministic templates otherwise (adapter recorded).
import { mode } from '../ai/client.js';
import { log } from '../logging.js';
import { AppError } from '../errors.js';
import { toDisplayTons, displayConsistent, aggregate, topEmitters } from './calculation.js';
import { SCOPE3_CATEGORIES } from './pipelineModelCalls.js';
import { computeScenarios } from './scenarios.js';
import { listFactors } from './factorLibrary.js';

const TRACK = 'Sustainability & Social Impact';

function t3(kg) { return Math.round((kg / 1000) * 1000) / 1000; }

/** Narrative hook — Pro model in real mode; deterministic templates otherwise. */
async function buildNarratives(ctx) {
  if (mode() === 'real') {
    const { callModel } = await import('../ai/client.js');
    const { getConfig } = await import('../config.js');
    try {
      const { result } = await callModel({
      taskId: ctx.taskId, stage: 'report_narrative', model: getConfig().values.REASONING_MODEL,
      parts: [{ text: `Write report narrative sections as JSON per the schema, professional English. HARD REQUIREMENTS: exactly 3 items in "recommendations", each at least 40 words; at least 3 items in "improvement_recommendations"; "data_quality" at least 30 words. Reference the concrete numbers in the context.\nContext: ${JSON.stringify(ctx.summaries)}` }],
      schema: {
        type: 'object',
        properties: {
          recommendations: { type: 'array', items: { type: 'string' } },
          data_quality: { type: 'string' },
          improvement_recommendations: { type: 'array', items: { type: 'string' } },
        },
        required: ['recommendations', 'data_quality', 'improvement_recommendations'],
      },
      validator: (r) => {
        if (r.recommendations?.length !== 3) throw new Error('exactly 3 recommendations required');
        for (const x of r.recommendations) if (String(x).split(/\s+/).length < 30) throw new Error('recommendation < 30 words');
        if (r.improvement_recommendations?.length < 3) throw new Error('>= 3 improvement recommendations');
      },
      traceStore: ctx.store,
      mockFn: () => templateNarratives(ctx),
    });
    return { ...result, adapter: 'real' };
    } catch (err) {
      // The report must never be lost to one flaky narrative call: the
      // deterministic templates carry the same required content and the
      // fallback is recorded in the report's adapter field for audit.
      log.warn('report_narrative_fallback', { task_id: ctx.taskId, error: String(err.message).slice(0, 200) });
      return { ...templateNarratives(ctx), adapter: 'template_fallback' };
    }
  }
  return { ...templateNarratives(ctx), adapter: mode() };
}

function templateNarratives(ctx) {
  const top = ctx.top.slice(0, 3).map((x) => x.description).join('; ') || 'no single dominant source';
  const recommendations = [
    `Prioritize the largest emission sources first: ${top} together account for the majority of the reported footprint, so procurement and logistics actions concentrated there deliver the fastest reductions per unit of effort.`,
    `Adopt supplier-specific data collection for the top suppliers identified in chapter four, replacing industry-average factors progressively; each replaced factor lowers the uncertainty level of its records and improves audit readiness.`,
    `Institutionalize quarterly re-runs of this accounting pipeline so that new documents flow into the same traceable ledger, keeping the report current and allowing reduction progress to be verified against the baseline produced today.`,
  ];
  const data_quality = ctx.crossGwp.count > 0
    ? `Data quality is moderate: ${ctx.crossGwp.count} of ${ctx.recordCount} records (${ctx.crossGwp.pct}%) use factors from a GWP version different from the task setting and are flagged accordingly.`
    : `Data quality is solid: no record required a cross-GWP-version factor; all selections respect the task-level ${ctx.gwp} setting.`;
  const improvement_recommendations = [
    'Request primary activity data and factor references from the three largest suppliers to replace average factors.',
    'Standardize document formats with recurring logistics providers so extraction confidence rises above the low band.',
    'Complete the missing required fields currently parked in the review queue, which are excluded from totals until resolved.',
  ];
  return { recommendations, data_quality, improvement_recommendations };
}

export async function assembleReport({ store, taskId, task, records, calcs, calcsWithMeta, agg, top, scenarios, factorsById }) {
  const totalKg = calcs.reduce((a, c) => a + c.emission_kgco2e, 0);
  const factorsUsed = [...new Set(calcs.map((c) => c.factor_id))];
  const factorDocs = factorsUsed.map((id) => factorsById[id] ?? null).filter(Boolean);
  const yearDist = {};
  for (const f of factorDocs) yearDist[f.data_year] = (yearDist[f.data_year] || 0) + 1;
  const crossGwpRecords = records.filter((r) => r.cross_gwp_version || (calcs.find((c) => c.activity_record_id === r.record_id) && factorsById[calcs.find((c) => c.activity_record_id === r.record_id).factor_id]?.gwp_version !== task.gwp_version));
  const levelDist = { low: 0, medium: 0, high: 0 };
  for (const r of records) levelDist[r.uncertainty_level ?? 'medium'] += 1;
  const excluded = records.filter((r) => r.excluded_from_calc).map((r) => ({ record_id: r.record_id, reason: r.excluded_from_calc, description: r.item_description }));
  const scopeMap = Object.fromEntries(agg.scope.map((x) => [x.key, x.value]));
  const catMap = Object.fromEntries(agg.category.map((x) => [x.key, x.value]));
  const supplierDisplay = displayConsistent(agg.supplier.map((x) => ({ key: x.key, value: x.value })));
  const scopeDisplay = displayConsistent(agg.scope.map((x) => ({ key: x.key, value: x.value })));

  const numeric = [];
  const anchor = (valueKg, refType, refId, locator, context) => numeric.push({
    value_t: t3(valueKg), ref_type: refType, ref_id: refId, locator: locator ?? null, context,
  });
  anchor(totalKg, 'calculation-set', taskId, null, 'Total emissions');
  // s.value is already kg; anchor() converts kg -> t exactly once (D-10).
  for (const s of scopeDisplay.parts) anchor(s.value, 'aggregation', taskId, s.key, `Scope breakdown: ${s.key}`);
  for (const m of calcsWithMeta) anchor(m.calc.emission_kgco2e, 'record', m.meta.record_id, m.meta.source_ref, `Record ${m.meta.record_id}: ${m.meta.item_description}`);
  for (const s of scenarios.scenarios) anchor(s.reduction_kgco2e, 'scenario', `${taskId}_${s.scenario_id}`, null, `${s.scenario_id} reduction`);

  const narratives = await buildNarratives({
    store, taskId, summaries: { total_t: t3(totalKg), top: top.slice(0, 3), scopes: agg.scope },
    crossGwp: { count: crossGwpRecords.length, pct: `${((crossGwpRecords.length / Math.max(records.length, 1)) * 100).toFixed(1)}%` },
    recordCount: records.length, gwp: task.gwp_version, top,
  });

  const chapters = [
    {
      no: 1, title: 'Cover',
      blocks: [
        { type: 'kv', rows: [
          ['Reporting entity', task.entity_name], ['Reporting period', `${task.period_from} to ${task.period_to}`],
          ['Generated on', new Date().toISOString().slice(0, 10)],
          ['GWP version', `${task.gwp_version} (100-year global warming potentials; see chapter 3)`],
          ['Track', TRACK],
          ['Factor year distribution', Object.entries(yearDist).map(([y, n]) => `${y}: ${n} factors used`).join(', ')],
          ['Disclaimer', 'See chapter 10'],
        ] },
      ],
    },
    {
      no: 2, title: 'Executive summary',
      blocks: [
        { type: 'text', text: `Total emissions for the reporting period amount to ${t3(totalKg)} t CO2e.` },
        { type: 'table', header: ['Scope', 't CO2e', 'Share'], rows: scopeDisplay.parts.map((s) => [s.key, s.display_t, `${((s.value / (totalKg || 1)) * 100).toFixed(1)}%`]) },
        { type: 'table', header: ['Top emission source', 't CO2e'], rows: top.slice(0, 3).map((x) => [x.description, t3(x.emission_kgco2e)]) },
        { type: 'list', items: narratives.recommendations },
      ],
    },
    {
      no: 3, title: 'Accounting method and boundary',
      blocks: [
        { type: 'text', text: 'This report follows the GHG Protocol Corporate Value Chain (Scope 3) Accounting and Reporting Standard in conjunction with the Corporate Standard. Organizational boundary: operational control. Operational boundary: Scope 1 direct, Scope 2 purchased energy, and Scope 3 value-chain categories as identified per record.' },
        { type: 'text', text: `GWP version: ${task.gwp_version}, sourced from IPCC assessment report 100-year values. Cross-GWP-version factor usage: ${crossGwpRecords.length} of ${records.length} records (${((crossGwpRecords.length / Math.max(records.length, 1)) * 100).toFixed(1)}%)${crossGwpRecords.length === 0 ? ' — zero records required a factor from the other GWP version' : ' (each flagged in the interface and downgraded to at least medium uncertainty)'}.` },
        { type: 'table', header: ['Factor data year', 'Factors used'], rows: Object.entries(yearDist).map(([y, n]) => [y, n]) },
        { type: 'text', text: `Data quality overall assessment: ${narratives.data_quality}` },
      ],
    },
    {
      no: 4, title: 'Emissions breakdown',
      blocks: [
        { type: 'table', header: ['Scope', 't CO2e'], rows: scopeDisplay.parts.map((s) => [s.key, s.display_t]) },
        { type: 'table', header: ['Scope 3 category', 't CO2e'], rows: SCOPE3_CATEGORIES.map(([id, name]) => [`${id} ${name}`, t3(catMap[id] ?? 0)]) },
        { type: 'table', header: ['Supplier (top 10)', 't CO2e'], rows: supplierDisplay.parts.slice(0, 10).map((s) => [s.key, s.display_t]) },
      ],
    },
    {
      no: 5, title: 'Activity data detail',
      blocks: [
        { type: 'table', header: ['Source', 'Description', 'Quantity', 'Factor', 't CO2e', 'Uncertainty'], rows: records.map((r) => [
          r.source_ref, r.item_description,
          r.quantity != null ? `${r.quantity} ${r.unit ?? ''}` : '(not included)',
          calcs.find((c) => c.activity_record_id === r.record_id)?.factor_id ?? '—',
          (() => { const c = calcs.find((x) => x.activity_record_id === r.record_id); return c ? t3(c.emission_kgco2e) : '0'; })(),
          (r.uncertainty_level ?? 'medium') + (r.excluded_from_calc ? ' (excluded)' : ''),
        ]) },
      ],
    },
    {
      no: 6, title: 'Uncertainty statement',
      blocks: [
        { type: 'table', header: ['Level', 'Records'], rows: Object.entries(levelDist).map(([k, v]) => [k, v]) },
        { type: 'text', text: 'Main uncertainty sources: document extraction confidence on scanned or handwritten pages, industry-average factors rather than supplier-specific data, and unit conversions between document and factor calibers.' },
        { type: 'list', items: narratives.improvement_recommendations },
      ],
    },
    {
      no: 7, title: 'Reduction scenario advice',
      blocks: scenarios.scenarios.flatMap((s) => [
        { type: 'table', header: ['Scenario', 'Reduction t CO2e', 'Reduction %'], rows: [[s.name, t3(s.reduction_kgco2e), `${s.reduction_pct.toFixed(2)}%`]] },
        { type: 'text', text: s.feasibility_text },
      ]),
    },
    {
      no: 8, title: 'Appendix I — Emission factors used',
      blocks: [
        { type: 'table', header: ['ID', 'Name', 'Value', 'Unit', 'Year', 'Source'], rows: factorDocs.map((f) => [f.factor_id, f.name, f.value, `${f.emission_unit}/${f.activity_unit}`, f.data_year, f.source_name]) },
      ],
    },
    {
      no: 9, title: 'Appendix II — Citation index',
      blocks: [
        { type: 'table', header: ['Data point', 't CO2e', 'Reference'], rows: numeric.map((n) => [n.context, n.value_t, `${n.ref_type}:${n.ref_id}${n.locator ? ` (${n.locator})` : ''}`]) },
      ],
    },
    {
      no: 10, title: 'Disclaimer',
      blocks: [
        { type: 'text', text: 'This tool output does not constitute an audit opinion or legal advice. Users are advised to perform their own verification before external disclosure.' },
        ...(excluded.length ? [{ type: 'table', header: ['Excluded record', 'Description', 'Reason'], rows: excluded.map((e) => [e.record_id, e.description, e.reason]) }] : [{ type: 'table', header: ['Excluded record', 'Description', 'Reason'], rows: [] }]),
      ],
    },
  ];

  const report = {
    // One deterministic report document per task: a second assembly replaces the
    // previous report instead of leaving two of them for latestReport() to pick
    // between (T-050 defect report).
    report_id: `rep_${taskId}`,
    task_id: taskId,
    generated_at: new Date().toISOString(),
    narrative_adapter: narratives.adapter,
    chapters,
    numeric_conclusions: numeric,
    meta: {
      entity: task.entity_name, period: { from: task.period_from, to: task.period_to },
      gwp_version: task.gwp_version, track: TRACK,
      total_kgco2e: totalKg, total_t: t3(totalKg),
      cross_gwp_count: crossGwpRecords.length,
      cross_gwp_pct: (crossGwpRecords.length / Math.max(records.length, 1)) * 100,
      factor_year_distribution: yearDist, level_distribution: levelDist,
      excluded, factors_used: factorsUsed,
    },
  };
  await store.put('reports', report.report_id, {
    ...report, export_paths: {},
  });
  return report;
}

/**
 * Assembles and persists a fresh report from the task's persisted records and
 * calculations. Used when no report exists yet, and after every review action
 * so the report always reflects the current ledger (FR-706, FR-1102).
 */
export async function generateReportForTask({ store, taskId }) {
  const task = await store.get('tasks', taskId);
  if (!task) throw new AppError('ERR_TASK_NOT_FOUND', { task_id: taskId });
  const records = await store.query('activity_records', 'task_id', taskId);
  if (records.length === 0) throw new AppError('ERR_TASK_NOT_FOUND', { hint: 'no report can be generated yet' });
  const calcsWithMeta = [];
  for (const r of records) {
    if (r.excluded_from_calc) continue;
    const calc = await store.get('calculations', `calc_${r.record_id}`);
    if (calc) calcsWithMeta.push({ calc, meta: r });
  }
  const factorsById = Object.fromEntries((await listFactors(store)).map((f) => [f.factor_id, f]));
  const agg = aggregate(calcsWithMeta);
  const top = topEmitters(calcsWithMeta);
  const scenarioOut = await computeScenarios({
    store, taskId, records: records.filter((r) => !r.excluded_from_calc),
    calcs: calcsWithMeta.map((x) => x.calc), factorsById, taskGwpVersion: task.gwp_version,
  });
  return assembleReport({
    store, taskId, task, records, calcs: calcsWithMeta.map((x) => x.calc),
    calcsWithMeta, agg, top, scenarios: scenarioOut, factorsById,
  });
}

/** AI-201/AI-202 checks: coverage and validity of numeric-conclusion anchors. */
export async function scanReportCitations(store, report) {
  // Anchors are resolved inside the report's own task: a record id that exists
  // only in another task is a dangling reference, not a valid anchor (AI-202).
  const taskId = report.task_id;
  const ownRecords = taskId
    ? await store.query('activity_records', 'task_id', taskId)
    : await store.list('activity_records');
  const records = new Set(ownRecords.map((r) => r.record_id));
  const factors = new Set((await listFactors(store)).map((f) => f.factor_id));
  const ownScenarios = taskId ? await store.query('scenarios', 'task_id', taskId) : await store.list('scenarios');
  const scenarios = new Set(ownScenarios.map((s) => s.id));
  let covered = 0;
  const invalid = [];
  for (const n of report.numeric_conclusions) {
    const hasAnchor = Boolean(n.ref_id);
    if (!hasAnchor) { invalid.push({ context: n.context, reason: 'missing anchor' }); continue; }
    let ok = false;
    if (n.ref_type === 'record') ok = records.has(n.ref_id);
    else if (n.ref_type === 'factor') ok = factors.has(n.ref_id);
    else if (n.ref_type === 'scenario') ok = scenarios.has(n.ref_id); // existence-checked only (D-19)
    else if (n.ref_type === 'calculation-set' || n.ref_type === 'aggregation') ok = Boolean(n.ref_id);
    if (!ok) { invalid.push({ context: n.context, ref: `${n.ref_type}:${n.ref_id}`, reason: 'dangling reference' }); continue; }
    covered += 1;
  }
  return {
    total: report.numeric_conclusions.length,
    covered,
    coverage_pct: report.numeric_conclusions.length ? (covered / report.numeric_conclusions.length) * 100 : 100,
    invalid_count: invalid.length,
    invalid,
  };
}
