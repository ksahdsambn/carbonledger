// Tests for the error registry (PRD NFR-204 coverage baseline).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ERROR_CODES, AppError, errorResponse } from '../src/errors.js';

test('error registry covers every known failure type with code + English text', () => {
  const requiredCodes = [
    'ERR_FILE_FORMAT_UNSUPPORTED',
    'ERR_FILE_TOO_LARGE',
    'ERR_FILE_CORRUPT',
    'ERR_PARSE_FAILED',
    'ERR_EXTRACTION_FAILED',
    'ERR_MODEL_CALL_FAILED',
    'ERR_MODEL_TIMEOUT',
    'ERR_ENUM_INVALID',
    'ERR_CANDIDATES_INSUFFICIENT',
    'ERR_NO_CONFIDENT_FACTOR',
    'ERR_REFERENCE_INVALID',
    'ERR_STORAGE_ACCESS',
    'ERR_TASK_NOT_FOUND',
  ];
  for (const code of requiredCodes) {
    assert.ok(ERROR_CODES[code], `missing ${code}`);
    assert.ok(/^[A-Z]/.test(ERROR_CODES[code].message), `${code} message must start capitalized`);
    assert.ok(typeof ERROR_CODES[code].http === 'number');
  }
});

test('AppError and errorResponse produce machine-readable envelopes', () => {
  const err = new AppError('ERR_FILE_TOO_LARGE', { size: 11534336 });
  assert.equal(err.code, 'ERR_FILE_TOO_LARGE');
  assert.equal(err.http, 413);
  const { status, body } = errorResponse(err);
  assert.equal(status, 413);
  assert.equal(body.error.code, 'ERR_FILE_TOO_LARGE');
  assert.ok(body.error.message.length > 10);
  const fallback = errorResponse(new Error('boom'));
  assert.equal(fallback.status, 500);
  assert.equal(fallback.body.error.code, 'ERR_INTERNAL');
});
