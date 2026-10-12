// Builds the offline-development mock catalog for the demo dataset: expected
// classifications, records, boundaries per document filename. Used only when
// the AI adapter is 'mock'; accuracy metrics never read from mock runs.
import { join } from 'node:path';

export function buildMockCatalogFromDataset(demoDir, readFileSync) {
  const manifest = JSON.parse(readFileSync(join(demoDir, 'manifest.json'), 'utf8'));
  const expected = JSON.parse(readFileSync(join(demoDir, 'expected_records.json'), 'utf8'));
  const catalog = new Map();
  for (const d of manifest.documents) {
    const file = d.file.split('/').pop();
    const records = expected.filter((r) => r.source_ref.startsWith(d.records[0] ?? '###'));
    if (d.records.length === 0) { catalog.set(file, { classification: d.doc_type, records: [] }); continue; }
    const entries = d.records.map((rid) => {
      const rec = expected.find((r) => r.record_id === rid);
      const scopeMap = manifest.expected_scope_map[rid];
      return {
        ...rec,
        expected_boundary: scopeMap
          ? { scope: scopeMap[0], category: scopeMap[1] ?? null,
              rationale: `Demo mock boundary: ${scopeMap[0]}${scopeMap[1] ? ` ${scopeMap[1]}` : ''} assignment from the demo ground truth.` }
          : undefined,
      };
    });
    catalog.set(file, { classification: d.doc_type, records: entries });
  }
  return catalog;
}
