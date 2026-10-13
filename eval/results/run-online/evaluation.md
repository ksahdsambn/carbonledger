| Metric | Target | Measured | Result |
|---|---|---|---|
| Document classification accuracy (Top-1) | >= 93% (>= 28 of 30 Golden documents) | 29/30 documents (96.7%), pages 32/33 | PASS |
| Field extraction accuracy (quantity, unit, amount, date, currency) | average >= 95%; quantity and unit >= 98% | avg 100.0%, quantity 100.0%, unit 100.0% | PASS |
| Factor matching accuracy (Top-1) | >= 85% (>= 34 of 40 Golden cases) | 34/40 (85.0%) | PASS |
| Factor matching accuracy (Top-3 hit) | >= 95% (>= 38 of 40 Golden cases) | 39/40 (97.5%) | PASS |
| Scope decision accuracy (scope level 10 cases and Scope 3 category 12 cases, each >= 90%) | >= 90% on both subsets | scope 9/10, category 12/12 | PASS |
| Calculation correctness (3-decimal display precision, zero tolerance) | 100% | 10/10 exact at 3-decimal display | PASS |
| Aggregation consistency (sum of parts equals total at 3-decimal display precision) | 0 inconsistencies | 0 inconsistencies (4 dimensions, display-consistent parts) | PASS |
| Report citation coverage | 100% | 100% | PASS |
| Invalid reference count (hallucination veto) | 0 (non-zero vetoes the overall verdict) | 0 | PASS |
| End-to-end latency for 20 documents (P90) | <= 3 minutes | 66.8s (P90 of 10 public one-click runs) | PASS |
| AI processing cost per document | <= USD 0.03 | $0.00059/document (102 model calls, $0.0118 total over 20 documents) | PASS |
| **Summary** | rows=11 | passed=11 failed=0 | **PASS** |
