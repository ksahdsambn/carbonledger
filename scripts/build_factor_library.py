#!/usr/bin/env python
"""Build the local emission factor library (T-006, PRD FR-602/603/605).

Extracts rows from the downloaded public workbooks (DEFRA 2026 full set,
EPA GHG Emission Factors Hub 2025) and writes data/factors/emission_factors.json.
The library is a static data file: loading never touches the network.

Factor attributes follow PRD FR-603 (13 mandatory fields) plus helper fields:
  factor_id, name, description, activity_type, emission_unit, activity_unit,
  value, ghg_coverage, system_boundary, gwp_version, data_year, source_name,
  source_reference, industries[], priority, [gas_breakdown], [location]
"""
import json
import re
from pathlib import Path

import openpyxl
from openpyxl.utils import column_index_from_string as ci

ROOT = Path(__file__).resolve().parent.parent
DEFRA = ROOT / "data/sources/ghg-conversion-factors-2026-full-set.xlsx"
EPA = ROOT / "data/sources/ghg-emission-factors-hub-2025.xlsx"
OUT = ROOT / "data/factors/emission_factors.json"

DEFRA_SRC = {
    "source_name": "UK Government GHG Conversion Factors for Company Reporting 2026 (DESNZ)",
    "source_reference": "data/sources/ghg-conversion-factors-2026-full-set.xlsx — sheet '{sheet}', row {row}",
    "data_year": 2026,
    "prefix": "EF-D26",
}
EPA_SRC = {
    "source_name": "US EPA GHG Emission Factors Hub, January 2025",
    "source_reference": "data/sources/ghg-emission-factors-hub-2025.xlsx — Table {table}, row {row}",
    "data_year": 2025,
    "prefix": "EF-E25",
}

UNIT_MAP = {
    "tonnes": "t", "tonne": "t", "kg": "kg", "kwh": "kWh", "litres": "L",
    "litre": "L", "gross litres": "L", "net litres": "L", "cubic metres": "m3",
    "tonne.km": "t.km", "tonne.kilometre": "t.km", "passenger.km": "p.km",
    "km": "km", "kilometre": "km", "miles": "mile", "mile": "mile",
    "night": "night", "nights": "night", "mm btu": "MMBtu", "mmbtu": "MMBtu",
    "short ton": "short ton", "ton": "short ton",
}
def norm_unit(u):
    return UNIT_MAP.get(str(u).strip().lower(), str(u).strip())

# ISO alpha-2 for countries appearing in electricity / hotel sheets.
ISO = {"united kingdom": "GB", "uk": "GB", "france": "FR", "germany": "DE",
       "italy": "IT", "spain": "ES", "netherlands": "NL", "belgium": "BE",
       "ireland": "IE", "poland": "PL", "sweden": "SE", "denmark": "DK",
       "china (mainland)": "CN", "china": "CN", "japan": "JP", "india": "IN",
       "united states": "US", "usa": "US", "canada": "CA", "australia": "AU",
       "singapore": "SG", "hong kong sar": "HK", "hong kong": "HK",
       "taiwan": "TW", "south korea": "KR", "thailand": "TH", "vietnam": "VN",
       "malaysia": "MY", "indonesia": "ID", "mexico": "MX", "brazil": "BR",
       "world average": "WW", "other": "ZZ"}
def iso_of(text):
    return ISO.get(str(text).strip().lower(), None)

def num(v):
    try:
        f = float(v)
        return f
    except (TypeError, ValueError):
        return None

# ---------------------------------------------------------------------------
# DEFRA sheet extraction config.
# total_cols maps column letter -> (variant label, system boundary).
# industries: category matcher -> industry list.
ELECTRONICS = "electronics_manufacturing"
APPAREL = "apparel_textiles"
FOOD = "food_processing"
LOGISTICS = "logistics_transportation"
OFFICE = "general_office_services"
ALL5 = [ELECTRONICS, APPAREL, FOOD, LOGISTICS, OFFICE]

