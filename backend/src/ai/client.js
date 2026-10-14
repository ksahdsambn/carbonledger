// Unified AI model-call wrapper (T-014, reused by every model module:
// classification, extraction, boundary decision, factor selection, report
// generation, embeddings). Enforces the PRD 6.2 output contract:
// structured output mode (AI-101), closed-set validation with retry instead
// of silent pass (AI-102), per-call source identifier (AI-103), latency and
// usage recording (AI-106), configured timeout and retry count (PRD 8.3).
//
// Modes: 'real' when GEMINI_API_KEY is present, otherwise 'mock' (dev/test
// only — the evaluation tool refuses to compute accuracy metrics from mock
// runs). Selection is logged in every ai_traces record.

import { getConfig, getSecret } from '../config.js';
import { AppError } from '../errors.js';
import { log } from '../logging.js';

// Public list prices (USD per 1M tokens) used for cost estimation (NFR-102).
// Source: Google AI / Gemini API pricing page; overridable via env JSON.
// Only the models the single-model policy permits appear here, so the price
// table and the allow-list cannot drift apart.
export const DEFAULT_PRICES = {
  // Public list prices, USD per 1M tokens (ai.google.dev/gemini-api/docs/pricing).
  'gemini-3.5-flash-lite': { input: 0.10, output: 0.40 },
  'gemini-embedding-001': { input: 0.15, output: 0 },
};

function prices() {
  if (process.env.AI_PRICES_JSON) {
    try { return { ...DEFAULT_PRICES, ...JSON.parse(process.env.AI_PRICES_JSON) }; } catch { /* fall through */ }
  }
  return DEFAULT_PRICES;
}

/**
 * Single-model policy guard. Every real (non-mock) call must name a model the
 * configured allow-list permits, so a stale env value or an accidental edit
 * cannot start calling a Pro or Flash model. Mock calls are exempt because they
 * never leave the process.
 */
export function assertModelAllowed(model) {
  const allowed = String(getConfig().values.AI_MODEL_ALLOWLIST ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!allowed.includes(model)) {
    throw new AppError('ERR_MODEL_CALL_FAILED', {
      stage: 'model-policy', model, allowed,
      detail: 'model not permitted by the configured single-model policy',
    });
  }
  return model;
}

export function mode() {
  if (process.env.AI_MODE === 'mock') return 'mock';
  if (process.env.AI_MODE === 'real') return 'real';
  return getSecret('GEMINI_API_KEY') ? 'real' : 'mock';
}

function estimateCost(model, usage) {
  const p = prices()[model] || { input: 0, output: 0 };
  return (usage.input_tokens / 1e6) * p.input + (usage.output_tokens / 1e6) * p.output;
}

function summarize(obj, limit = 300) {
  try {
    const s = typeof obj === 'string' ? obj : JSON.stringify(obj);
    return s.length > limit ? s.slice(0, limit) + '…' : s;
  } catch {
    return String(obj);
  }
}

// Trace minimization (D-05-related, R-05): uploaded document bytes must never
// appear in ai_traces, so inline_data parts are summarized as omitted.
function redactParts(parts) {
  if (!Array.isArray(parts)) return parts;
  return parts.map((p) => (p && p.inline_data
    ? { text: p.text, inline_data: `[${p.inline_data.mime_type ?? 'binary'} omitted]` }
    : p));
}

/**
 * Calls the configured Gemini model with structured output.
 * @param {object} opts
 * @param {string} opts.taskId  source identifier for traceability (AI-103)
 * @param {string} opts.stage   pipeline stage name written to ai_traces
 * @param {string} opts.model   model id from central config
 * @param {Array}  opts.parts   Gemini content parts (text / inline_data)
 * @param {object} opts.schema  responseSchema (JSON-schema subset)
 * @param {Function} opts.validator  closed-set validation; throw on invalid
 * @param {Function} opts.mockFn deterministic mock for dev/test mode
 * @param {object} opts.traceStore store used for the ai_traces collection
 */
