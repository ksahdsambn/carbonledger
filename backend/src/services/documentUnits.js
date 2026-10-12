// Page-unit service (T-013, FR-103, PRD 8.4 document_units).
// Every PDF page becomes one unit stored as a single-page PDF (pdf-lib copy);
// non-paginated files (images, spreadsheets, csv) form exactly one unit that
// references the original object.
import { PDFDocument } from 'pdf-lib';
import { randomUUID } from 'node:crypto';

export async function splitPdfToPages(buffer) {
  const src = await PDFDocument.load(buffer);
  const pages = [];
  for (let i = 0; i < src.getPageCount(); i += 1) {
    const single = await PDFDocument.create();
    const [copied] = await single.copyPages(src, [i]);
    single.addPage(copied);
    pages.push(await single.save());
  }
  return pages;
}

/**
 * Creates the page units for an ingested document and persists each unit's
 * model-ready representation. Returns the created units.
 */
export async function buildUnitsForDocument({ store, storage, doc }) {
  const existing = await store.query('document_units', 'document_id', doc.id);
  if (existing.length > 0) return existing;

  const units = [];
  const make = async (pageNumber, representationKey) => {
    const id = `unit_${randomUUID().slice(0, 8)}`;
    const unit = {
      task_id: doc.task_id,
      document_id: doc.id,
      page_number: pageNumber,
      representation_path: representationKey,
      doc_type: null,
      type_confidence: null,
      needs_manual_confirmation: false,
      created_at: new Date().toISOString(),
    };
    await store.put('document_units', id, unit);
    units.push(unit);
  };

  if (doc.format === 'pdf') {
    const original = await storage.get(doc.storage_path);
    const pages = await splitPdfToPages(original);
    for (let i = 0; i < pages.length; i += 1) {
      const key = `units/${doc.task_id}/${doc.id}/page-${String(i + 1).padStart(4, '0')}.pdf`;
      await storage.put(key, pages[i]);
      await make(i + 1, key);
    }
  } else {
    // Non-paginated formats are a single unit referencing the original file.
    await make(1, doc.storage_path);
  }
  return units;
}

/** Resolves a unit back to its document and page for traceability (FR-106). */
export async function resolveUnit(store, unitId) {
  const unit = await store.get('document_units', unitId);
  if (!unit) return null;
  const doc = await store.get('documents', unit.document_id);
  return { unit, document: doc || null };
}
