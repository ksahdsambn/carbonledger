#!/usr/bin/env python
"""T-006 verification: factor library integrity checks (PRD FR-602/603).

Checks (all must pass):
 1. 50-factor random sample (fixed seed) — all 13 mandatory attributes complete.
 2. Industry membership counts: each of the 5 industries >= 40; total <= 1200.
 3. factor_id globally unique.
 4. Offline load: the library file is plain local JSON; loading it performs no
    network access (verified by construction + a socket-blocking guard below).
"""
import json
import random
import socket
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LIB = ROOT / "data/factors/emission_factors.json"
INDUSTRIES = ["electronics_manufacturing", "apparel_textiles", "food_processing",
              "logistics_transportation", "general_office_services"]
ATTRS = ["factor_id", "name", "description", "activity_type", "emission_unit",
         "activity_unit", "value", "ghg_coverage", "system_boundary",
         "gwp_version", "data_year", "source_name", "source_reference"]

class NoNetwork(Exception):
    pass

def guard_offline():
    """Fail loudly if any code path attempts a network connection."""
    def blocked(*args, **kwargs):
        raise NoNetwork("network access attempted during library load")
    socket.socket.connect = blocked

def main():
    failures = []
    guard_offline()
    lib = json.loads(LIB.read_text(encoding="utf-8"))  # local file only
    factors = lib["factors"]

    # 1. attribute completeness on a 50-factor random sample (seed fixed)
    random.seed(20261012)
    sample = random.sample(factors, 50)
    incomplete = []
    for f in sample:
        for a in ATTRS:
            v = f.get(a)
            if v is None or (isinstance(v, str) and not v.strip()):
                incomplete.append((f["factor_id"], a))
    print(f"[1] sample=50 attribute-completeness: {50 - len(set(x[0] for x in incomplete))}/50 complete")
    if incomplete:
        failures.append(f"attribute gaps: {incomplete[:5]}")

    # 2. industry counts
    counts = {i: sum(1 for f in factors if i in f["industries"]) for i in INDUSTRIES}
    print(f"[2] counts_by_industry={counts} total_unique={len(factors)}")
    for i, c in counts.items():
        if c < 40:
            failures.append(f"industry {i} has {c} < 40")
    if len(factors) > 1200:
        failures.append(f"total {len(factors)} > 1200")

    # 3. uniqueness
    ids = [f["factor_id"] for f in factors]
    dupes = len(ids) - len(set(ids))
    print(f"[3] duplicate_factor_ids={dupes}")
    if dupes:
        failures.append(f"{dupes} duplicate ids")

    # 4. offline load already succeeded under the socket guard
    print(f"[4] offline_load=OK ({len(factors)} factors, meta.total_factors={lib['meta']['total_factors']})")
    if lib["meta"]["total_factors"] != len(factors):
        failures.append("meta total mismatch")

    if failures:
        print("RESULT: FAIL")
        for x in failures:
            print("  -", x)
        sys.exit(1)
    print("RESULT: PASS")

if __name__ == "__main__":
    main()