export async function callModel({ taskId, stage, model, parts, schema, validator, mockFn, traceStore, mockContext }) {
  const cfg = getConfig().values;
  const attempts = cfg.AI_RETRY_COUNT + 1;
  // The single-model policy is checked once, before the retry loop: a
  // configuration violation is not a transient failure worth retrying.
  if (mode() === 'real') assertModelAllowed(model);
  let lastErr = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const started = Date.now();
    try {
      const { result, usage, adapter } = await dispatch({ model, parts, schema, mockFn, mockContext, timeoutMs: cfg.AI_TIMEOUT_SECONDS * 1000 });
      if (validator) {
        try {
          validator(result);
        } catch (vErr) {
          // Invalid enum / contract violation: counts as a failed attempt and
          // is retried, never silently passed (AI-102).
          throw Object.assign(new Error(`validation failed: ${vErr.message}`), { kind: 'invalid' });
        }
      }
      const latency = Date.now() - started;
      const costUsd = estimateCost(model, usage);
      const trace = {
        task_id: taskId,
        stage,
        model,
        adapter,
        input_summary: summarize(redactParts(parts)),
        output_summary: summarize(result),
        latency_ms: latency,
        usage: { ...usage, est_cost_usd: Number(costUsd.toFixed(6)) },
        ok: true,
        attempt,
        ts: new Date().toISOString(),
      };
      if (traceStore) await traceStore.put('ai_traces', `ait_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, trace);
      return { result, usage, latency_ms: latency, cost_usd: costUsd };
    } catch (err) {
      lastErr = err;
      const isTimeout = err.name === 'TimeoutError' || err.kind === 'timeout';
      log.warn('ai_call_failed', { stage, model, attempt, error: String(err.message).slice(0, 120) });
      if (traceStore) {
        await traceStore.put('ai_traces', `ait_${Date.now()}_err_${Math.random().toString(36).slice(2, 8)}`, {
          task_id: taskId, stage, model, adapter: mode(),
          input_summary: summarize(redactParts(parts)), output_summary: summarize(err.message),
          latency_ms: Date.now() - started, usage: { input_tokens: 0, output_tokens: 0, est_cost_usd: 0 },
          ok: false, attempt, error: String(err.message).slice(0, 200), ts: new Date().toISOString(),
        });
      }
      if (attempt === attempts) {
        if (isTimeout) throw new AppError('ERR_MODEL_TIMEOUT', { stage, model, attempts });
        if (lastErr.kind === 'invalid') throw new AppError('ERR_ENUM_INVALID', { stage, model, detail: lastErr.message });
        // An error that already carries a code and details (the policy guard,
        // for example) is rethrown unchanged so its diagnostics survive.
        if (lastErr instanceof AppError) throw lastErr;
        throw new AppError('ERR_MODEL_CALL_FAILED', { stage, model, attempts, detail: String(err.message).slice(0, 200) });
      }
      // Fatal upstream answers (bad request, bad key) never become transient by
      // retrying: stop immediately instead of burning latency and quota (D-17).
      if (err.kind === 'fatal') {
        if (lastErr instanceof AppError) throw lastErr;
        throw new AppError('ERR_MODEL_CALL_FAILED', { stage, model, attempts: attempt, detail: String(err.message).slice(0, 200) });
      }
      // Exponential backoff with jitter between retryable attempts (D-17).
      if (mode() !== 'mock') await new Promise((r) => setTimeout(r, Math.min(1000, 150 * 2 ** (attempt - 1)) * (0.5 + Math.random())));
    }
  }
  throw lastErr;
}

async function dispatch({ model, parts, schema, mockFn, mockContext, timeoutMs }) {
  if (mode() === 'mock') {
    if (!mockFn) throw new Error('mock mode requested but no mockFn provided');
    const usage = { input_tokens: 200, output_tokens: 40 };
    return { result: await mockFn(mockContext), usage, adapter: 'mock' };
  }
  const key = getSecret('GEMINI_API_KEY');
  if (!key) throw new Error('GEMINI_API_KEY not set');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0 },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      // The upstream body is deliberately NOT embedded: error text can carry
      // echoes of request payloads and must not reach traces or clients (D-08).
      throw Object.assign(new Error(`HTTP ${res.status} from model endpoint`), { kind: res.status >= 500 || res.status === 429 ? 'transient' : 'fatal' });
    }
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') ?? '';
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw Object.assign(new Error('model returned non-JSON despite structured mode'), { kind: 'invalid' });
    }
    const usage = {
      input_tokens: data.usageMetadata?.promptTokenCount ?? 0,
      output_tokens: data.usageMetadata?.candidatesTokenCount ?? 0,
    };
    return { result: parsed, usage, adapter: 'real' };
  } catch (err) {
    if (err.name === 'AbortError' || String(err.message) === 'timeout') {
      throw Object.assign(new Error('model call timed out'), { kind: 'timeout', name: 'TimeoutError' });
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Batched embedding calls (semantic index build). */
export async function embedTexts({ taskId, texts, traceStore }) {
  const cfg = getConfig().values;
  const model = cfg.EMBEDDING_MODEL;
  const started = Date.now();
  const all = [];
  if (mode() === 'mock') {
    for (const text of texts) all.push(await embedText({ taskId, text, traceStore: null }));
  } else {
    const key = getSecret('GEMINI_API_KEY');
    assertModelAllowed(model); // single-model policy, checked before any request
    for (let i = 0; i < texts.length; i += 50) {
      const chunk = texts.slice(i, i + 50);
      // A short vector response must never be accepted: the index is written
      // positionally, so missing vectors would silently corrupt it (D-18).
      let data = null;
      for (let attempt = 0; attempt < 2 && !data; attempt += 1) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(new Error('timeout')), cfg.AI_TIMEOUT_SECONDS * 1000);
        try {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:batchEmbedContents`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
            body: JSON.stringify({ requests: chunk.map((text) => ({ model: `models/${model}`, content: { parts: [{ text }] } })) }),
            signal: controller.signal,
          });
          if (!res.ok) throw new AppError('ERR_MODEL_CALL_FAILED', { stage: 'embedding-batch', status: res.status });
          const parsed = await res.json();
          if (!Array.isArray(parsed.embeddings) || parsed.embeddings.length !== chunk.length) {
            throw new AppError('ERR_MODEL_CALL_FAILED', { stage: 'embedding-batch', detail: `expected ${chunk.length} vectors, got ${parsed.embeddings?.length ?? 0}` });
          }
          data = parsed;
        } catch (err) {
          if (err.name === 'AbortError' || String(err.message) === 'timeout') {
            throw new AppError('ERR_MODEL_TIMEOUT', { stage: 'embedding-batch', model });
          }
          if (attempt === 1) throw err;
        } finally {
          clearTimeout(timer);
        }
      }
      for (const e of data.embeddings) all.push(e.values);
    }
  }
  if (traceStore) {
    await traceStore.put('ai_traces', `ait_${Date.now()}_batch_${Math.random().toString(36).slice(2, 8)}`, {
      task_id: taskId, stage: 'embedding', model, adapter: mode(),
      input_summary: `batch of ${texts.length} factor texts`, output_summary: `${all.length} vectors`,
      latency_ms: Date.now() - started,
      usage: { input_tokens: Math.ceil(texts.join(' ').length / 4), output_tokens: 0, est_cost_usd: 0 },
      ok: true, ts: new Date().toISOString(),
    });
  }
  return all;
}

