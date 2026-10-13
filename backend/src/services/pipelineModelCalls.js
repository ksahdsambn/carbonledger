// Model-backed pipeline services: field extraction (T-016), boundary
// decision (T-023), factor selection (T-025). Structured-output schemas,
// closed-set validation with retry, full trace recording via the unified
// wrapper. Mock adapters make the pipeline runnable offline for development;
// accuracy metrics are only ever computed from real-adapter runs.
import { randomUUID } from 'node:crypto';
import { getConfig } from '../config.js';
import { callModel } from '../ai/client.js';
import { DOC_TYPE_ENUM } from './classification.js';
import { TRANSPORT_MODES, CURRENCIES, CONVERSIONS } from './normalization.js';
import * as uncertainty from './uncertainty.js';

const UNIT_SET = [...Object.keys(CONVERSIONS), 't.km', 'p.km', 'MMBtu'];

export const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    records: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          supplier_name: { type: 'string', nullable: true },
          item_description: { type: 'string' },
          quantity: { type: 'number', nullable: true },
          unit: { type: 'string', enum: UNIT_SET, nullable: true },
          amount: { type: 'number', nullable: true },
          currency: { type: 'string', enum: CURRENCIES, nullable: true },
          activity_date: { type: 'string', nullable: true },
          origin_location: { type: 'string', nullable: true },
          destination_location: { type: 'string', nullable: true },
          transport_mode: { type: 'string', enum: TRANSPORT_MODES, nullable: true },
          gross_weight_kg: { type: 'number', nullable: true },
          distance_km: { type: 'number', nullable: true },
          field_confidence: {
            type: 'object',
            properties: Object.fromEntries(
              ['supplier_name', 'item_description', 'quantity', 'unit', 'amount', 'currency',
                'activity_date', 'origin_location', 'destination_location', 'transport_mode',
                'gross_weight_kg', 'distance_km'].map((k) => [k, { type: 'number' }]),
            ),
          },
          extraction_notes: { type: 'string', nullable: true },
        },
        required: ['item_description', 'field_confidence'],
      },
    },
  },
  required: ['records'],
};

export function validateExtraction(result) {
  if (!result || !Array.isArray(result.records)) throw new Error('records array missing');
  for (const r of result.records) {
    if (!r.item_description) throw new Error('item_description empty');
    if (r.quantity != null && (typeof r.quantity !== 'number' || r.quantity <= 0)) throw new Error('quantity invalid');
    if (r.unit != null && !UNIT_SET.includes(r.unit)) throw new Error(`unit '${r.unit}' outside enum`);
    if (r.currency != null && !CURRENCIES.includes(r.currency)) throw new Error('currency outside enum');
    if (r.transport_mode != null && !TRANSPORT_MODES.includes(r.transport_mode)) throw new Error('transport_mode outside enum');
    if (r.amount != null && r.amount < 0) throw new Error('negative amount');
    for (const v of Object.values(r.field_confidence ?? {})) {
      if (typeof v !== 'number' || v < 0 || v > 1) throw new Error('field confidence outside [0,1]');
    }
  }
}

/** Dev/test mock: returns pre-registered expected records (plumbing only). */
export function mockExtraction(ctx) {
  return { records: (ctx.expectedRecords ?? []).map((r) => ({ ...r })) };
}

export const SCOPE3_CATEGORIES = [
  ['Cat-1', 'Purchased goods and services'], ['Cat-2', 'Capital goods'],
  ['Cat-3', 'Fuel- and energy-related activities'], ['Cat-4', 'Upstream transportation and distribution'],
  ['Cat-5', 'Waste generated in operations'], ['Cat-6', 'Business travel'],
  ['Cat-7', 'Employee commuting'], ['Cat-8', 'Upstream leased assets'],
  ['Cat-9', 'Downstream transportation and distribution'], ['Cat-10', 'Processing of sold products'],
  ['Cat-11', 'Use of sold products'], ['Cat-12', 'End-of-life treatment of sold products'],
  ['Cat-13', 'Downstream leased assets'], ['Cat-14', 'Franchises'], ['Cat-15', 'Investments'],
];

const CATEGORY_IDS = SCOPE3_CATEGORIES.map(([id]) => id);

export const BOUNDARY_SCHEMA = {
  type: 'object',
  properties: {
    scope: { type: 'string', enum: ['Scope 1', 'Scope 2', 'Scope 3'] },
    category: { type: 'string', enum: CATEGORY_IDS, nullable: true },
    rationale: { type: 'string' },
  },
  required: ['scope', 'rationale'],
};

