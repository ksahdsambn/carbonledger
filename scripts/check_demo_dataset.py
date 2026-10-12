#!/usr/bin/env python
"""T-010 verification: demo dataset integrity + G1 gate conditions."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
man = json.loads((ROOT / "data/demo/manifest.json").read_text(encoding="utf-8"))
recs = json.loads((ROOT / "data/demo/expected_records.json").read_text(encoding="utf-8"))
failures = []

# 1 — file count and format coverage
docs = man["documents"]
assert len(docs) == 20, len(docs)
fmts = {d["format"] for d in docs}
assert fmts == {"pdf", "jpg", "png", "xlsx", "csv"}, fmts
for d in docs:
    assert (ROOT / d["file"]).is_file(), d["file"]
print(f"[1] documents=20 formats=5 files_on_disk=OK")

# 2 — expected results: Scope 1 x2, Scope 2 x2, Scope 3 >= 6 categories
exp = man["expected_results"]
assert exp["record_count"] == 20 == len(recs)
assert exp["scope_breakdown"] == {"Scope 1": 2, "Scope 2": 2, "Scope 3": 16}
assert len(exp["scope3_category_coverage"]) >= 6
assert sum(exp["scope3_category_coverage"].values()) == 16
# every expected scope map entry has a matching record
rids = {r["record_id"] for r in recs}
assert set(man["expected_scope_map"]) == rids, set(man["expected_scope_map"]) ^ rids
print(f"[2] records=20 scope_breakdown={exp['scope_breakdown']} "
      f"scope3_categories={len(exp['scope3_category_coverage'])}")

# 3 — G1 gate: factor library queryable + Golden complete
golden_man = json.loads((ROOT / "data/golden/manifest.json").read_text(encoding="utf-8"))
assert golden_man["records_count"] == 30 and golden_man["cases_count"] == 40
for f in golden_man["documents"]:
    assert (ROOT / f["file"]).is_file(), f["file"]
for f in golden_man["answers"].values():
    assert (ROOT / f).is_file(), f
lib = json.loads((ROOT / "data/factors/emission_factors.json").read_text(encoding="utf-8"))
assert lib["meta"]["total_factors"] == len(lib["factors"]) >= 200
print(f"[3] G1: golden=30docs/30records/40cases on disk; factor library "
      f"{len(lib['factors'])} factors loadable offline")

if failures:
    print("RESULT: FAIL"); raise SystemExit(1)
print("RESULT: PASS — G1 conditions met")