/** Embedding call (semantic recall channel, Google official embedding model). */
export async function embedText({ taskId, text, traceStore }) {
  const cfg = getConfig().values;
  const model = cfg.EMBEDDING_MODEL;
  const started = Date.now();
  let result;
  if (mode() === 'mock') {
    // Deterministic hashing embedding — dimension 64, L2-normalized.
    const dims = 64;
    const v = new Array(dims).fill(0);
    for (let i = 0; i < text.length; i += 1) v[(text.charCodeAt(i) * (i + 7)) % dims] += 1;
    const norm = Math.sqrt(v.reduce((a, b) => a + b * b, 0)) || 1;
    result = v.map((x) => x / norm);
  } else {
    const key = getSecret('GEMINI_API_KEY');
    assertModelAllowed(model); // single-model policy, checked before any request
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('timeout')), cfg.AI_TIMEOUT_SECONDS * 1000);
    let res;
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ model: `models/${model}`, content: { parts: [{ text }] } }),
        signal: controller.signal,
      });
    } catch (err) {
      if (err.name === 'AbortError' || String(err.message) === 'timeout') {
        throw new AppError('ERR_MODEL_TIMEOUT', { stage: 'embedding', model });
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      // Upstream body omitted from the error on purpose (D-08).
      throw new AppError('ERR_MODEL_CALL_FAILED', { stage: 'embedding', status: res.status });
    }
    const data = await res.json();
    result = data.embedding?.values;
    if (!Array.isArray(result)) throw new AppError('ERR_MODEL_CALL_FAILED', { stage: 'embedding', detail: 'no vector' });
  }
  if (traceStore) {
    await traceStore.put('ai_traces', `ait_${Date.now()}_emb_${Math.random().toString(36).slice(2, 8)}`, {
      task_id: taskId, stage: 'embedding', model, adapter: mode(),
      input_summary: summarize(text, 120), output_summary: `vector[${result.length}]`,
      latency_ms: Date.now() - started,
      usage: { input_tokens: Math.ceil(text.length / 4), output_tokens: 0, est_cost_usd: 0 },
      ok: true, ts: new Date().toISOString(),
    });
  }
  return result;
}
