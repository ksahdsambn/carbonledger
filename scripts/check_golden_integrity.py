#!/usr/bin/env python
"""T-009 verification: Golden answer integrity final check.

Rules per PRD 4.3/4.4: numeric fields positive where required, ISO dates,
closed enums (doc types, currencies, units, transport modes), quantity/unit
pairing, transport records carry origin/destination and valid mode."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
recs = json.loads((ROOT / "data/golden/answers/activity_records.json").read_text(encoding="utf-8"))
cases = json.loads((ROOT / "data/golden/answers/matching_cases.json").read_text(encoding="utf-8"))

DOC_TYPES = {"supplier_invoice", "purchase_order", "logistics_waybill", "utility_bill",
             "travel_expense", "packing_list", "other"}
CURRENCIES = {"USD", "EUR", "GBP", "CAD", "JPY"}
UNITS = {"kg", "t", "kWh", "L", "m3", "km"}  # base units after normalization (PRD 4.4)
MODES = {"Road freight", "Rail transport", "Sea transport (container)", "Sea transport (bulk)",
         "Air transport (general cargo)", "Air transport (cold chain)", "International express",
         "Inland waterway transport", "Pipeline transport", "Not applicable"}
ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

errors = []

for r in recs:
    rid = r["record_id"]
    if r["doc_type"] not in DOC_TYPES:
        errors.append(f"{rid}: doc_type {r['doc_type']}")
    # quantity/unit pairing: both present or both absent
    has_q, has_u = r["quantity"] is not None, r["unit"] is not None
    if has_q != has_u:
        errors.append(f"{rid}: quantity/unit pairing broken")
    if has_q:
        if not isinstance(r["quantity"], (int, float)) or r["quantity"] <= 0:
            errors.append(f"{rid}: quantity {r['quantity']}")
        if r["unit"] not in UNITS:
            errors.append(f"{rid}: unit {r['unit']} not in base set")
    if r["amount"] is not None and r["amount"] < 0:
        errors.append(f"{rid}: negative amount")
    if r["currency"] is not None and r["currency"] not in CURRENCIES:
        errors.append(f"{rid}: currency {r['currency']}")
    if r["activity_date"] is not None and not ISO_DATE.match(r["activity_date"]):
        errors.append(f"{rid}: date {r['activity_date']} not ISO")
    mode = r["transport_mode"]
    if mode is not None and mode not in MODES:
        errors.append(f"{rid}: mode {mode!r} outside closed enum")
    if mode not in (None, "Not applicable"):
        for k in ("origin_location", "destination_location"):
            if not r[k] or not isinstance(r[k], str):
                errors.append(f"{rid}: transport record missing {k}")
        if not isinstance(r["gross_weight_kg"], (int, float)) or r["gross_weight_kg"] <= 0:
            errors.append(f"{rid}: gross_weight_kg {r['gross_weight_kg']}")
        if not isinstance(r["distance_km"], (int, float)) or r["distance_km"] < 0:
            errors.append(f"{rid}: distance_km {r['distance_km']}")

# case-side integrity: inline constructed records also pass the same rules
for c in cases:
    r = c["record"]
    rid = f"{c['case_id']}/{r['record_id']}"
    if r["quantity"] <= 0:
        errors.append(f"{rid}: quantity not positive")
    if r["unit"] not in UNITS | {"mile", "lb", "gal", "MWh", "GJ", "MMBtu", "BTU"}:
        errors.append(f"{rid}: unit {r['unit']}")
    if r["transport_mode"] not in MODES and r["transport_mode"] is not None:
        errors.append(f"{rid}: mode outside enum")
    if not r["item_description"] or len(r["item_description"]) < 8:
        errors.append(f"{rid}: item_description too short")

print(f"records_checked={len(recs)} cases_checked={len(cases)} errors={len(errors)}")
for e in errors:
    print("  ERROR:", e)
print("RESULT: " + ("PASS" if not errors else "FAIL"))
raise SystemExit(0 if not errors else 1)