export function validateBoundary(result) {
  if (!['Scope 1', 'Scope 2', 'Scope 3'].includes(result.scope)) throw new Error('scope outside enum');
  if (result.scope === 'Scope 3') {
    if (!CATEGORY_IDS.includes(result.category)) throw new Error(`category '${result.category}' outside 15-class enum`);
  } else if (result.category != null) {
    throw new Error('category must be null outside Scope 3');
  }
  if (!result.rationale || result.rationale.trim().length < 10) throw new Error('rationale missing');
  if (/[一-龥]/.test(result.rationale)) throw new Error('rationale must be English');
}

export function mockBoundary(ctx) {
  return ctx.expectedBoundary ?? { scope: 'Scope 3', category: 'Cat-1', rationale: 'Mock boundary decision for offline pipeline development; purchase of goods is upstream of operations.' };
}

export const SELECTION_SCHEMA = {
  type: 'object',
  properties: {
    selected_factor_id: { type: 'string' },
    confidence: { type: 'number' },
    rationale: { type: 'string' },
    key_semantic_features: { type: 'array', items: { type: 'string' } },
    runner_up_id: { type: 'string', nullable: true },
  },
  required: ['selected_factor_id', 'confidence', 'rationale', 'key_semantic_features'],
};

export function makeSelectionValidator(candidateIds) {
  return (result) => {
    if (!candidateIds.includes(result.selected_factor_id)) {
      // AI-204: factor id outside the candidate list is a failed call.
      throw new Error(`selected_factor_id '${result.selected_factor_id}' not in candidate list`);
    }
    if (result.runner_up_id != null && !candidateIds.includes(result.runner_up_id)) {
      throw new Error(`runner_up_id '${result.runner_up_id}' not in candidate list`);
    }
    if (typeof result.confidence !== 'number' || result.confidence < 0 || result.confidence > 1) throw new Error('confidence outside [0,1]');
    if (!result.rationale || result.rationale.split(/\s+/).length < 40) throw new Error('rationale shorter than 40 words');
    if (!/runner|instead|rather|not select|over|prefer/i.test(result.rationale)) {
      throw new Error('rationale lacks comparison with the runner-up');
    }
    if (!Array.isArray(result.key_semantic_features) || result.key_semantic_features.length < 2 || result.key_semantic_features.length > 4) {
      throw new Error('key_semantic_features must contain 2-4 items');
    }
  };
}

export function mockSelection(ctx) {
  if (ctx.expectedSelection) return ctx.expectedSelection;
  const cands = ctx.candidates ?? [];
  if (cands.length === 0) {
    return {
      selected_factor_id: ctx.candidateIds?.[0] ?? null, confidence: 0.72,
      rationale: MOCK_RATIONALE,
      key_semantic_features: ['activity type match', 'unit compatibility'],
      runner_up_id: null,
    };
  }
  // Deterministic offline heuristic: keep only unit-compatible candidates,
  // then score name/description keyword overlap; pick best, runner-up second.
  const { unitSelfCheck } = uncertainty;
  const compatible = cands.filter((c) => unitSelfCheck(ctx.record ?? {}, c.factor).passed);
  const pool = compatible.length > 0 ? compatible : cands;
  const text = `${ctx.record?.item_description ?? ''} ${ctx.record?.transport_mode ?? ''}`.toLowerCase();
  const terms = [...new Set(text.split(/[^a-z0-9]+/).filter((t) => t.length > 3))];
  const scored = pool.map((c) => {
    const hay = `${c.factor.name} ${c.factor.description}`.toLowerCase();
    return { id: c.factor_id, score: terms.reduce((a, t) => a + (hay.includes(t) ? 1 : 0), 0) - c.factor.priority * 0.1 };
  }).sort((a, b) => b.score - a.score);
  return {
    selected_factor_id: scored[0]?.id ?? null,
    confidence: 0.72,
    rationale: MOCK_RATIONALE,
    key_semantic_features: ['activity type match', 'unit compatibility'],
    runner_up_id: scored[1]?.id ?? null,
  };
}

const MOCK_RATIONALE = 'Offline development mock rationale used while model credentials are unavailable. This deliberately verbose text exists purely to keep the full pipeline runnable end to end, and it intentionally explains why the leading candidate was preferred over the runner-up alternative instead of choosing that other option, satisfying the minimum word count contract.';

// ---------------------------------------------------------------------------
// Service functions used by the pipeline.

