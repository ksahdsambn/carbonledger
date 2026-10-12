// Metric definitions for the evaluation tool (PRD 10.1). Every metric of the
// evaluation table is declared once here; collectors fill in measured values
// as the pipeline stages come online.

export const METRICS = [
  {
    id: 'classification_top1',
    group: 'classification',
    name: 'Document classification accuracy (Top-1)',
    target: '>= 93% (>= 28 of 30 Golden documents)',
    mandatory: true,
  },
  {
    id: 'field_extraction_accuracy',
    group: 'extraction',
    name: 'Field extraction accuracy (quantity, unit, amount, date, currency)',
    target: 'average >= 95%; quantity and unit >= 98%',
    mandatory: true,
  },
  {
    id: 'factor_match_top1',
    group: 'matching',
    name: 'Factor matching accuracy (Top-1)',
    target: '>= 85% (>= 34 of 40 Golden cases)',
    mandatory: true,
  },
  {
    id: 'factor_match_top3',
    group: 'matching',
    name: 'Factor matching accuracy (Top-3 hit)',
    target: '>= 95% (>= 38 of 40 Golden cases)',
    mandatory: false,
  },
  {
    id: 'scope_decision_accuracy',
    group: 'boundary',
    name: 'Scope decision accuracy (scope level 10 cases and Scope 3 category 12 cases, each >= 90%)',
    target: '>= 90% on both subsets',
    mandatory: true,
  },
  {
    id: 'calculation_correctness',
    group: 'calculation',
    name: 'Calculation correctness (3-decimal display precision, zero tolerance)',
    target: '100%',
    mandatory: true,
  },
  {
    id: 'aggregation_consistency',
    group: 'calculation',
    name: 'Aggregation consistency (sum of parts equals total at 3-decimal display precision)',
    target: '0 inconsistencies',
    mandatory: true,
  },
  {
    id: 'report_citation_coverage',
    group: 'report',
    name: 'Report citation coverage',
    target: '100%',
    mandatory: true,
  },
  {
    id: 'invalid_references',
    group: 'report',
    name: 'Invalid reference count (hallucination veto)',
    target: '0 (non-zero vetoes the overall verdict)',
    mandatory: true,
    veto: true,
  },
  {
    id: 'e2e_latency_p90',
    group: 'performance',
    name: 'End-to-end latency for 20 documents (P90)',
    target: '<= 3 minutes',
    mandatory: true,
  },
  {
    id: 'ai_cost_per_document',
    group: 'performance',
    name: 'AI processing cost per document',
    target: '<= USD 0.03',
    mandatory: true,
  },
];

export const METRIC_GROUPS = [...new Set(METRICS.map((m) => m.group))];