def material_industries(category):
    c = category.lower()
    if any(k in c for k in ("electrical", "batteries", "it equipment")):
        return [ELECTRONICS, OFFICE]
    if any(k in c for k in ("metal", "aluminium", "steel", "copper", "glass")):
        return [ELECTRONICS]
    if "plastic" in c or "polymer" in c:
        return [ELECTRONICS, APPAREL]
    if any(k in c for k in ("clothing", "textile", "shoes", "footwear")):
        return [APPAREL]
    if any(k in c for k in ("paper", "board", "books")):
        return [APPAREL, OFFICE]
    if any(k in c for k in ("food", "drink", "compost", "organics")):
        return [FOOD]
    if "wood" in c:
        return [APPAREL]
    return [OFFICE]

def waste_industries(category):
    c = category.lower()
    if "food" in c or "organic" in c:
        return [FOOD]
    if any(k in c for k in ("clothing", "textile")):
        return [APPAREL]
    if any(k in c for k in ("electrical", "battery", "it", "fridge", "wEEE".lower())):
        return [ELECTRONICS, OFFICE]
    if "metal" in c or "plastic" in c or "glass" in c:
        return [ELECTRONICS, APPAREL]
    if "paper" in c or "board" in c:
        return [OFFICE, APPAREL]
    return [OFFICE]

