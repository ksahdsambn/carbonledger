// Metric collectors. Each collector looks for its evidence file under the
// results directory; when a stage has not produced evidence yet the metric is
// reported as not measured (which counts as FAIL for mandatory metrics —
// an unmeasured pipeline is not a passing pipeline).

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * @param {string} resultsDir
 * @param {Record<string, string>} files metric id -> relative file name
 */
export function makeCollector(resultsDir, files) {
  return {
    /**
     * @returns {{measured: string, pass: boolean, evidence: string}}
     */
    collect(metricId) {
      const file = files[metricId];
      const path = join(resultsDir, file);
      if (!file || !existsSync(path)) {
        return { measured: '', pass: false, evidence: 'not yet produced' };
      }
      const data = JSON.parse(readFileSync(path, 'utf8'));
      return {
        measured: String(data.measured),
        pass: Boolean(data.pass),
        evidence: data.evidence || path,
      };
    },
  };
}
