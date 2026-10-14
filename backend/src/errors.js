// Global error code registry (PRD NFR-204). Every failure path in every
// module must raise AppError with one of these codes; the codes are the
// machine-readable contract surfaced to clients and the evaluation tool.

export const ERROR_CODES = {
  ERR_FILE_FORMAT_UNSUPPORTED: {
    http: 415,
    message: 'Unsupported file format. Allowed formats are PDF, JPG, PNG, XLSX and CSV.',
  },
  ERR_FILE_TOO_LARGE: {
    http: 413,
    message: 'File exceeds the 10 MB per-file size limit.',
  },
  ERR_FILE_CORRUPT: {
    http: 422,
    message: 'The file is corrupted and cannot be processed.',
  },
  ERR_PARSE_FAILED: {
    http: 422,
    message: 'The document could not be parsed.',
  },
  ERR_EXTRACTION_FAILED: {
    http: 422,
    message: 'Activity data extraction failed for this document.',
  },
  ERR_MODEL_CALL_FAILED: {
    http: 502,
    message: 'The AI model call failed after all retry attempts.',
  },
  ERR_MODEL_TIMEOUT: {
    http: 504,
    message: 'The AI model call timed out after all retry attempts.',
  },
  ERR_ENUM_INVALID: {
    http: 422,
    message: 'The model returned a value outside the allowed enumeration.',
  },
  ERR_CANDIDATES_INSUFFICIENT: {
    http: 200,
    message: 'Fewer than five candidate factors were recalled; the record is flagged with an insufficient-recall marker.',
  },
  ERR_NO_CONFIDENT_FACTOR: {
    http: 200,
    message: 'No candidate factor reached the confidence threshold; the record requires manual confirmation.',
  },
  ERR_REFERENCE_INVALID: {
    http: 422,
    message: 'A reference points to an object that does not exist.',
  },
  ERR_STORAGE_ACCESS: {
    http: 502,
    message: 'Object storage or database access failed.',
  },
  ERR_TASK_NOT_FOUND: {
    http: 404,
    message: 'The requested accounting task does not exist.',
  },
  ERR_FORBIDDEN: {
    http: 403,
    message: 'This task belongs to another identity; access is denied.',
  },
  ERR_RATE_LIMITED: {
    http: 429,
    message: 'Too many requests; please slow down.',
  },
};

export class AppError extends Error {
  /**
   * @param {keyof typeof ERROR_CODES} code
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, details = {}) {
    const def = ERROR_CODES[code];
    if (!def) throw new Error(`Unknown error code '${code}'`);
    super(def.message);
    this.name = 'AppError';
    this.code = code;
    this.http = def.http;
    this.details = details;
  }
}

/** Maps any thrown value to a safe JSON body + HTTP status. */
export function errorResponse(err) {
  if (err instanceof AppError) {
    return { status: err.http, body: { error: { code: err.code, message: err.message, details: err.details } } };
  }
  return {
    status: 500,
    body: { error: { code: 'ERR_INTERNAL', message: 'An unexpected internal error occurred.' } },
  };
}
