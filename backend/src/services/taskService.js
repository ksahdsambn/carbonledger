// Accounting task service — tasks collection per PRD 8.4.
import { randomUUID } from 'node:crypto';
import { AppError } from '../errors.js';

const GWP_VERSIONS = ['AR5', 'AR6'];

const isIsoDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

export async function createTask(store, { entity_name, period_from, period_to, gwp_version, owner_uid }) {
  // Field-level validation (D-34): names must be sane strings and dates must
  // be real ISO dates in order, so reports and exports never see garbage.
  if (typeof entity_name !== 'string' || !entity_name.trim() || entity_name.length > 200
    || !isIsoDate(period_from) || !isIsoDate(period_to) || period_from > period_to
    || !GWP_VERSIONS.includes(gwp_version)) {
    throw new AppError('ERR_ENUM_INVALID', {
      hint: 'entity_name (non-empty string <=200 chars) and period_from/period_to (YYYY-MM-DD, from<=to) are required; gwp_version must be AR5 or AR6',
    });
  }
  const id = `task_${randomUUID().slice(0, 8)}`;
  const task = {
    task_id: id,
    entity_name,
    period_from,
    period_to,
    gwp_version,
    status: 'created',
    created_at: new Date().toISOString(),
    created_by: 'anonymous',
    owner: owner_uid ?? null,
  };
  await store.put('tasks', id, task);
  return task;
}

export async function getTask(store, taskId) {
  const t = await store.get('tasks', taskId);
  if (!t) throw new AppError('ERR_TASK_NOT_FOUND', { task_id: taskId });
  return t;
}
