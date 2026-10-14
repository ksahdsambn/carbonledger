// Object storage abstraction (PRD 8.1: Firebase Storage in production).
// LocalFileStorage stores objects under a local root for dev, tests and the
// offline evaluation tool; the Firebase Storage adapter is wired in T-043.
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { AppError } from '../errors.js';

export class LocalFileStorage {
  constructor(rootDir = 'data/.uploads') {
    this.rootDir = rootDir;
  }

  // Defense in depth (D-07): every key must resolve inside the root, so a
  // crafted key can never read or write outside the storage root.
  #path(key) {
    const root = resolve(this.rootDir);
    const p = resolve(this.rootDir, key);
    if (p !== root && !p.startsWith(root + sep)) throw new AppError('ERR_STORAGE_ACCESS', { key: String(key).slice(0, 80) });
    return p;
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
