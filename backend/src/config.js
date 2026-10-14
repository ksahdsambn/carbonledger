// Central configuration — the single source of truth for every service
// parameter required by PRD section 8.3. Each entry defines the default
// value and the environment variable that overrides it. No other module
// in this codebase may hardcode any of these settings.

const DEFINITIONS = [
  {
    key: 'EXTRACTION_MODEL',
    type: 'string',
    default: 'gemini-3.5-flash-lite',
    description: 'Gemini Flash-Lite model used for document classification and field extraction (user-mandated single-model policy)',
  },
  {
    key: 'REASONING_MODEL',
    type: 'string',
    default: 'gemini-3.5-flash-lite',
    description: 'Factor selection and report generation model (user mandate: only gemini-3.5-flash-lite may be called)',
  },
  {
    key: 'EMBEDDING_MODEL',
    type: 'string',
    default: 'gemini-embedding-001',
    description: 'Google Cloud official text embedding model used for semantic recall',
  },
  {
    key: 'AI_MODEL_ALLOWLIST',
    type: 'string',
    default: 'gemini-3.5-flash-lite,gemini-embedding-001',
    description: 'Models a real call may use (comma separated). The single-model mandate permits only gemini-3.5-flash-lite for generative work plus the official embedding model; widening this list is a config change, never a code change',
  },
  {
    key: 'BATCH_SIZE',
    type: 'int',
    default: 10,
    description: 'Number of units processed per batch call',
  },
  {
    key: 'CLASSIFICATION_CONFIDENCE_THRESHOLD',
    type: 'float',
    default: 0.7,
    description: 'Document classification confidence below this routes to manual confirmation',
  },
  {
    key: 'FACTOR_MATCH_CONFIDENCE_THRESHOLD',
    type: 'float',
    default: 0.65,
    description: 'Factor match confidence threshold; below it a record is flagged as having no high-confidence factor',
  },
  {
    key: 'AI_RETRY_COUNT',
    type: 'int',
    default: 2,
    description: 'Automatic retries for each AI model call before marking the target failed',
  },
  {
    key: 'AI_TIMEOUT_SECONDS',
    type: 'int',
    default: 60,
    description: 'Timeout in seconds for a single AI model call attempt',
  },
  {
    key: 'DEFAULT_GWP_VERSION',
    type: 'string',
    default: 'AR6',
    description: 'Default GWP version for new accounting tasks (AR5 or AR6)',
  },
  {
    key: 'STORAGE_BUCKET_NAME',
    type: 'string',
    default: 'carbonledger-files',
    description: 'Object storage bucket for original uploaded files',
  },
  {
    key: 'GCP_PROJECT_ID',
    type: 'string',
    default: 'carbonledger',
    description: 'Google Cloud project identifier',
  },
];

// Secrets are read from the environment only; they have no defaults and are
// never included in any printed configuration output.
const SECRET_ENV_VARS = ['GEMINI_API_KEY', 'GOOGLE_APPLICATION_CREDENTIALS'];

// Numeric sanity ranges (D-16): an env value that parses to NaN, Infinity or
// an out-of-range number would otherwise silently disable retries, starve the
// pipeline worker pool or break threshold logic. Invalid values fall back to
// the documented default with a warning instead of taking effect.
const RANGES = {
  BATCH_SIZE: [1, 1000],
  CLASSIFICATION_CONFIDENCE_THRESHOLD: [0, 1],
  FACTOR_MATCH_CONFIDENCE_THRESHOLD: [0, 1],
  AI_RETRY_COUNT: [0, 10],
  AI_TIMEOUT_SECONDS: [1, 600],
};

// D-63: parseInt/parseFloat accept a numeric prefix ('60abc' -> 60, '7.5' -> 7),
// so a malformed value was applied silently instead of falling back. The whole
// string must be a finite number, and an int must be written as an integer;
// anything else yields NaN and trips the range guard below.
function coerce(value, type) {
  if (type !== 'int' && type !== 'float') return value;
  const s = String(value).trim();
  const n = s === '' ? NaN : Number(s);
  if (!Number.isFinite(n)) return NaN;
  return type === 'int' && !Number.isInteger(n) ? NaN : n;
}

/**
 * Load configuration from an environment (defaults to process.env).
 * Returns { entries, values } where entries carry per-key metadata for
 * inspection and values is a plain key->value map.
 */
export function loadConfig(env = process.env) {
  const entries = {};
  const values = {};
  for (const def of DEFINITIONS) {
    const fromEnv = env[def.key] !== undefined && env[def.key] !== '';
    const raw = fromEnv ? env[def.key] : def.default;
    let value = coerce(raw, def.type);
    const range = RANGES[def.key];
    if (range && (!Number.isFinite(value) || value < range[0] || value > range[1])) {
      console.error(JSON.stringify({ ts: new Date().toISOString(), level: 'warn', event: 'config_value_invalid', key: def.key, raw: String(raw), fallback: def.default }));
      value = def.default;
    }
    entries[def.key] = {
      ...def,
      value,
      overriddenByEnv: fromEnv,
    };
    values[def.key] = value;
  }
  Object.freeze(entries);
  Object.freeze(values);
  return { entries, values };
}

let current = null;

/** Returns the cached config for process.env (loaded once). */
export function getConfig() {
  if (!current) current = loadConfig(process.env);
  return current;
}

/** Returns a secret value from the environment, or null if not set. */
export function getSecret(name) {
  if (!SECRET_ENV_VARS.includes(name)) {
    throw new Error(`Unknown secret '${name}'`);
  }
  const v = process.env[name];
  return v && v.length > 0 ? v : null;
}

export const CONFIG_DEFINITIONS = DEFINITIONS;
