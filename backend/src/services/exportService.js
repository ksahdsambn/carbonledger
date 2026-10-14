// Export service (T-035, FR-1003/1004): activity-detail CSV, category-summary
// CSV (UTF-8 BOM for Excel compatibility) and a deliverable PDF with header,
// page numbers and a table of contents (>= 6 pages).
import PDFDocument from 'pdfkit';

const t3 = (kg) => Math.round((kg / 1000) * 1000) / 1000;

function csvEscape(v) {
  const s = v == null ? '' : String(v);
  // CSV formula injection (D-11): a string cell that starts with a formula
  // trigger character is neutralized with a leading apostrophe. Numeric values
  // keep their textual form so numeric columns still parse as numbers.
  const cell = typeof v === 'string' && /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

export function activityDetailCsv(report, calcs, records) {
  const header = ['record_id', 'source_ref', 'description', 'quantity', 'unit', 'factor_id', 't CO2e', 'uncertainty', 'excluded'];
  const lines = [header.join(',')];
  for (const r of records) {
    const c = calcs.find((x) => x.activity_record_id === r.record_id);
    lines.push([r.record_id, r.source_ref, r.item_description, r.quantity ?? '', r.unit ?? '',
      c?.factor_id ?? '', c ? t3(c.emission_kgco2e) : '0', r.uncertainty_level ?? 'medium',
      r.excluded_from_calc ?? ''].map(csvEscape).join(','));
  }
  return '\uFEFF' + lines.join('\r\n');
}

export function categorySummaryCsv(report) {
  const catChapter = report.chapters.find((c) => c.no === 4);
  const catTable = catChapter?.blocks.find((b) => b.type === 'table' && b.header?.[0]?.startsWith('Scope 3'));
  const lines = [(['Scope 3 category', 't CO2e']).join(',')];
  for (const row of catTable?.rows ?? []) lines.push([row[0], row[1]].map(csvEscape).join(','));
  return '\uFEFF' + lines.join('\r\n');
}

/** Renders the report to a paginated PDF with running header and page numbers. */
export function reportPdf(report) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (e) => reject(e)); // a generator failure must reject, not hang (D-27)

    const title = `CarbonLedger Emissions Report — ${report.meta.entity}`;
    let y = 0;
    const headerFooter = () => {
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i += 1) {
        doc.switchToPage(i);
        doc.fontSize(8).fillColor('#666')
          .text(title, 50, 28, { width: 495, align: 'left' })
          .text(`Page ${i + 1}`, 50, 800, { width: 495, align: 'right' })
          .fillColor('#000');
      }
    };

    // Cover
    doc.fontSize(24).text('CarbonLedger', { align: 'center' });
    doc.moveDown();
    doc.fontSize(16).text(`Scope 1, 2 and 3 Emissions Report`, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).text(report.meta.entity, { align: 'center' });
    doc.fontSize(10).text(`Reporting period: ${report.meta.period.from} to ${report.meta.period.to}`, { align: 'center' });
    doc.text(`GWP version: ${report.meta.gwp_version}`, { align: 'center' });
    doc.text(`Track: ${report.meta.track}`, { align: 'center' });
    doc.moveDown();
    const years = Object.entries(report.meta.factor_year_distribution).map(([y2, n]) => `${y2}: ${n}`).join(', ');
    doc.fontSize(9).text(`Factor year distribution (factors used): ${years}`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(9).text(`Total emissions: ${report.meta.total_t} t CO2e`, { align: 'center' });
    doc.addPage();

    // Table of contents
    doc.fontSize(14).text('Table of contents');
    doc.moveDown(0.5);
    for (const c of report.chapters) doc.fontSize(10).text(`${c.no}. ${c.title}`);
    doc.addPage();

    for (const chapter of report.chapters) {
      doc.fontSize(13).text(`${chapter.no}. ${chapter.title}`);
      doc.moveDown(0.4);
      for (const block of chapter.blocks) {
        if (block.type === 'text') {
          doc.fontSize(9.5).text(block.text, { width: 495 });
          doc.moveDown(0.3);
        } else if (block.type === 'list') {
          block.items.forEach((item, i) => doc.fontSize(9.5).text(`${i + 1}. ${item}`, { width: 495 }));
          doc.moveDown(0.3);
        } else if (block.type === 'kv') {
          for (const [k, v] of block.rows) doc.fontSize(9.5).text(`${k}: ${v}`, { width: 495 });
          doc.moveDown(0.3);
        } else if (block.type === 'table') {
          renderTable(doc, block.header, block.rows);
          doc.moveDown(0.3);
        }
        y = doc.y;
        if (y > 700) doc.addPage();
      }
      doc.addPage();
    }
    headerFooter();
    doc.end();
  });
}

function renderTable(doc, header, rows) {
  if (!header || header.length === 0) return; // empty header cannot size columns (D-27)
  const widths = header.map(() => Math.floor(495 / header.length));
  const drawRow = (cells, bold) => {
    let x = 50;
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8);
    cells.forEach((cell, i) => {
      doc.text(String(cell ?? ''), x, doc.y, { width: widths[i] - 6 });
      x += widths[i];
    });
    doc.moveDown(0.15);
  };
  drawRow(header, true);
  doc.font('Helvetica');
  for (const row of rows.slice(0, 60)) drawRow(row, false);
  if (rows.length > 60) doc.fontSize(8).text(`… ${rows.length - 60} more rows`);
}
