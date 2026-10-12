// File ingestion service (T-011, PRD 4.1): validation, hashing, page-unit
// counting, persistence, metadata records and the 7-state file machine.
import { createHash, randomUUID } from 'node:crypto';
import { AppError } from '../errors.js';
import { log } from '../logging.js';

const MAX_BYTES = 10 * 1024 * 1024; // FR-105: 10 MB per file
const ALLOWED = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  png: 'image/png',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
};

export const FILE_STATUSES = ['queued', 'parsing', 'extracting', 'matching', 'completed', 'needs_review', 'failed'];

function extensionOf(filename) {
  const m = /\.([A-Za-z0-9]+)$/.exec(filename);
  return m ? m[1].toLowerCase() : '';
}

function magicOk(ext, buf) {
  if (buf.length < 8) return false;
  const hex = buf.subarray(0, 8).toString('hex');
  if (ext === 'pdf') return buf.subarray(0, 5).toString('latin1') === '%PDF-';
  if (ext === 'jpg') return hex.startsWith('ffd8ff');
  if (ext === 'png') return hex.startsWith('89504e470d0a1a0a');
  if (ext === 'xlsx') return hex.startsWith('504b0304'); // zip local header
  return true; // csv: text, validated below
}

export function countPdfPages(buf) {
  const text = buf.toString('latin1');
  const matches = text.match(/\/Type\s*\/Page[^s]/g);
  return matches ? matches.length : 0;
}

/**
 * Validates and persists one uploaded file; never throws for a single bad
 * file — returns an error entry so the rest of the batch proceeds (PRD 3.2).
 * Duplicate content (same sha256 within the task) is parked with status
 * 'pending_duplicate' and surfaced for a user keep/discard decision (FR-104).
 */
export async function ingestFile({ store, storage, taskId, filename, buffer }) {
  const ext = extensionOf(filename);
  const fail = (code, details) => ({ ok: false, filename, code, message: new AppError(code).message, details });

  if (!(ext in ALLOWED)) return fail('ERR_FILE_FORMAT_UNSUPPORTED', { extension: ext });
  if (buffer.length === 0) return fail('ERR_FILE_CORRUPT', { reason: 'empty file' });
  if (buffer.length > MAX_BYTES) return fail('ERR_FILE_TOO_LARGE', { size: buffer.length, limit: MAX_BYTES });

  let unitCount = 1;
  if (ext === 'pdf') {
    const pages = countPdfPages(buffer);
    if (pages === 0) return fail('ERR_FILE_CORRUPT', { reason: 'no parseable pages' });
    unitCount = pages;
  } else if (ext === 'xlsx') {
    // XLSX is a ZIP archive; the workbook part must exist.
    if (!buffer.toString('latin1').includes('xl/workbook')) {
      return fail('ERR_FILE_CORRUPT', { reason: 'workbook part missing' });
    }
    unitCount = 1;
  } else if (ext === 'csv') {
    const head = buffer.toString('utf8', 0, Math.min(2000, buffer.length));
    if (!head.trim()) return fail('ERR_FILE_CORRUPT', { reason: 'empty csv' });
    unitCount = 1;
  }
  if (!magicOk(ext, buffer)) return fail('ERR_FILE_CORRUPT', { reason: 'magic bytes mismatch' });

  const contentHash = createHash('sha256').update(buffer).digest('hex');
  const existing = await store.query('documents', 'task_id', taskId);
  const duplicateOf = existing.find((d) => d.content_hash === contentHash && !d.duplicate_discarded);

  const id = `doc_${randomUUID().slice(0, 8)}`;
  const storageKey = `${taskId}/${id}_${filename}`;
  await storage.put(storageKey, buffer);

  const record = {
    task_id: taskId,
    original_filename: filename,
    format: ext,
    size_bytes: buffer.length,
    page_count: unitCount,
    content_hash: contentHash,
    storage_path: storageKey,
    upload_status: 'stored',
    status: duplicateOf ? 'pending_duplicate' : 'queued',
    duplicate_of: duplicateOf ? duplicateOf.id : null,
    duplicate_discarded: false,
    created_at: new Date().toISOString(),
  };
  await store.put('documents', id, record);
  log.info('document_ingested', { task_id: taskId, doc: id, format: ext, status: record.status });
  return {
    ok: true, document_id: id, filename, format: ext, size_bytes: buffer.length,
    page_count: unitCount, status: record.status, duplicate_of: duplicateOf ? duplicateOf.id : null,
  };
}

export async function resolveDuplicate({ store, taskId, documentId, keep }) {
  const doc = await store.get('documents', documentId);
  if (!doc || doc.task_id !== taskId || doc.status !== 'pending_duplicate') {
    throw new AppError('ERR_TASK_NOT_FOUND', { hint: 'document not found or not pending duplicate decision' });
  }
  if (keep) {
    doc.status = 'queued';
    doc.duplicate_discarded = false;
  } else {
    doc.status = 'discarded';
    doc.duplicate_discarded = true;
  }
  await store.put('documents', documentId, doc);
  return doc;
}

const TRANSITIONS = {
  queued: ['parsing', 'failed'],
  parsing: ['extracting', 'failed', 'needs_review'],
  extracting: ['matching', 'failed', 'needs_review'],
  matching: ['completed', 'needs_review', 'failed'],
  completed: ['matching'],
  needs_review: ['matching', 'completed', 'failed'],
  failed: ['queued'],
};

export async function setDocumentStatus(store, taskId, documentId, next) {
  const doc = await store.get('documents', documentId);
  if (!doc || doc.task_id !== taskId) throw new AppError('ERR_TASK_NOT_FOUND', { document_id: documentId });
  const allowed = TRANSITIONS[doc.status] || [];
  if (!FILE_STATUSES.includes(next) && next !== 'discarded') {
    throw new AppError('ERR_ENUM_INVALID', { status: next });
  }
  if (!allowed.includes(next)) {
    throw new AppError('ERR_ENUM_INVALID', { from: doc.status, to: next });
  }
  doc.status = next;
  await store.put('documents', documentId, doc);
  return doc;
}

export async function getDocumentFile(storage, doc) {
  return storage.get(doc.storage_path);
}
