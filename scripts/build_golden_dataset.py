#!/usr/bin/env python
"""Build the Golden Case dataset (T-008): documents, answer files, anomalies,
manifest, and the evaluation-tool registry. Deterministic; resolve-or-die on
factor predicates so every Golden factor id exists in the built library."""
import json
import re
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from golden import render_docs as R
from golden.curated_data import DOCS, RECORDS, CASES, CONSTRUCTED_RECORDS, ANOMALIES, TABLE_DOCS

ROOT = Path(__file__).resolve().parent.parent
DOC_DIR = ROOT / "data/golden/documents"
ANS_DIR = ROOT / "data/golden/answers"
ANOM_DIR = ROOT / "data/golden/anomalies"
LIB = json.loads((ROOT / "data/factors/emission_factors.json").read_text(encoding="utf-8"))["factors"]

def resolve(pred):
    """Exactly-one factor resolution; dies loudly otherwise."""
    regex, activity_type = pred
    hits = [f for f in LIB if re.search(regex, f["name"]) and f["activity_type"] == activity_type]
    if len(hits) != 1:
        cands = [f["factor_id"] + " | " + f["name"][:70] for f in
                 [f for f in LIB if re.search(regex, f["name"])][:6]]
        raise SystemExit(f"predicate {regex!r}/{activity_type} matched {len(hits)} factors\n" +
                         "\n".join(cands))
    return hits[0]["factor_id"]

def main():
    DOC_DIR.mkdir(parents=True, exist_ok=True)
    ANS_DIR.mkdir(parents=True, exist_ok=True)
    ANOM_DIR.mkdir(parents=True, exist_ok=True)

    # --- render documents ---
    for d in DOCS:
        path = DOC_DIR / d["file"]
        if d["fmt"] == "pdf":
            R.save_pdf([{"args": (p["lines"], d["style"]), "seed": hash(d["id"]) % 9999}
                        for p in d["pages"]], path)
        elif d["fmt"] in ("jpg", "png"):
            R.save_image(d["pages"][0]["lines"], path, style=d["style"], seed=hash(d["id"]) % 9999)
        elif d["fmt"] == "xlsx":
            R.save_xlsx(TABLE_DOCS[d["id"]], path)
        elif d["fmt"] == "csv":
            R.save_csv(TABLE_DOCS[d["id"]], path)

    # --- anomalies ---
    R.save_corrupt_pdf(ANOM_DIR / "AN-01_corrupted.pdf")
    (ANOM_DIR / "AN-02_missing_required.csv").write_text(
        "Invoice from Meridian Logistics\nperiod,description\n2026-06,Warehouse handling service fee\n",
        encoding="utf-8")
    shutil.copyfile(DOC_DIR / "GD-01_invoice_metal_scan.pdf", ANOM_DIR / "AN-03_duplicate_of_GD01.pdf")

    # --- answers: group 1 classifications ---
    classifications = []
    for d in DOCS:
        if d["fmt"] == "pdf":
            pages = [{"document_id": d["id"], "page": i + 1, "doc_type": p["doc_type"]}
                     for i, p in enumerate(d["pages"])]
        else:
            pages = [{"document_id": d["id"], "page": 1, "doc_type": d["pages"][0]["doc_type"]}]
        classifications.extend(pages)
    (ANS_DIR / "doc_classifications.json").write_text(
        json.dumps(classifications, indent=1), encoding="utf-8")

    # --- answers: group 2 records ---
    (ANS_DIR / "activity_records.json").write_text(
        json.dumps(RECORDS, indent=1), encoding="utf-8")

    # --- answers: group 3 matching cases with resolved factor ids ---
    by_ref = {r["record_id"]: r for r in RECORDS}
    by_ref.update({r["record_id"]: r for r in CONSTRUCTED_RECORDS})
    cases_out = []
    for c in CASES:
        rec_id = c["record_ref"]
        cases_out.append({
            "case_id": c["case_id"],
            "record_ref": rec_id,
            "record": by_ref[rec_id],
            "difficulty": c["difficulty"],
            "best_factor_id": resolve(c["best"]),
            "runner_up_factor_id": resolve(c["runner_up"]),
            "note": c["note"],
        })
    (ANS_DIR / "matching_cases.json").write_text(
        json.dumps(cases_out, indent=1), encoding="utf-8")

    # --- answers: group 4 anomalies ---
    (ANS_DIR / "anomalies.json").write_text(
        json.dumps(ANOMALIES, indent=1), encoding="utf-8")

    # --- manifest + eval registry ---
    manifest = {
        "documents": [{"id": d["id"], "file": f"data/golden/documents/{d['file']}",
                       "format": d["fmt"], "style": d["style"],
                       "pages": len(d["pages"]) if d["fmt"] == "pdf" else 1} for d in DOCS],
        "records_count": len(RECORDS),
        "cases_count": len(cases_out),
        "answers": {
            "classifications": "data/golden/answers/doc_classifications.json",
            "activity_records": "data/golden/answers/activity_records.json",
            "matching_cases": "data/golden/answers/matching_cases.json",
            "anomalies": "data/golden/answers/anomalies.json",
        },
    }
    (ROOT / "data/golden/manifest.json").write_text(json.dumps(manifest, indent=1), encoding="utf-8")
    (ROOT / "eval/golden_registry.json").write_text(json.dumps({
        "golden_answers": manifest["answers"],
        "factor_library": "data/factors/emission_factors.json",
        "note": "Registered by T-008; consumed by evaluation metric collectors.",
    }, indent=1), encoding="utf-8")

    n_cases_by_diff = {}
    for c in cases_out:
        n_cases_by_diff[c["difficulty"]] = n_cases_by_diff.get(c["difficulty"], 0) + 1
    print(f"documents={len(DOCS)} pages={len(classifications)} records={len(RECORDS)} "
          f"cases={len(cases_out)} by_difficulty={n_cases_by_diff}")

if __name__ == "__main__":
    main()
