// Object storage abstraction (PRD 8.1: Firebase Storage in production).
// LocalFileStorage stores objects under a local root for dev, tests and the
// offline evaluation tool; the Firebase Storage adapter is wired in T-043.
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export class LocalFileStorage {
  constructor(rootDir = 'data/.uploads') {
    this.rootDir = rootDir;
  }

  #path(key) {
    return join(this.rootDir, key);
  }

  async put(key, buffer) {
    const p = this.#path(key);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, buffer);
    return key;
  }

  async get(key) {
    return readFileSync(this.#path(key));
  }
}

export async function createStorage(kind = process.env.STORAGE_KIND || 'local', options = {}) {
  if (kind === 'local') {
    return new LocalFileStorage(options.rootDir || process.env.STORAGE_ROOT || 'data/.uploads');
  }
  if (kind === 'firebase') {
    const { createFirebaseStorage } = await import('../store/firestore.js');
    return createFirebaseStorage(options.bucket || process.env.STORAGE_BUCKET_NAME);
  }
  throw new Error(`Unknown storage kind '${kind}'`);
}
