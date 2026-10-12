# Initial Industry Coverage List (T-005, counts finalized in T-006)

Preliminary per-industry factor seeding plan grounded in the locked sources.
Category names below are actual rows verified inside the downloaded source
workbooks (DEFRA 2026 full set sheets listed in parentheses). Each industry
will receive >= 40 curated factors in T-006 by combining the categories below
with per-GWP-version and per-boundary variants.

## 1. Electronics manufacturing

- Material use: Electrical items - IT / large / small / fridges and freezers; Metals (aluminium, steel cans and foil, scrap); Plastics: HDPE, LDPE/LLDPE, PET, PP, PS, PVC, average plastics/film/rigid; Glass (Material use sheet)
- Energy: Overseas electricity by region; UK electricity; Heat and steam (factory operations)
- Logistics: Freighting goods road/rail/sea/air rows (inbound components)
- Waste: Waste disposal (WEEE-relevant categories)
- Industry average: USEEIO commodity factors for computer & electronic product manufacturing

## 2. Apparel and textiles

- Material use: Clothing; Textiles (average/unspecified mix); Paper and board (packaging); Plastics (packaging film)
- Energy: Overseas electricity by region; Heat and steam
- Logistics: Freighting goods (sea container, air freight for samples)
- Waste: Waste disposal (clothing/textiles closed-loop and combustion routes)
- Industry average: USEEIO commodity factors for apparel manufacturing

## 3. Food processing

- Material use: Food and drink (Material use sheet)
- Energy: UK/Overseas electricity; Heat and steam (process heat); Refrigerant & other (process refrigeration)
- Logistics: Freighting goods (temperature-controlled road HGV; Refrigerant leak rows for reefer units)
- Waste: Waste disposal (food waste treatment routes: composting, anaerobic digestion, landspreading)
- Water: Water supply; Water treatment
- Industry average: USEEIO commodity factors for food manufacturing

## 4. Logistics and transportation

- Freighting goods: road (HGV classes, vans, refrigerated), rail freight, sea (container ship), air freight (with/without RF, short/long haul)
- WTT sheets: WTT- fuels, WTT- delivery vehs & freight (well-to-tank vs tank-to-wheel boundary pairs for the boundary-caliber matching difficulty)
- Business travel- air/sea/land (Cat-6 support)
- Fuels (diesel, petrol, biodiesel blends; Scope 1 fleet combustion)
- Delivery vehicles + Passenger vehicles (own fleet, Scope 1)

## 5. General office services

- UK electricity + Transmission and distribution; Heat and steam
- Homeworking; Hotel stay; Business travel- land (rail, taxi, car)
- Water supply / Water treatment
- Waste disposal (mixed office waste, paper)
- Material use: Paper and board (paper, board, mixed); IT equipment rows
- EPA Hub: eGRID US electricity, stationary combustion (natural gas, heating oil), steam

## Coverage gaps identified

- DEFRA has no product-level cradle-to-gate factors for specific electronic
  components (e.g., PCBs, semiconductors): covered by USEEIO industry-average
  commodity factors (source S3) and clearly labeled as industry averages.
- DEFRA sea freight provides container-ship averages but no reefer-specific
  sea factor: refrigerated road freight + refrigerant leakage rows compose
  the cold-chain coverage; any approximation will be disclosed in the factor
  description text.
- Both S1/S2 publish AR5-based kgCO2e: AR6-labeled curated variants will only
  be introduced from official AR6-based publications if available at build
  time; otherwise the library marks the AR5 origin per factor and the
  cross-GWP-version rule (PRD 4.5) is exercised via task-level GWP selection
  against the labeled library.