export async function extractRecords({ traceStore, taskId, unit, representationBytes, sourceFormat, filename, docType, expectedRecords }) {
  const cfg = getConfig().values;
  const mime = { pdf: 'application/pdf', jpg: 'image/jpeg', png: 'image/png', csv: 'text/csv', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }[sourceFormat] || 'application/octet-stream';
  const text = unit && unit.doc_type ? `The page has been classified as ${unit.doc_type}.` : '';
  const { result } = await callModel({
    taskId, stage: 'extraction', model: cfg.EXTRACTION_MODEL,
    parts: [
      { text: `Extract every activity record from this ${docType ?? 'document'} page. Rules: quantity must be the PHYSICAL trade amount exactly as printed (mass/volume/energy/distance), never a count of items or prices — when both a package count and a net weight appear, use the net weight and its unit. Convert nothing; report the printed value and its printed unit. For passenger travel, quantity is the trip distance with unit km, and put the passenger count only in extraction_notes. gross_weight_kg and distance_km are separate fields for shipments, and for freight documents the printed cargo or gross weight is ALSO the activity quantity — fill quantity and unit with it in addition to gross_weight_kg. If the currency is not printed anywhere, set currency to null — NEVER infer or guess it. Dates must be transcribed exactly as printed in ISO format; if a digit is genuinely illegible, leave the field null rather than guessing. Leave every missing field null — never fabricate. ${text}` },
      { inline_data: { mime_type: mime, data: representationBytes.toString('base64') } },
    ],
    schema: EXTRACTION_SCHEMA,
    validator: validateExtraction,
    traceStore, mockFn: mockExtraction,
    mockContext: { expectedRecords },
  });
  const out = [];
  for (const r of result.records) {
    const id = `rec_${randomUUID().slice(0, 8)}`;
    out.push({
      record_id: id,
      task_id: taskId,
      source_ref: `${unit.document_id}#${unit.page_number ? `page=${unit.page_number}` : 'page=1'}`,
      doc_type: unit.doc_type ?? docType ?? 'other',
      ...r,
      field_confidence: r.field_confidence ?? {},
    });
  }
  return out;
}

export async function decideBoundary({ traceStore, taskId, record, expectedBoundary }) {
  const cfg = getConfig().values;
  const { result } = await callModel({
    taskId, stage: 'boundary', model: cfg.EXTRACTION_MODEL,
    parts: [{ text: `Assign the GHG Protocol boundary for this activity record and explain briefly in English.\n${JSON.stringify(record)}` }],
    schema: BOUNDARY_SCHEMA,
    validator: validateBoundary,
    traceStore, mockFn: mockBoundary,
    mockContext: { expectedBoundary },
  });
  const cat = result.scope === 'Scope 3' ? SCOPE3_CATEGORIES.find(([id]) => id === result.category) : null;
  return { ...result, category_name: cat ? cat[1] : null };
}

export async function selectFactor({ traceStore, taskId, record, candidates, expectedSelection }) {
  const cfg = getConfig().values;
  const ids = candidates.map((c) => c.factor_id);
  const candidateSummary = JSON.stringify({
    ...record,
    candidates: candidates.map((c) => ({
      id: c.factor_id, name: c.factor.name, unit: c.factor.activity_unit,
      boundary: c.factor.system_boundary, value: c.factor.value,
    })),
  });
  const { result, latency_ms } = await callModel({
    taskId, stage: 'factor_selection', model: cfg.REASONING_MODEL,
    parts: [{
      text: `Choose the single best emission factor for this activity from the candidates. Respond with selected_factor_id (must be one of the candidates), confidence, an English rationale of at least 40 words that explains why the runner-up was NOT chosen, 2-4 key semantic features, and the runner_up_id.\nActivity: ${candidateSummary}`,
    }],
    schema: SELECTION_SCHEMA,
    validator: makeSelectionValidator(ids),
    traceStore, mockFn: mockSelection,
    mockContext: { candidateIds: ids, candidates: candidates.filter((c) => c.factor), record, expectedSelection },
  });
  return { ...result, latency_ms, candidate_ids: ids };
}

/** Marks suspected duplicates inside one file (FR-504). */
export function markSuspectedDuplicates(records) {
  const seen = new Map();
  for (const r of records) {
    const key = `${(r.item_description || '').toLowerCase().trim()}|${r.quantity}|${r.activity_date}`;
    if (seen.has(key)) {
      r.suspected_duplicate = true;
      r.duplicate_of_record = seen.get(key);
    } else {
      seen.set(key, r.record_id);
      r.suspected_duplicate = false;
    }
  }
  return records;
}
