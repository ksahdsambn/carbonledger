// Document classification service (T-014, PRD 4.2): closed seven-type enum,
// structured output, per-unit confidence, sub-threshold routing to manual
// confirmation (FR-203). All model traffic goes through the unified wrapper.
import { getConfig } from '../config.js';
import { callModel, mode } from '../ai/client.js';

export const DOC_TYPE_ENUM = [
  'supplier_invoice', 'purchase_order', 'logistics_waybill', 'utility_bill',
  'travel_expense', 'packing_list', 'other',
];

export const CLASSIFICATION_SCHEMA = {
  type: 'object',
  properties: {
    doc_type: { type: 'string', enum: DOC_TYPE_ENUM },
    confidence: { type: 'number' },
  },
  required: ['doc_type', 'confidence'],
};

const MIME = {
  pdf: 'application/pdf', jpg: 'image/jpeg', png: 'image/png', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', csv: 'text/csv',
};

function validateClassification(result) {
  if (!result || typeof result !== 'object') throw new Error('result not an object');
  if (!DOC_TYPE_ENUM.includes(result.doc_type)) {
    throw new Error(`doc_type '${result.doc_type}' outside closed enum`);
  }
  const c = Number(result.confidence);
  if (!Number.isFinite(c) || c < 0 || c > 1) throw new Error('confidence outside [0,1]');
}

/**
 * Dev/test mock: deterministic keyword classification from the source
 * filename. Never used for accuracy metrics (adapter:'mock' in traces).
 */
export function mockClassification({ filename, docHint }) {
  if (docHint) return { doc_type: docHint, confidence: 0.98 };
  const n = (filename || '').toLowerCase();
  const rule = [
    [/blurry|blank/, null], // blurry docs: ambiguous, exercised below
    [/invoice/, 'supplier_invoice'],
    [/_po_|po_|purchase/, 'purchase_order'],
    [/awb|waybill|freight|delivery/, 'logistics_waybill'],
    [/utility|electricity|gas_|water|heat/, 'utility_bill'],
    [/travel|flight|train|taxi|commuting/, 'travel_expense'],
    [/packing|pallet/, 'packing_list'],
  ];
  if (/blurry/.test(n)) return { doc_type: 'other', confidence: 0.5 }; // routes to manual confirmation
  for (const [re, type] of rule) if (re.test(n) && type) return { doc_type: type, confidence: 0.95 };
  return { doc_type: 'other', confidence: 0.55 };
}

/**
 * Classifies one page unit. Writes doc_type + confidence onto the unit and
 * flags manual confirmation below the configured threshold.
 */
export async function classifyUnit({ traceStore, taskId, unit, representationBytes, sourceFormat, filename }) {
  const cfg = getConfig().values;
  const fmt = sourceFormat === 'pdf' ? 'pdf' : sourceFormat;
  const parts = [
    { text: 'Classify this document page into exactly one of the seven types. Respond with the type and your confidence between 0 and 1.' },
    { inline_data: { mime_type: MIME[fmt] || 'application/octet-stream', data: representationBytes.toString('base64') } },
  ];
  const { result } = await callModel({
    taskId,
    stage: 'classification',
    model: cfg.EXTRACTION_MODEL,
    parts,
    schema: CLASSIFICATION_SCHEMA,
    validator: validateClassification,
    traceStore,
    mockFn: mockClassification,
    mockContext: { filename, docHint: unit.doc_type_hint },
  });
  const threshold = cfg.CLASSIFICATION_CONFIDENCE_THRESHOLD;
  const needsManual = result.confidence < threshold;
  const updated = {
    ...unit,
    doc_type: result.doc_type,
    type_confidence: result.confidence,
    needs_manual_confirmation: needsManual,
  };
  if (traceStore) await traceStore.put('document_units', unit.id, updated);
  return updated;
}