DEFRA_SHEETS = [
    dict(sheet="Material use", header=21, type_col="B", unit_col="C",
         total_cols={"D": ("Primary material production", "cradle-to-gate (primary material)"),
                     "E": ("Re-used material", "cradle-to-gate (re-used material)"),
                     "F": ("Recycled material, open-loop", "cradle-to-gate (open-loop recycling)"),
                     "G": ("Recycled material, closed-loop", "cradle-to-gate (closed-loop recycling)")},
         activity_type="purchased_goods", name_prefix="Materials —", ind=material_industries),
    dict(sheet="Waste disposal", header=23, type_col="B", unit_col="C",
         total_cols={"D": ("Disposal: re-use", "gate-to-grave (re-use)"),
                     "E": ("Disposal: open-loop recycling", "gate-to-grave (open-loop recycling)"),
                     "F": ("Disposal: closed-loop recycling", "gate-to-grave (closed-loop recycling)"),
                     "G": ("Disposal: combustion", "gate-to-grave (combustion with energy recovery)"),
                     "H": ("Disposal: composting", "gate-to-grave (composting)"),
                     "I": ("Disposal: landfill", "gate-to-grave (landfill)"),
                     "J": ("Disposal: anaerobic digestion", "gate-to-grave (anaerobic digestion)")},
         activity_type="waste_treatment", name_prefix="Waste —", ind=waste_industries),
    dict(sheet="Fuels", header=22, type_col="B", unit_col="C",
         total_cols={"D": ("Combustion", "tank-to-wheel / direct combustion (Scope 1 stationary or mobile)")},
         activity_type="fuel_combustion", name_prefix="Fuel —", ind=lambda c: ALL5),
    dict(sheet="WTT- fuels", header=None, type_col="B", unit_col="C",
         total_cols={"D": ("Well-to-tank", "well-to-tank (upstream fuel production and distribution)")},
         activity_type="fuel_upstream", name_prefix="Fuel upstream (WTT) —", ind=lambda c: ALL5,
         skip=True),
    dict(sheet="Freighting goods", header=25, type_col="B", unit_col="C",
         total_cols={"T": ("Fleet average fuel (unknown mix)", "tank-to-wheel (direct combustion)"),
                     "D": ("Diesel", "tank-to-wheel (direct combustion, diesel)")},
         activity_type="freight_transport", name_prefix="Freight —", ind=lambda c: [LOGISTICS]),
    dict(sheet="WTT- delivery vehs & freight", header=20, type_col="B", unit_col="C",
         total_cols={"H": ("Fleet average fuel (unknown mix)", "well-to-tank (upstream fuel production)"),
                     "D": ("Diesel", "well-to-tank (upstream fuel production, diesel)")},
         activity_type="freight_upstream", name_prefix="Freight upstream (WTT) —", ind=lambda c: [LOGISTICS]),
    dict(sheet="UK electricity", header=24, type_col="B", unit_col="C",
         total_cols={"E": ("UK grid electricity", "generation (grid average, including T&D losses excluded)")},
         activity_type="electricity", name_prefix="Electricity —", ind=lambda c: ALL5),
    dict(sheet="Overseas electricity", header=None, type_col="B", unit_col="C",
         total_cols={"E": ("Overseas grid electricity", "generation (country grid average)")},
         activity_type="electricity", name_prefix="Electricity (overseas) —", ind=lambda c: ALL5,
         skip=True),
    dict(sheet="Heat and steam", header=20, type_col="B", unit_col="C",
         total_cols={"E": ("District heat and steam", "generation (district heat / steam supply)")},
         activity_type="heat_steam", name_prefix="Heat and steam —", ind=lambda c: ALL5),
    dict(sheet="Water supply", header=17, type_col="B", unit_col="C",
         total_cols={"D": ("Water supply", "supply (water supply treatment infrastructure)")},
         activity_type="water", name_prefix="Water —", ind=lambda c: ALL5),
    dict(sheet="Water treatment", header=None, type_col="B", unit_col="C",
         total_cols={"D": ("Water treatment", "treatment (wastewater treatment)")},
         activity_type="water", name_prefix="Water —", ind=lambda c: ALL5, skip=True),
    dict(sheet="Refrigerant & other", header=19, type_col="B", unit_col="C",
         total_cols={"D": ("Refrigerant leak", "fugitive emission (refrigerant release, AR5 GWP)")},
         activity_type="refrigerant", name_prefix="Refrigerant —", ind=lambda c: [FOOD, LOGISTICS, OFFICE]),
    dict(sheet="Business travel- air", header=22, type_col="B", type2_col="C", unit_col="D",
         total_cols={"E": ("Flights (with RF where stated)", "tank-to-wheel (flight combustion + contrails where stated)")},
         activity_type="business_travel_air", name_prefix="Business travel air —",
         ind=lambda c: ALL5),
    dict(sheet="Business travel- land", header=24, type_col="B", unit_col="C",
         total_cols={"X": ("Fleet average fuel (unknown mix)", "tank-to-wheel (direct combustion)")},
         activity_type="business_travel_land", name_prefix="Business travel land —",
         ind=lambda c: ALL5),
    dict(sheet="Business travel- sea", header=None, type_col="B", unit_col="C",
         total_cols={"D": ("Ferry", "tank-to-wheel (direct combustion)")},
         activity_type="business_travel_sea", name_prefix="Business travel sea —",
         ind=lambda c: ALL5, skip=True),
    dict(sheet="Hotel stay", header=21, type_col="B", unit_col="C", loc_col="B",
         total_cols={"D": ("Hotel stay", "operational (hotel energy use per room-night)")},
         activity_type="accommodation", name_prefix="Hotel stay —", ind=lambda c: ALL5),
    dict(sheet="Homeworking", header=21, type_col="A", unit_col="B",
         total_cols={"C": ("Homeworking", "operational (home office energy per day)")},
         activity_type="homeworking", name_prefix="Homeworking —", ind=lambda c: [OFFICE]),
    dict(sheet="Passenger vehicles", header=None, type_col="B", unit_col="C",
         total_cols={"D": ("Diesel car", "tank-to-wheel (direct combustion)")},
         activity_type="road_transport", name_prefix="Passenger vehicle —",
         ind=lambda c: [LOGISTICS, OFFICE], skip=True),
    dict(sheet="Delivery vehicles", header=None, type_col="B", unit_col="C",
         total_cols={"D": ("Diesel van", "tank-to-wheel (direct combustion)")},
         activity_type="road_transport", name_prefix="Delivery vehicle —",
         ind=lambda c: [LOGISTICS], skip=True),
]

