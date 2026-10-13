# Demo Video Script (3 minutes, English voice-over + subtitles)

Timing budget: 180 seconds total.
Track credit at the end: "Sustainability & Social Impact" (identical wording to the deck
cover and the README first screen).

| # | Time | Visual (storyboard) | Voice-over (subtitles identical) |
|---|---|---|---|
| 1 | 0:00–0:15 | Hook screen: big numbers "RMB 30,000 + 3 weeks" crossed out, "1 hour" appears. Screen caption: Sustainability & Social Impact. | A Scope 3 report used to cost thirty thousand RMB and three weeks of expert work. CarbonLedger turns that into about one hour, and every number stays traceable to its source document. |
| 2 | 0:15–0:35 | P1: create task form filled (Meridian Electronics, 2026 H1, AR6). | I create an accounting task — entity, reporting period, and the GWP version. This choice governs factor matching and disclosure for the whole task. |
| 3 | 0:35–0:55 | P2: drag 20 mixed files (scans, photos, XLSX, CSV) into the drop zone; status chips walk through queued, parsing, extracting, matching, completed. Then click "Load demo dataset". | Documents go in — scanned PDFs, phone photos, spreadsheets. Each file moves through the pipeline with a live status, and a single bad file never blocks the batch. |
| 4 | 0:55–1:20 | P3: open one record; per-field confidences visible; uncertainty badge; click "View source document" — the original scan opens with the page located. | Each extracted record carries per-field confidence. This one is the air freight shipment — twelve hundred kilograms from Hong Kong to Tokyo — and one click opens the source scan it came from. |
| 5 | 1:20–1:45 | P4: matching viewer for that record. Show candidates: "Air freight incl. radiative forcing — international" selected; runner-up "excl. RF" beside it; rationale text scrolls. Highlight the comparative sentence. | Here is the semantic heart of the product. The model picks the international air factor that includes radiative forcing — and explains in writing why the no-RF alternative was rejected. A rule engine cannot do this; that is why the model earns its place. |
| 6 | 1:45–2:05 | P5 dashboard: scope bars, category table, supplier top list; then P6: three scenario cards, drag the ratio slider, numbers refresh. | Results aggregate across scope, category, supplier and month — totals that reconcile to the last decimal. Three reduction scenarios compute automatically, and the replacement ratio is adjustable live. |
| 7 | 2:05–2:30 | P7 report: ten chapters scroll; click a citation anchor — jumps to the source record; export PDF and CSV; PDF opens with page numbers and table of contents. | The report follows the GHG Protocol structure, chapter by chapter. Every numeric conclusion is anchored — click and you land on the record behind it. PDF and CSV exports are delivery-ready. |
| 8 | 2:30–2:50 | P8 review queue: high-uncertainty items first; edit a quantity; totals refresh; P9 traces: per-call latency, tokens, cost. | Uncertain records queue for human review — highest first. Edits recalculate instantly, and every AI call is traced with latency, tokens and cost, so nothing is a black box. |
| 9 | 2:50–3:00 | Closing card: value proposition line + track label "Sustainability & Social Impact" + demo URL. | CarbonLedger — one hour, one traceable report. Sustainability and Social Impact. Try it yourself — the link is public. |

## Required-shot checklist (PRD 10.3 video acceptance)
- [x] Value numbers inside the first 15 seconds (shot 1)
- [x] Continuous drag-to-report process with no edited jumps (shots 2–7, single demo run)
- [x] One "semantic understanding picked the right factor" contrast case (shot 5: with-RF
      vs without-RF, from the Golden boundary-inference family)
- [x] One citation traceability click (shot 7)

## Production notes
- Record at 1080p from the deployed public URL in one continuous session; keep the demo
  dataset pre-loaded in a second tab only for the retry safety copy.
- Subtitles in English, verbatim from the voice-over column; export SRT alongside the MP4.
- Two backup takes: (a) full run, (b) shortened 2-minute cut ending at the report export.
