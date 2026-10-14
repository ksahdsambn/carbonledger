#!/usr/bin/env python
"""Build the one-click demo dataset (T-010, PRD 7.3).

20 mixed-format documents for a fictional but credible company, yielding 20
activity records: Scope 1 x2, Scope 2 x2, Scope 3 across seven categories
(Cat-1..Cat-7). Also writes the machine-readable expected-results manifest
consumed by T-044 and the evaluation tool."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from golden import render_docs as R
from golden.curated_data import rec, page

ROOT = Path(__file__).resolve().parent.parent
DOC_DIR = ROOT / "data/demo/documents"

COMPANY = {
    "name": "Meridian Electronics Manufacturing, Inc.",
    "address": "4400 Innovation Way, Austin, Texas, USA",
    "industry": "Electronics manufacturing",
    "reporting_period": {"from": "2026-01-01", "to": "2026-06-30"},
    "gwp_version_default": "AR6",
}

# (file, format, style, doc_type, lines/xlsx-rows, record)
D = []

def doc(file, fmt, style, dtype, content, record):
    D.append(dict(file=file, fmt=fmt, style=style, doc_type=dtype,
                  content=content, records=[record] if record else []))

def multi_doc(file, fmt, style, dtype, content, records):
    D.append(dict(file=file, fmt=fmt, style=style, doc_type=dtype,
                  content=content, records=records))

doc("D-01_fleet_diesel_invoice.pdf", "pdf", "clean", "supplier_invoice",
    [page("supplier_invoice", [
        ("VALERO FUEL CARD STATEMENT", "title"),
        "Customer: Meridian Electronics Manufacturing, Inc.",
        "Period: 2026-01-01 to 2026-06-30    Date: 2026-07-02",
        "Diesel (average biofuel blend) for company fleet: 14,000 kg",
        "Amount: USD 16,400.00",
    ])],
    rec("DR-01", "D-01", "page=1", "supplier_invoice",
        "Diesel fuel (average biofuel blend) for own fleet, combustion",
        14000, "kg", 16400.00, "USD", "2026-06-30", supplier="Valero",
        notes="Scope 1 mobile combustion"))

doc("D-02_refrigerant_service.png", "png", "photo", "supplier_invoice",
    [page("supplier_invoice", [
        "HVAC SERVICE RECORD",
        "Client: Meridian Electronics, Austin plant",
        "Date: 2026-03-11",
        "R-32 refrigerant top-up: 12 kg",
        "Service fee: USD 540",
    ])],
    rec("DR-02", "D-02", "page=1", "supplier_invoice",
        "Refrigerant HFC-32 top-up for plant HVAC",
        12, "kg", 540.00, "USD", "2026-03-11", supplier="Lone Star HVAC Services",
        notes="Scope 1 fugitive emissions"))

doc("D-03_electricity.xlsx", "xlsx", "clean", "utility_bill", None,
    rec("DR-03", "D-03", "sheet=Sheet1;row=4", "utility_bill",
        "Factory grid electricity, H1 2026", 1_250_000, "kWh", 152_000.00,
        "USD", "2026-06-30", supplier="Austin Energy"))

doc("D-04_district_heat.csv", "csv", "clean", "utility_bill", None,
    rec("DR-04", "D-04", "sheet=row=2", "utility_bill",
        "District heat supply for office campus (2,880 GJ converted)",
        799_997.76, "kWh", 58_000.00, "USD", "2026-06-30",
        supplier="Austin District Energy"))

doc("D-05_aluminium_invoice.pdf", "pdf", "scan", "supplier_invoice",
    [page("supplier_invoice", [
        ("ALUWORKS SUPPLY — INVOICE AS-2026-118", "title"),
        "Date: 2026-02-14",
        "Aluminium sheet 5052 for chassis panels",
        "Quantity: 9,500 kg    Amount: USD 23,800.00",
    ])],
    rec("DR-05", "D-05", "page=1", "supplier_invoice",
        "Aluminium sheet 5052 for chassis panels", 9500, "kg", 23800.00,
        "USD", "2026-02-14", supplier="Aluworks Supply"))

multi_doc("D-06_polymer_po.pdf", "pdf", "clean", "purchase_order",
    [page("purchase_order", [
        ("PURCHASE ORDER ME-PO-2026-0331", "title"),
        "Date: 2026-03-05    Supplier: Heartland Polymer Works",
        "Line 1: PET film, food grade          1,200 kg    USD 2,200",
        "Line 2: PP injection pellets          2,600 kg    USD 3,450",
        "Line 3: LDPE packaging film           900 kg      USD 1,150",
    ])],
    [rec("DR-06", "D-06", "page=1;line=1", "purchase_order",
         "PET film, food grade", 1200, "kg", 2200.00, "USD", "2026-03-05"),
     rec("DR-07", "D-06", "page=1;line=2", "purchase_order",
         "PP injection pellets", 2600, "kg", 3450.00, "USD", "2026-03-05"),
     rec("DR-08", "D-06", "page=1;line=3", "purchase_order",
         "LDPE packaging film", 900, "kg", 1150.00, "USD", "2026-03-05")])

doc("D-07_pcb_invoice.jpg", "jpg", "photo", "supplier_invoice",
    [page("supplier_invoice", [
        "AUSTIN PCB FAB — INVOICE APF-8812",
        "Date: 2026-04-08",
        "4-layer PCB assemblies, 12 lots",
        "Net weight: 640 kg    Amount: USD 43,500.00",
    ])],
    rec("DR-09", "D-07", "page=1", "supplier_invoice",
        "4-layer PCB assemblies (12 lots)", 640, "kg", 43500.00, "USD",
        "2026-04-08", supplier="Austin PCB Fab"))

doc("D-08_cnc_invoice.pdf", "pdf", "clean", "supplier_invoice",
    [page("supplier_invoice", [
        ("HEARTLAND MACHINE TOOLS — INVOICE HM-2026-0412", "title"),
        "Date: 2026-04-12",
        "CNC machining centre VM-850, 1 unit (net weight 8,200 kg)",
        "Amount: USD 95,000.00",
    ])],
    rec("DR-10", "D-08", "page=1", "supplier_invoice",
        "CNC machining centre VM-850 (capital equipment)", 8200, "kg",
        95000.00, "USD", "2026-04-12", supplier="Heartland Machine Tools",
        notes="capital goods"))

doc("D-09_fuel_upstream.xlsx", "xlsx", "clean", "utility_bill", None,
    rec("DR-11", "D-09", "sheet=Sheet1;row=4", "utility_bill",
        "Well-to-tank upstream emissions of fleet diesel (matches D-01 load)",
        14000, "kg", None, None, "2026-06-30",
        notes="Scope 3 Cat-3 upstream fuel reporting for the D-01 quantity"))

doc("D-10_sea_freight_bl.pdf", "pdf", "scan", "logistics_waybill",
    [page("logistics_waybill", [
        ("OCEAN BILL OF LADING — MAERSK 0281WSK55", "title"),
        "Sailing date: 2026-05-19",
        "Shipper: Meridian Electronics, Port of Houston, Texas, USA",
        "Consignee: Nordwind GmbH, Hamburg, Germany",
        "FCL 1 x 40HC, finished sensor modules, gross 17,300 kg",
        "Sea distance: 9,000 km    Freight: USD 3,100.00",
    ])],
    rec("DR-12", "D-10", "page=1", "logistics_waybill",
        "FCL ocean freight of sensor modules, Houston to Hamburg",
        17300, "kg", 3100.00, "USD", "2026-05-19", supplier="Maersk",
        origin="US/Houston", dest="DE/Hamburg", mode="Sea transport (container)",
        weight=17300, distance=9000))

doc("D-11_road_freight.jpg", "jpg", "photo", "logistics_waybill",
    [page("logistics_waybill", [
        "INBOUND FREIGHT NOTE",
        "Date: 2026-02-27",
        "Dallas distribution center to Austin plant",
        "Rigid truck, 6,800 kg cargo, 315 km",
        "Freight: USD 330",
    ])],
    rec("DR-13", "D-11", "page=1", "logistics_waybill",
        "Inbound road freight, Dallas to Austin (ambient rigid truck)",
        6800, "kg", 330.00, "USD", "2026-02-27",
        origin="US/Dallas", dest="US/Austin", mode="Road freight",
        weight=6800, distance=315))

doc("D-12_waste_invoice.pdf", "pdf", "clean", "supplier_invoice",
    [page("supplier_invoice", [
        ("CENTRAL TEXAS ENVIRONMENTAL SERVICES — INVOICE", "title"),
        "Date: 2026-06-16",
        "Collection and landfill disposal of mixed production waste",
        "Quantity: 4,200 kg    Amount: USD 410.00",
    ])],
    rec("DR-14", "D-12", "page=1", "supplier_invoice",
        "Landfill disposal of mixed production waste", 4200, "kg", 410.00,
        "USD", "2026-06-16", supplier="Central Texas Environmental Services"))

doc("D-13_air_travel.jpg", "jpg", "photo", "travel_expense",
    [page("travel_expense", [
        "EXPENSE CLAIM — TRADE FAIR TRIP",
        "Employee: Alex Carter    Travel date: 2026-04-20",
        "Return flight Austin (AUS) to Hannover (HAJ), economy",
        "1 passenger    Distance: 16,900 km    Fare: USD 1,380",
    ])],
    rec("DR-15", "D-13", "page=1", "travel_expense",
        "Return economy flight AUS-HAJ for trade fair, 1 passenger",
        16900, "km", 1380.00, "USD", "2026-04-20",
        origin="US/Austin", dest="DE/Hannover", mode="Not applicable",
        distance=16900, notes="business travel; passenger-km equals km"))

doc("D-14_pallets_packing.pdf", "pdf", "clean", "packing_list",
    [page("packing_list", [
        ("PACKING LIST — EXPORT PALLETS", "title"),
        "Date: 2026-05-19",
        "Heat-treated wooden export pallets (ISPM-15)",
        "Net weight: 520 kg    Value: USD 2,080.00",
    ])],
    rec("DR-16", "D-14", "page=1", "packing_list",
        "Heat-treated wooden export pallets (ISPM-15)", 520, "kg", 2080.00,
        "USD", "2026-05-19"))

doc("D-15_commuting_rail.pdf", "pdf", "clean", "travel_expense",
    [page("travel_expense", [
        ("CAPITAL METRO — CORPORATE SEASON PASS INVOICE", "title"),
        "Date: 2026-06-30    Company: Meridian Electronics",
        "Employee commuting season passes, H1 2026",
        "Aggregate commuting distance: 210,000 passenger-km",
        "Amount: USD 13,500.00",
    ])],
    rec("DR-17", "D-15", "page=1", "travel_expense",
        "Employee commuting rail season passes, aggregate H1 2026",
        210000, "km", 13500.00, "USD", "2026-06-30",
        notes="employee commuting; passenger-km equals km"))

doc("D-16_express_courier.jpg", "jpg", "photo", "logistics_waybill",
    [page("logistics_waybill", [
        "FEDEX INTERNATIONAL WAYBILL 7712 4408 5531",
        "Pickup date: 2026-06-11",
        "From: Austin, USA    To: London, UK",
        "Contents: calibration samples    Weight: 85 kg",
        "Distance: 7,900 km    Charge: USD 760.00",
    ])],
    rec("DR-18", "D-16", "page=1", "logistics_waybill",
        "International express courier, Austin to London",
        85, "kg", 760.00, "USD", "2026-06-11", supplier="FedEx",
        origin="US/Austin", dest="GB/London", mode="International express",
        weight=85, distance=7900))

XLSX_CSV = {
    "D-03": [["Electricity Bill — Austin Energy"],
             ["customer", "Meridian Electronics Manufacturing, Inc."],
             ["period", "2026-01-01..2026-06-30"],
             ["Item", "kWh", "amount_usd"], ["Factory supply", 1250000, 152000]],
    "D-09": [["Fuel upstream statement — Valero fuel card"],
             ["note", "well-to-tank accounting for fleet diesel"],
             ["Item", "kg_diesel"], ["Upstream of D-01 load", 14000]],
    "D-20": [["Office supplies PO OS-2026-12"],
             ["date,description,qty_kg,amount_usd"],
             ["2026-06-27,A4 copy paper and toner cartridges,780,1310"]],
    "D-04": [["District heat — Austin District Energy"],
             ["period,consumption_gj,amount_usd"], ["2026H1,2880,58000"]],
    "D-17": [["Glass supplier invoice — Liberty Glass Works"],
             ["date,description,qty_kg,amount_usd"],
             ["2026-03-22,Toughened display glass panels,2400,9200"]],
}

doc("D-17_glass_supplier.csv", "csv", "clean", "supplier_invoice", None,
    rec("DR-19", "D-17", "sheet=row=2", "supplier_invoice",
        "Toughened display glass panels", 2400, "kg", 9200.00, "USD",
        "2026-03-22", supplier="Liberty Glass Works"))

doc("D-18_cover_page.pdf", "pdf", "clean", "other",
    [page("other", [
        ("MERIDIAN ELECTRONICS — H1 2026 PROCUREMENT DOSSIER", "title"),
        "This cover page lists the contents of the reporting dossier.",
        "No transactional data is present on this page.",
    ])], None)

doc("D-19_certificate.png", "png", "photo", "other",
    [page("other", [
        "ISO 9001 CERTIFICATE OF CONFORMANCE",
        "Issued to Meridian Electronics Manufacturing, Inc.",
        "Certificate no. US-26-7741    Valid until 2029-04-30",
    ])], None)

doc("D-20_office_supplies.xlsx", "xlsx", "clean", "purchase_order", None,
    rec("DR-20", "D-20", "sheet=Sheet1;row=3", "purchase_order",
        "A4 copy paper and toner cartridges", 780, "kg", 1310.00, "USD",
        "2026-06-27"))

# expected scope/category mapping (boundary ground truth for the demo run)
EXPECTED = {
    "DR-01": ("Scope 1", None), "DR-02": ("Scope 1", None),
    "DR-03": ("Scope 2", None), "DR-04": ("Scope 2", None),
    "DR-05": ("Scope 3", "Cat-1"), "DR-06": ("Scope 3", "Cat-1"),
    "DR-07": ("Scope 3", "Cat-1"), "DR-08": ("Scope 3", "Cat-1"),
    "DR-09": ("Scope 3", "Cat-1"), "DR-10": ("Scope 3", "Cat-2"),
    "DR-11": ("Scope 3", "Cat-3"), "DR-12": ("Scope 3", "Cat-4"),
    "DR-13": ("Scope 3", "Cat-4"), "DR-14": ("Scope 3", "Cat-5"),
    "DR-15": ("Scope 3", "Cat-6"), "DR-16": ("Scope 3", "Cat-1"),
    "DR-17": ("Scope 3", "Cat-7"), "DR-18": ("Scope 3", "Cat-4"),
    "DR-19": ("Scope 3", "Cat-1"), "DR-20": ("Scope 3", "Cat-1"),
}

def main():
    DOC_DIR.mkdir(parents=True, exist_ok=True)
    for d in D:
        path = DOC_DIR / d["file"]
        if d["fmt"] == "pdf":
            R.save_pdf([{"args": (d["content"][0]["lines"], d["style"])}], path)
        elif d["fmt"] in ("jpg", "png"):
            R.save_image(d["content"][0]["lines"], path, style=d["style"], seed=7)
        elif d["fmt"] == "xlsx":
            R.save_xlsx(XLSX_CSV[d["file"].split("_")[0]], path)
        elif d["fmt"] == "csv":
            R.save_csv(XLSX_CSV[d["file"].split("_")[0]], path)

    records = [r for d in D if d["records"] for r in d["records"]]
    assert len(D) == 20 and len(records) == 20, (len(D), len(records))
    scope_counts, cat_counts = {}, {}
    for rid, (scope, cat) in EXPECTED.items():
        scope_counts[scope] = scope_counts.get(scope, 0) + 1
        if cat:
            cat_counts[cat] = cat_counts.get(cat, 0) + 1
    manifest = {
        "company": COMPANY,
        "documents": [{"file": f"data/demo/documents/{d['file']}", "format": d["fmt"],
                       "doc_type": d["doc_type"],
                       "records": [r["record_id"] for r in (d["records"] or [])]} for d in D],
        "expected_results": {
            "record_count": len(records),
            "scope_breakdown": scope_counts,
            "scope3_category_coverage": cat_counts,
        },
        "expected_records_file": "data/demo/expected_records.json",
        "expected_scope_map": EXPECTED,
    }
    (ROOT / "data/demo/manifest.json").write_text(json.dumps(manifest, indent=1), encoding="utf-8")
    (ROOT / "data/demo/expected_records.json").write_text(
        json.dumps(records, indent=1), encoding="utf-8")
    print(f"documents={len(D)} records={len(records)} scopes={scope_counts} categories={cat_counts}")

if __name__ == "__main__":
    main()
