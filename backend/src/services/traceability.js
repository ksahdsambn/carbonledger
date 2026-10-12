// Traceability service (T-020, FR-106/FR-305, PRD 8.4): parses source_ref
// strings into concrete document + internal locations, resolves them against
// ingested documents and page units, and provides the invalid-reference scan
// feeding the evaluation tool's veto metric.
import { AppError } from '../errors.js';

/**
 * Parses formats:
 *   <docId>#page=1[;line=2]
 *   <docId>#sheet=Sheet1;row=4
 *   <docId>#sheet=row=2        (csv: row ordinal)
 * Returns null for unparseable references (counted as invalid).
 */
export function parseSourceRef(ref) {
  if (typeof ref !== 'string' || !ref.includes('#')) return null;
  const [docId, frag] = ref.split('#', 2);
  if (!docId) return null;
  const out = { docId, page: null, sheet: null, row: null, line: null };
  for (const part of frag.split(';')) {
    const m = /^(page|sheet|row|line)=(.+)$/.exec(part.trim());
    if (!m) return null;
    const val = m[2];
    if (m[1] === 'page' || m[1] === 'row' || m[1] === 'line') {
      const n = Number.parseInt(val, 10);
      if (!Number.isInteger(n) || n < 1) return null;
      out[m[1]] = n;
    } else {
      out.sheet = val;
    }
  }
  if (out.page == null && out.sheet == null) return null;
  return out;
}

/**
 * Resolves one record's source_ref against ingested documents/units.
 * @returns {{ok: true, parsed, document, unit?} | {ok: false, reason}}
 */
export async function resolveReference({ store, storage, sourceRef, documentsIndex }) {
  const parsed = parseSourceRef(sourceRef);
  if (!parsed) return { ok: false, reason: 'unparseable' };
  let doc = null;
  if (documentsIndex) {
    doc = documentsIndex[parsed.docId];
  } else {
    doc = await store.get('documents', parsed.docId);
  }
  if (!doc) return { ok: false, reason: 'document_not_found' };
  if (parsed.page != null) {
    if (doc.format !== 'pdf' && parsed.page !== 1) return { ok: false, reason: 'page_on_non_pdf' };
    if (parsed.page > doc.page_count) return { ok: false, reason: 'page_out_of_range' };
    const units = await store.query('document_units', 'document_id', doc.id);
    const unit = units.find((u) => u.page_number === parsed.page);
    return { ok: true, parsed, document: doc, unit: unit || null };
  }
  // sheet/row reference
  if (doc.format === 'xlsx' && parsed.sheet && !/^Sheet/i.test(parsed.sheet)) {
    // csv rows use sheet=row=N; xlsx uses sheet=Sheet1
    if (!/^Sheet/.test(parsed.sheet)) return { ok: false, reason: 'sheet_mismatch' };
  }
  return { ok: true, parsed, document: doc, unit: null };
}

/** Opens the source file for a record and returns view-localization info. */
export async function openSourceView({ storage, document, parsed }) {
  const bytes = await storage.get(document.storage_path);
  const locator = parsed.page != null
    ? { kind: 'page', page: parsed.page, total_pages: document.page_count }
    : { kind: 'row', sheet: parsed.sheet, row: parsed.row, line: parsed.line };
  return { bytes, format: document.format, locator };
}

/**
 * Full scan of references (evaluation veto metric AI-202, PRD 8.4).
 * @returns {{total, resolved, invalid_count, invalid: [{ref, reason}]}}
 */
export async function scanReferences({ store, storage, records, documentsIndex }) {
  const invalid = [];
  let resolved = 0;
  for (const r of records) {
    const res = await resolveReference({ store, storage, sourceRef: r.source_ref, documentsIndex });
    if (res.ok) resolved += 1;
    else invalid.push({ record_id: r.record_id, ref: r.source_ref, reason: res.reason });
  }
  return { total: records.length, resolved, invalid_count: invalid.length, invalid };
}
