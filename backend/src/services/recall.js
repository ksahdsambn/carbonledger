// Candidate recall (T-021, PRD 4.7 stage 1, FR-604): keyword channel +
// semantic vector channel, independently toggleable, merged and deduplicated
// to a 5-15 candidate window with automatic threshold relaxation and
// insufficient-recall flagging. Vectors come from the Google official
// embedding model via the unified AI wrapper (mock adapter hashes in dev).
import { log } from '../logging.js';
import { embedText, mode } from '../ai/client.js';

export function cosine(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

export function factorText(f) {
  return `${f.name}. ${f.description} Activity type: ${f.activity_type}. Boundary: ${f.system_boundary}.`;
}

function queryTerms(record) {
  const text = `${record.item_description || ''} ${record.transport_mode || ''} ${
    record.origin_location || ''} ${record.destination_location || ''}`.toLowerCase();
  const stop = new Set(['of', 'the', 'and', 'for', 'to', 'from', 'with', 'a', 'an', 'in', 'by', 'per', 'on']);
  return [...new Set(text.split(/[^a-z0-9]+/).filter((t) => t.length > 2 && !stop.has(t)))];
}

function keywordScores(factors, terms, relaxed) {
  const scores = new Map();
  for (const f of factors) {
    const hay = factorText(f).toLowerCase();
    let hits = 0;
    for (const t of terms) {
      if (hay.includes(t)) hits += 1;
      else if (relaxed && terms.length > 1) {
        // relaxed: allow prefix matches on the most specific tokens
        if (hay.includes(t.slice(0, Math.max(4, t.length - 2)))) hits += 0.5;
      }
    }
    if (hits > 0) scores.set(f.factor_id, hits / terms.length + (f.priority === 1 ? 0.02 : 0));
  }
  return scores;
}

/**
 * Builds (or rebuilds) the in-process semantic index over the factor store.
 */
export async function buildSemanticIndex({ store, taskId = 'index-build' }) {
  const factors = await store.list('emission_factors');
  let built = 0;
  for (const f of factors) {
    if (Array.isArray(f.embedding) && f.embedding.length > 0) continue;
    const vec = await embedText({ taskId, text: factorText(f), traceStore: store });
    await store.put('emission_factors', f.factor_id, { ...f, embedding: vec });
    built += 1;
  }
  log.info('semantic_index_built', { total: factors.length, newly_embedded: built, adapter: mode() });
  return { total: factors.length, newly_embedded: built };
}

/**
 * Recalls 5-15 candidates for one record.
 * @param {object} o
 * @param {'both'|'keyword'|'semantic'} o.channel
 */
export async function recallCandidates({ store, record, channel = process.env.RECALL_CHANNEL || 'both', taskId }) {
  const factors = (await store.list('emission_factors')).map(({ embedding, ...f }) => f);
  const vectors = new Map((await store.list('emission_factors')).map((f) => [f.factor_id, f.embedding]));
  const terms = queryTerms(record);
  log.info('recall_started', { task_id: taskId, channel, terms });

  const attempt = (relaxed) => {
    const merged = new Map(); // id -> {factor, score, sources}
    if (channel === 'both' || channel === 'keyword') {
      for (const [id, s] of keywordScores(factors, terms, relaxed)) {
        merged.set(id, { factor_id: id, score: s, sources: ['keyword'] });
      }
    }
    return merged;
  };

  const runSemantic = async (merged) => {
    if (channel !== 'both' && channel !== 'semantic') return merged;
    const qv = await embedText({ taskId, text: factorText({ ...record, name: record.item_description }), traceStore: store });
    const sims = factors.map((f) => ({ id: f.factor_id, sim: vectors.get(f.factor_id) ? cosine(qv, vectors.get(f.factor_id)) : -1 }))
      .sort((a, b) => b.sim - a.sim);
    const top = sims.slice(0, 30);
    for (const { id, sim } of top) {
      const existing = merged.get(id);
      if (existing) {
        existing.score += sim;
        existing.sources.push('semantic');
      } else {
        merged.set(id, { factor_id: id, score: sim, sources: ['semantic'] });
      }
    }
    return merged;
  };

  let merged = attempt(false);
  merged = await runSemantic(merged);
  let relaxedRetried = false;
  if (merged.size < 5) {
    log.warn('recall_threshold_relaxed', { task_id: taskId, before: merged.size });
    merged = attempt(true);
    merged = await runSemantic(merged);
    relaxedRetried = true;
  }

  const ranked = [...merged.values()].sort((a, b) => b.score - a.score);
  const window = ranked.slice(0, 15);
  const insufficient = merged.size < 5;
  if (insufficient) log.warn('recall_insufficient', { task_id: taskId, count: merged.size });
  return {
    candidates: window.map((c) => ({
      ...c,
      factor: factors.find((f) => f.factor_id === c.factor_id),
    })),
    candidate_count: window.length,
    insufficient_recall: insufficient,
    relaxed_retry: relaxedRetried,
    channel,
    terms,
  };
}
