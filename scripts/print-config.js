#!/usr/bin/env node
// Prints every central configuration parameter (PRD 8.3) with its current
// value, default, override source and description. Used by T-002
// verification and the deployment configuration audit.
import { loadConfig } from '../backend/src/config.js';

const { entries } = loadConfig(process.env);
console.log('key | value | default | overriddenByEnv | description');
for (const [key, e] of Object.entries(entries)) {
  console.log(`${key} | ${e.value} | ${e.default} | ${e.overriddenByEnv} | ${e.description}`);
}