def find_header(ws, wanted=("Activity",)):
    for i, row in enumerate(ws.iter_rows(min_row=1, max_row=80, values_only=True), 1):
        first = row[0] if row else None
        if first in wanted:
            return i
    return None

def sheet_rows(ws, header_row, type_col, unit_col, type2_col=None, loc_col=None):
    """Yield dicts for data rows with carried-forward activity labels."""
    current_top = None
    rows = ws.iter_rows(min_row=header_row + 1, values_only=True)
    for ridx, row in enumerate(rows, header_row + 2):
        if not row or all(c is None for c in row):
            continue
        activity = row[0] if row[0] is not None else current_top
        if row[0] is not None and not isinstance(row[0], (int, float)):
            current_top = str(row[0]).strip()
        typ = row[ci(type_col) - 1] if type_col else None
        typ2 = row[ci(type2_col) - 1] if type2_col else None
        unit = row[ci(unit_col) - 1]
        if typ is None and typ2 is None:
            continue  # section header rows with only col A text
        yield {
            "top": str(activity).strip() if activity else "",
            "type": str(typ).strip() if typ else "",
            "type2": str(typ2).strip() if typ2 else "",
            "unit": str(unit).strip() if unit else "",
            "loc": str(row[ci(loc_col) - 1]).strip() if loc_col and row[ci(loc_col) - 1] else "",
            "row": ridx, "row_cells": row,
        }

def build_defra(factors):
    wb = openpyxl.load_workbook(DEFRA, read_only=True, data_only=True)
    seq = {}
    for cfg in DEFRA_SHEETS:
        header = cfg.get("header") or find_header(wb[cfg["sheet"]])
        if not header:
            continue
        sheet_seq = 0
        for rec in sheet_rows(wb[cfg["sheet"]], header, cfg["type_col"], cfg["unit_col"],
                              cfg.get("type2_col"), cfg.get("loc_col")):
            for col, (variant, boundary) in cfg["total_cols"].items():
                value = num(rec["row_cells"][ci(col) - 1])
                if value is None or value <= 0:
                    continue
                category = rec["type"] or rec["top"]
                label = " / ".join(x for x in (rec["top"], rec["type"], rec["type2"]) if x)
                name = f'{cfg["name_prefix"]} {label} — {variant} ({norm_unit(rec["unit"])})'
                sheet_seq += 1
                slug = re.sub(r"[^A-Za-z0-9]+", "", cfg["sheet"]).upper()
                fid = f'{DEFRA_SRC["prefix"]}-{slug}-{sheet_seq:03d}'
                factors.append({
                    "factor_id": fid,
                    "name": name,
                    "description": (f'UK Government GHG conversion factor 2026, sheet "{cfg["sheet"]}": '
                                    f'{label}. Variant: {variant}. Boundary: {boundary}. '
                                    f'Value is kg CO2e per {norm_unit(rec["unit"])} of activity data.'),
                    "activity_type": cfg["activity_type"],
                    "emission_unit": "kgCO2e",
                    "activity_unit": norm_unit(rec["unit"]),
                    "value": value,
                    "ghg_coverage": "CO2, CH4, N2O (folded to CO2e using IPCC AR5 100-year GWPs by the source)",
                    "system_boundary": boundary,
                    "gwp_version": "AR5",
                    "data_year": 2026,
                    "source_name": DEFRA_SRC["source_name"],
                    "source_reference": DEFRA_SRC["source_reference"].format(sheet=cfg["sheet"], row=rec["row"]),
                    "industries": cfg["ind"](category),
                    "priority": 1,
                    **({"location": iso_of(rec["loc"])} if iso_of(rec["loc"]) else {}),
                })
        seq[cfg["sheet"]] = sheet_seq
    return seq

