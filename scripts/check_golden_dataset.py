#!/usr/bin/env python
"""T-008 verification: Golden dataset completeness and integrity."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
failures = []

man = json.loads((ROOT / "data/golden/manifest.json").read_text(encoding="utf-8"))
cls = json.loads((ROOT / "data/golden/answers/doc_classifications.json").read_text(encoding="utf-8"))
recs = json.loads((ROOT / "data/golden/answers/activity_records.json").read_text(encoding="utf-8"))
cases = json.loads((ROOT / "data/golden/answers/matching_cases.json").read_text(encoding="utf-8"))
anoms = json.loads((ROOT / "data/golden/answers/anomalies.json").read_text(encoding="utf-8"))
lib = {f["factor_id"] for f in json.loads(
    (ROOT / "data/factors/emission_factors.json").read_text(encoding="utf-8"))["factors"]}

# 1 — document count, type coverage, mixed PDF, handwritten, blurry, formats
docs = man["documents"]
assert len(docs) == 30, f"doc count {len(docs)}"
fmts = {d["format"] for d in docs}
assert fmts == {"pdf", "jpg", "png", "xlsx", "csv"}, fmts
types = {p["doc_type"] for p in cls}
assert types == {"supplier_invoice", "purchase_order", "logistics_waybill", "utility_bill",
                 "travel_expense", "packing_list", "other"}, types
mixed = [d for d in docs if d["id"] == "GD-09"][0]
assert mixed["pages"] == 4
mixed_types = {p["doc_type"] for p in cls if p["document_id"] == "GD-09"}
assert len(mixed_types) == 3, mixed_types
handwritten = [d for d in docs if d["style"] == "handwritten"]
blurry = [d for d in docs if d["style"] == "blurry"]
assert len(handwritten) >= 3, len(handwritten)
assert len(blurry) >= 3, len(blurry)
missing_field_docs = {r["source_ref"].split("#")[0] for r in recs
                      if r.get("extraction_notes") and "missing" in r["extraction_notes"]
                      or r.get("extraction_notes") and "not stated" in r["extraction_notes"]}
assert len(missing_field_docs) >= 5, missing_field_docs
# files actually exist on disk
for d in docs:
    assert (ROOT / d["file"]).is_file(), d["file"]
print(f"[1] documents=30 formats=5 types=7 mixed_pdf=4pages/3types handwritten={len(handwritten)} "
      f"blurry={len(blurry)} missing_field_docs={len(missing_field_docs)} files=OK")

# 2 — record field names exactly match the PRD 4.3 table (17 fields)
FIELDS = ["record_id", "source_ref", "doc_type", "supplier_name", "item_description",
          "quantity", "unit", "amount", "currency", "activity_date", "origin_location",
          "destination_location", "transport_mode", "gross_weight_kg", "distance_km",
          "field_confidence", "extraction_notes"]
assert len(recs) == 30, len(recs)
for r in recs:
    if set(r.keys()) != set(FIELDS):
        failures.append(f"{r['record_id']} field set mismatch: {set(r.keys()) ^ set(FIELDS)}")
# transport records: mode + origin + destination + weight present
transport = [r for r in recs if r["transport_mode"] not in (None, "Not applicable")]
for r in transport:
    for k in ("origin_location", "destination_location", "gross_weight_kg", "distance_km"):
        if r[k] is None:
            failures.append(f"transport record {r['record_id']} missing {k}")
print(f"[2] records=30 fields_exact={not failures} transport_records={len(transport)}")

# 3 — every case factor id exists in the library; refs resolve
for c in cases:
    if c["best_factor_id"] not in lib:
        failures.append(f"{c['case_id']} best id not in library")
    if c["runner_up_factor_id"] not in lib:
        failures.append(f"{c['case_id']} runner id not in library")
    if c["best_factor_id"] == c["runner_up_factor_id"]:
        failures.append(f"{c['case_id']} best == runner")
rec_ids = {r["record_id"] for r in recs} | {c["record"]["record_id"] for c in cases}
for c in cases:
    if c["record_ref"] not in rec_ids:
        failures.append(f"{c['case_id']} dangling record ref")
print(f"[3] cases=40 factor_ids_valid={not failures}")

# 4 — five difficulty classes, each >= 6
from collections import Counter
diff = Counter(c["difficulty"] for c in cases)
expected = {"exact_match", "boundary_inference", "unit_conversion",
            "semantic_inference", "boundary_caliber"}
assert set(diff) == expected, diff
for k, v in diff.items():
    if v < 6:
        failures.append(f"difficulty {k} has {v} < 6")
print(f"[4] difficulty_counts={dict(diff)}")

# 5 — three anomaly entries with files present
kinds = {a["kind"] for a in anoms}
assert kinds == {"corrupt_file", "missing_required_fields", "duplicate_upload"}, kinds
for a in anoms:
    assert (ROOT / "data/golden/anomalies" / Path(a["file"]).name).is_file(), a["file"]
print(f"[5] anomalies=3 files=OK")

if failures:
    print("RESULT: FAIL")
    for f in failures[:10]:
        print("  -", f)
    raise SystemExit(1)
print("RESULT: PASS")
