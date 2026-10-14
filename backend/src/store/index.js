// Collection-oriented storage abstraction matching the Firestore data model
// (PRD 8.4). Two adapters share one interface:
//   - LocalFileStore: JSON-file-backed, used for local dev, tests and the
//     offline evaluation tool.
//   - FirestoreStore: production adapter over firebase-admin, enabled when
//     GCP credentials are present (wired in T-043).
// Collections and field semantics are identical across adapters.

import { mkdirSync, readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs';
import { join } from 'node:path';

const COLLECTIONS = [
  'tasks',
  'documents',
  'document_units',
  'activity_records',
  'emission_factors',
  'matches',
  'calculations',
  'scenarios',
  'reports',
  'review_items',
  'audit_trail',
  'ai_traces',
];

export class LocalFileStore {
  /**
   * @param {string} rootDir directory that holds one JSON file per collection
   */
  constructor(rootDir) {
    this.rootDir = rootDir;
    mkdirSync(rootDir, { recursive: true });
    this.cache = new Map();
    for (const name of COLLECTIONS) {
      const file = join(rootDir, `${name}.json`);
      if (existsSync(file)) {
        try {
          this.cache.set(name, new Map(Object.entries(JSON.parse(readFileSync(file, 'utf8')))));
        } catch (err) {
          // A corrupt collection file must never be swallowed silently (D-20).
          console.error(JSON.stringify({ ts: new Date().toISOString(), level: 'error', event: 'store_collection_unreadable', collection: name, error: String(err.message).slice(0, 160) }));
          this.cache.set(name, new Map());
        }
      } else {
        this.cache.set(name, new Map());
      }
    }
  }

  #persist(name) {
    // Write-then-rename keeps the collection file atomic: a crash mid-write
    // can no longer leave a half-written JSON behind (D-20).
    const file = join(this.rootDir, `${name}.json`);
    const tmp = `${file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(Object.fromEntries(this.cache.get(name))));
    renameSync(tmp, file);
  }

  async put(name, id, data) {
    this.cache.get(name).set(id, { ...data, id });
    this.#persist(name);
    return id;
  }

  async get(name, id) {
    return this.cache.get(name).get(id) ?? null;
  }

  async delete(name, id) {
    this.cache.get(name).delete(id);
    this.#persist(name);
  }

  /** Returns all documents in a collection (id included). */
  async list(name) {
    return [...this.cache.get(name).values()];
  }

  /** Naive field-equality query sufficient for dev/eval workloads. */
  async query(name, field, value) {
    return (await this.list(name)).filter((d) => d[field] === value);
  }
}

export async function createStore(kind = process.env.STORE_KIND || 'local', options = {}) {
  if (kind === 'local') {
    return new LocalFileStore(options.rootDir || process.env.STORE_ROOT || 'data/.local-store');
  }
  if (kind === 'firestore') {
    const { createFirestoreStore } = await import('./firestore.js');
    return createFirestoreStore();
  }
  throw new Error(`Unknown store kind '${kind}'`);
}
