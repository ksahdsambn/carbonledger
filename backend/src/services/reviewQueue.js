// Review queue service (T-036, PRD 4.11): sorted queue, field edits with
// recalculation, manual factor assignment ("manually assigned"), exclusion
// with English reason, audited operator+timestamp actions, batch recalc.
import { aggregate, topEmitters } from './calculation.js';
import { levelDistribution } from './uncertainty.js';

const LEVEL_ORDER = { high: 0, medium: 1, low: 2 };

/** Opens review items for records that force review (high uncertainty etc.). */
export async function openReviewForTask({ store, taskId, records }) {
  for (const r of records) {
    const shouldOpen = r.uncertainty_level === 'high' || r.no_high_confidence_factor || r.recall_insufficient || r.suspected_duplicate || r.needs_manual_confirmation;
    const existing = await store.query('review_items', 'record_id', r.record_id);
    if (shouldOpen && existing.length === 0) {
      await store.put('review_items', `rev_${r.record_id}`, {
        task_id: taskId,
        record_id: r.record_id,
        uncertainty_level: r.uncertainty_level ?? 'medium',
        status: 'open',
        reason: [
          r.uncertainty_level === 'high' && 'high uncertainty',
          r.no_high_confidence_factor && 'no high-confidence factor',
          r.recall_insufficient && 'insufficient recall',
          r.suspected_duplicate && 'suspected duplicate',
        ].filter(Boolean).join('; '),
        handled_by: null, handled_at: null, note: null,
        created_at: new Date().toISOString(),
      });
    } else if (!shouldOpen && existing.length > 0 && existing[0].status === 'open') {
      await store.delete('review_items', existing[0].id);
    }
  }
}

/** FR-1101: queue sorted high -> medium -> low, newest first within level. */
export async function listReviewQueue(store, taskId) {
  const items = (await store.query('review_items', 'task_id', taskId)).filter((i) => i.status !== 'closed');
  const records = new Map((await store.query('activity_records', 'task_id', taskId)).map((r) => [r.record_id, r]));
  return items
    .map((i) => ({ ...i, record: records.get(i.record_id) ?? null }))
    .sort((a, b) => (LEVEL_ORDER[a.uncertainty_level] ?? 9) - (LEVEL_ORDER[b.uncertainty_level] ?? 9)
      || String(a.created_at).localeCompare(String(b.created_at)));
}

async function audit(store, taskId, recordId, action, details) {
  await store.put('audit_trail', `aud_rev_${recordId}_${Date.now()}`, {
    task_id: taskId,
    action_type: action,
    actor: 'reviewer', // operator identity from the authenticated session
    object_id: recordId,
    details,
    ts: new Date().toISOString(),
  });
}

/** FR-1102: edit the four editable fields + fill missing required fields. */
export async function editRecordFields({ store, taskId, recordId, patch, operator = 'reviewer' }) {
  const record = await store.get('activity_records', recordId);
  if (!record || record.task_id !== taskId) throw new Error('record not found');
  const allowed = ['quantity', 'unit', 'transport_mode', 'origin_location', 'destination_location', 'activity_date', 'amount', 'currency'];
  const applied = {};
  for (const [k, v] of Object.entries(patch)) {
    if (!allowed.includes(k)) continue;
    if (v !== undefined && v !== null && v !== '') {
      record[k] = v;
      applied[k] = v;
    } else if (record[k] != null && ['', null].includes(v)) {
      record[k] = null;
      applied[k] = null;
    }
  }
  await store.put('activity_records', recordId, record);
  await audit(store, taskId, recordId, 'review_edit', { operator, applied });
  return record;
}

/** FR-1103: manual factor assignment outranks the automatic match. */
export async function assignFactorManually({ store, taskId, recordId, factorId, operator = 'reviewer' }) {
  const factor = await store.get('emission_factors', factorId);
  if (!factor) throw new Error(`factor ${factorId} not found`);
  const record = await store.get('activity_records', recordId);
  if (!record) throw new Error('record not found');
  const matchId = record.match_id ?? `match_${recordId}`;
  await store.put('matches', matchId, {
    task_id: taskId, activity_record_id: recordId,
    selected_factor_id: factorId, runner_up_factor_id: null,
    confidence: 1.0,
    rationale: 'Manually assigned by reviewer; takes precedence over the automatic match.',
    key_semantic_features: [], gwp_version_consistent: factor.gwp_version === (await store.get('tasks', taskId))?.gwp_version,
    manually_assigned: true, candidate_ids: [factorId],
    created_at: new Date().toISOString(),
  });
  record.match_id = matchId;
  await store.put('activity_records', recordId, record);
  await audit(store, taskId, recordId, 'review_factor_assignment', { operator, factor_id: factorId });
  return record;
}

/** FR-1104: exclude a record from accounting with an English reason. */
export async function excludeRecord({ store, taskId, recordId, reason, operator = 'reviewer' }) {
  if (!reason || String(reason).trim().length < 5) throw new Error('an English exclusion reason is required');
  const record = await store.get('activity_records', recordId);
  if (!record) throw new Error('record not found');
  record.excluded_from_calc = String(reason);
  await store.put('activity_records', recordId, record);
  await audit(store, taskId, recordId, 'review_exclusion', { operator, reason });
  return record;
}

export async function closeReviewItem({ store, taskId, recordId, note, operator = 'reviewer' }) {
  const items = await store.query('review_items', 'record_id', recordId);
  for (const item of items) {
    if (item.task_id !== taskId) continue;
    await store.put('review_items', item.id, { ...item, status: 'closed', handled_by: operator, handled_at: new Date().toISOString(), note: note ?? null });
  }
  await audit(store, taskId, recordId, 'review_closed', { operator });
}

/** Recomputes all calculations and aggregates for a task (FR-706, FR-1102). */
export async function recalculateTask({ store, taskId }) {
  const { computeEmission } = await import('./calculation.js');
  const task = await store.get('tasks', taskId);
  const records = (await store.query('activity_records', 'task_id', taskId)).filter((r) => !r.excluded_from_calc);
  const calcs = [];
  for (const r of records) {
    const match = await store.get('matches', r.match_id ?? `match_${r.record_id}`);
    if (!match) continue;
    const factor = await store.get('emission_factors', match.selected_factor_id);
    if (!factor || r.quantity == null) continue;
    calcs.push(await computeEmission({ store, record: r, factor, taskGwpVersion: task?.gwp_version ?? 'AR6' }));
  }
  const calcsWithMeta = calcs.map((c) => ({ calc: c, meta: records.find((r) => r.record_id === c.activity_record_id) ?? {} }));
  const agg = aggregate(calcsWithMeta);
  const top = topEmitters(calcsWithMeta);
  const distribution = levelDistribution(records);
  return { records, calcs, agg, top, distribution, total_kgco2e: calcs.reduce((a, c) => a + c.emission_kgco2e, 0) };
}