# ---------------------------------------------------------------------------
# EPA hub: stationary/mobile combustion tables with per-gas factors (mmBtu basis).
EPA_TABLES = {"Table 1": "Stationary Combustion", "Table 2": "Mobile Combustion"}

def build_epa(factors):
    wb = openpyxl.load_workbook(EPA, read_only=True, data_only=True)
    ws = wb["Emission Factors Hub"]
    table = None
    seq = 0
    for ridx, row in enumerate(ws.iter_rows(min_row=1, values_only=True), 1):
        b = row[1] if len(row) > 1 else None
        c = row[2] if len(row) > 2 else None
        if isinstance(b, str) and b.strip() in EPA_TABLES:
            table = b.strip()
            continue
        if isinstance(b, str) and re.match(r"Table \d+", b.strip()):
            table = None  # a table we do not parse in this pass
            continue
        if table and isinstance(c, str) and c.strip() in ("Fuel Type",):
            continue
        if table and c is not None and num(row[4]) is not None:
            fuel = str(c).strip()
            co2 = num(row[4])
            ch4 = num(row[5]) or 0
            n2o = num(row[6]) or 0
            if not fuel or co2 is None or co2 <= 0:
                continue
            seq += 1
            folded = co2 + ch4 * 28 / 1000 + n2o * 265 / 1000
            factors.append({
                "factor_id": f'{EPA_SRC["prefix"]}-FUEL-{seq:03d}',
                "name": f'Fuel — {fuel} ({EPA_TABLES[table]}, per MMBtu)',
                "description": (f'US EPA Emission Factors Hub 2025, {EPA_TABLES[table]}: {fuel}. '
                                f'Gas-wise factors per MMBtu of heat content: {co2} kg CO2, {ch4} g CH4, '
                                f'{n2o} g N2O. GWP folding per IPCC AR5 (CH4=28, N2O=265) must be applied '
                                f'by the calculation engine and recorded in the audit trail.'),
                "activity_type": "fuel_combustion" if table == "Table 1" else "mobile_combustion",
                "emission_unit": "kgCO2e",
                "activity_unit": "MMBtu",
                "value": folded,
                "ghg_coverage": "CO2, CH4, N2O separate — GWP folding required (AR5)",
                "system_boundary": "combustion (direct, stationary or mobile)",
                "gwp_version": "AR5",
                "data_year": 2025,
                "source_name": EPA_SRC["source_name"],
                "source_reference": EPA_SRC["source_reference"].format(table=EPA_TABLES[table], row=ridx),
                "industries": ALL5,
                "priority": 2,
                "gas_breakdown": {"co2_kg_per_mmbtu": co2, "ch4_g_per_mmbtu": ch4, "n2o_g_per_mmbtu": n2o,
                                   "gwp_source": "IPCC AR5 100-year: CH4=28, N2O=265"},
            })

def main():
    factors = []
    build_defra(factors)
    build_epa(factors)
    ids = [f["factor_id"] for f in factors]
    assert len(ids) == len(set(ids)), "duplicate factor_id detected"
    by_ind = {}
    for f in factors:
        for ind in f["industries"]:
            by_ind[ind] = by_ind.get(ind, 0) + 1
    OUT.write_text(json.dumps({
        "meta": {
            "built_at": __import__("datetime").datetime.now().isoformat(),
            "total_factors": len(factors),
            "counts_by_industry": by_ind,
            "gwp_note": "All source factors are AR5-based; tasks selecting AR6 exercise the cross-version rule (PRD 4.5).",
            "sources": [DEFRA_SRC["source_name"], EPA_SRC["source_name"]],
        },
        "factors": factors,
    }, indent=1), encoding="utf-8")
    print(f"total={len(factors)}")
    for k in sorted(by_ind):
        print(f"  {k}: {by_ind[k]}")

if __name__ == "__main__":
    main()
