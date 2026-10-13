// Tests for the central configuration module (T-002 verification 1 & 2).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig, CONFIG_DEFINITIONS } from '../src/config.js';

test('config exposes exactly the 11 PRD 8.3 parameters with defaults', () => {
  const { entries, values } = loadConfig({});
  assert.equal(CONFIG_DEFINITIONS.length, 11);
  const expectedKeys = [
    'EXTRACTION_MODEL',
    'REASONING_MODEL',
    'EMBEDDING_MODEL',
    'BATCH_SIZE',
    'CLASSIFICATION_CONFIDENCE_THRESHOLD',
    'FACTOR_MATCH_CONFIDENCE_THRESHOLD',
    'AI_RETRY_COUNT',
    'AI_TIMEOUT_SECONDS',
    'DEFAULT_GWP_VERSION',
    'STORAGE_BUCKET_NAME',
    'GCP_PROJECT_ID',
  ];
  assert.deepEqual(Object.keys(values).sort(), expectedKeys.sort());
  assert.equal(values.EXTRACTION_MODEL, 'gemini-3.5-flash-lite');
  assert.equal(values.REASONING_MODEL, 'gemini-3.5-flash-lite'); // user-mandated single-model policy
  assert.equal(values.EMBEDDING_MODEL, 'gemini-embedding-001');
  assert.equal(values.BATCH_SIZE, 10);
  assert.equal(values.CLASSIFICATION_CONFIDENCE_THRESHOLD, 0.7);
  assert.equal(values.FACTOR_MATCH_CONFIDENCE_THRESHOLD, 0.65);
  assert.equal(values.AI_RETRY_COUNT, 2);
  assert.equal(values.AI_TIMEOUT_SECONDS, 60);
  assert.equal(values.DEFAULT_GWP_VERSION, 'AR6');
  assert.equal(values.STORAGE_BUCKET_NAME, 'carbonledger-files');
  assert.equal(values.GCP_PROJECT_ID, 'carbonledger');
  // Every definition documents its env override and description.
  for (const def of CONFIG_DEFINITIONS) {
    assert.equal(def.key, def.env ?? def.key);
    assert.ok(def.description && def.description.length > 0);
    assert.equal(entries[def.key].overriddenByEnv, false);
  }
});

test('environment variables override defaults and types are coerced', () => {
  const { values, entries } = loadConfig({
    EXTRACTION_MODEL: 'gemini-2.0-flash',
    BATCH_SIZE: '3',
    FACTOR_MATCH_CONFIDENCE_THRESHOLD: '0.9',
  });
  assert.equal(values.EXTRACTION_MODEL, 'gemini-2.0-flash');
  assert.equal(values.BATCH_SIZE, 3);
  assert.ok(Number.isInteger(values.BATCH_SIZE));
  assert.equal(values.FACTOR_MATCH_CONFIDENCE_THRESHOLD, 0.9);
  assert.equal(entries.EXTRACTION_MODEL.overriddenByEnv, true);
  assert.equal(entries.BATCH_SIZE.overriddenByEnv, true);
  // Non-overridden keys keep defaults.
  assert.equal(values.DEFAULT_GWP_VERSION, 'AR6');
});

test('empty-string env values fall back to defaults', () => {
  const { values } = loadConfig({ BATCH_SIZE: '' });
  assert.equal(values.BATCH_SIZE, 10);
});
