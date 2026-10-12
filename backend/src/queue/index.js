// Async task queue abstraction (PRD 8.1: Cloud Tasks or an equivalent
// managed service). The 'inproc' implementation below is the local/dev
// default; the 'cloudtasks' adapter is wired during deployment (T-043).
// Modules enqueue typed jobs and register handlers; they never talk to a
// concrete queue technology directly.

import { EventEmitter } from 'node:events';

export class InProcessQueue extends EventEmitter {
  constructor() {
    super();
    this.handlers = new Map();
    this.pending = [];
    this.stats = { enqueued: 0, completed: 0, failed: 0 };
    this.running = false;
  }

  registerHandler(type, handler) {
    this.handlers.set(type, handler);
  }

  enqueue(type, payload) {
    this.stats.enqueued += 1;
    const job = { id: `job_${Date.now()}_${this.stats.enqueued}`, type, payload };
    this.pending.push(job);
    if (this.running) setImmediate(() => this.#drainOne(job));
    return job.id;
  }

  async start() {
    this.running = true;
    while (this.pending.length > 0) {
      await this.#drainOne(this.pending.shift());
    }
  }

  stop() {
    this.running = false;
  }

  async #drainOne(job) {
    const handler = this.handlers.get(job.type);
    if (!handler) {
      this.stats.failed += 1;
      this.emit('dead-letter', { job, reason: `no handler for type '${job.type}'` });
      return;
    }
    try {
      await handler(job.payload, job);
      this.stats.completed += 1;
      this.emit('completed', job);
    } catch (err) {
      this.stats.failed += 1;
      this.emit('failed', { job, error: String(err && err.message ? err.message : err) });
    }
  }
}

/**
 * @param {'inproc'|'cloudtasks'} [kind]
 */
export function createQueue(kind = process.env.QUEUE_KIND || 'inproc') {
  if (kind === 'inproc') return new InProcessQueue();
  if (kind === 'cloudtasks') {
    // Placeholder until deployment wiring lands in T-043; fails loudly if
    // referenced early so misconfiguration is caught by tests.
    throw new Error('Cloud Tasks adapter is wired during deployment (T-043).');
  }
  throw new Error(`Unknown queue kind '${kind}'`);
}
