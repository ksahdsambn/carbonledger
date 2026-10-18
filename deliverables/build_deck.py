# CarbonLedger deck builder — 13 pages, 16:9 landscape (320x180 mm).
# Source of truth: deliverables/deck_draft.md + README metrics. ASCII + a few
# Latin-1/General-Punctuation glyphs only (Arial embedded+subset). No CJK anywhere.
import os, re
from PIL import Image
from fpdf import FPDF

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if os.path.basename(ROOT).lower() != 'carbonledger':
    ROOT = r'D:\opencode\carbonledger'
DELIV = os.path.join(ROOT, 'deliverables')
ASSETS = os.path.join(DELIV, 'deck_assets')
os.makedirs(ASSETS, exist_ok=True)

# ---------- palette ----------
DEEP   = (11, 77, 55)
GREEN  = (16, 130, 84)
INK    = (22, 38, 32)
MUTED  = (92, 108, 101)
FAINT  = (220, 230, 224)
BG     = (244, 248, 245)
WHITE  = (255, 255, 255)
AMBER  = (150, 100, 16)
LIGHTG = (232, 243, 236)

W, H = 320, 180
ML, MR = 14, 14          # margins
CW = W - ML - MR         # 292 content width
TOP, BOT = 26, 162       # content zone

# ---------- image prep: crop + compress ----------
def prep(src_rel, name, crop_top=0, max_w=1280, q=72):
    src = os.path.join(ROOT, src_rel)
    im = Image.open(src).convert('RGB')
    if crop_top:
        im = im.crop((0, crop_top, im.width, im.height))
    if im.width > max_w:
        im = im.resize((max_w, int(im.height * max_w / im.width)), Image.LANCZOS)
    out = os.path.join(ASSETS, name)
    im.save(out, 'JPEG', quality=q, optimize=True)
    print(f'{name}: {im.size} {os.path.getsize(out)//1024} KB')
    return out

IMG_REPORT = prep(r'progress/evidence/audit2-2026-10-15/v10-screenshots/07-p7-report.png',
                  'report.jpg', crop_top=172)
IMG_MATCH = prep(r'progress/evidence/audit2-2026-10-15/v10-screenshots/04-p4-assigned.png',
                 'matching.jpg')
IMG_DASH = prep(r'progress/evidence/audit2-2026-10-15/v10-screenshots/05-p5-dashboard.png',
                'dashboard.jpg')
IMG_REVIEW = prep(r'progress/evidence/audit2-2026-10-15/v10-screenshots/08-p8-review-edited.png',
                  'review.jpg')

# ---------- pdf setup ----------
pdf = FPDF(orientation='P', unit='mm', format=(W, H))  # (320,180) landscape via P+wide tuple
pdf.set_auto_page_break(False)
pdf.set_margins(ML, 10, MR)
pdf.add_font('arial', '', r'C:\Windows\Fonts\arial.ttf')
pdf.add_font('arial', 'B', r'C:\Windows\Fonts\arialbd.ttf')
pdf.add_font('arial', 'I', r'C:\Windows\Fonts\ariali.ttf')
pdf.set_title('CarbonLedger \u2014 Scope 3 Carbon Accounting and Disclosure Agent')
pdf.set_author('CarbonLedger')
pdf.set_creator('CarbonLedger deck builder')

CJK = re.compile(r'[\u2e80-\u9fff\uac00-\ud7af\uf900-\ufaff\u3040-\u30ff]')
ALLTEXT = []
def T(s):
    ALLTEXT.append(s)
    return s

def header(kicker):
    pdf.set_font('arial', 'B', 12)
    pdf.set_text_color(*GREEN)
    pdf.set_xy(ML, 9)
    pdf.cell(120, 7, T('CarbonLedger'))
    pdf.set_font('arial', '', 9)
    pdf.set_text_color(*MUTED)
    pdf.set_xy(W - MR - 150, 9.5)
    pdf.cell(150, 6, T(kicker), align='R')
    pdf.set_draw_color(*FAINT)
    pdf.set_line_width(0.6)
    pdf.line(ML, 19, W - MR, 19)

def footer(n):
    pdf.set_draw_color(*FAINT)
    pdf.set_line_width(0.6)
    pdf.line(ML, 166, W - MR, 166)
    pdf.set_font('arial', '', 8)
    pdf.set_text_color(*MUTED)
    pdf.set_xy(ML, 167.5)
    pdf.cell(220, 5, T('Sustainability & Social Impact  \u00b7  myproject-dc19d.web.app'))
    pdf.set_xy(W - MR - 40, 167.5)
    pdf.cell(40, 5, T(f'{n} / 13'), align='R')

def page_title(text, sub=None):
    pdf.set_font('arial', 'B', 21)
    pdf.set_text_color(*INK)
    pdf.set_xy(ML, TOP)
    pdf.multi_cell(CW, 9, T(text))
    y = pdf.get_y()
    if sub:
        pdf.set_font('arial', '', 10.5)
        pdf.set_text_color(*MUTED)
        pdf.set_xy(ML, y + 0.5)
        pdf.multi_cell(CW, 5.5, T(sub))
        y = pdf.get_y()
    return y + 3

def bullets(x, y, width, items, size=10.5, lh=5.6, gap=2.2, bold_lead=True):
    for lead, rest in items:
        pdf.set_xy(x, y)
        pdf.set_font('arial', '', size)
        pdf.set_text_color(*MUTED)
        pdf.cell(5, lh, T('\u2022 '))
        tx = x + 5
        if lead:
            pdf.set_xy(tx, y)
            pdf.set_font('arial', 'B', size)
            pdf.set_text_color(*INK)
            wlead = pdf.get_string_width(lead + ' ') + 1
            pdf.cell(wlead, lh, T(lead + ' '))
            tx += wlead
        pdf.set_xy(tx, y)
        pdf.set_font('arial', '', size)
        pdf.set_text_color(*INK)
        pdf.multi_cell(width - (tx - x), lh, T(rest))
        y = pdf.get_y() + gap
    return y

def card(x, y, w, h, fill=WHITE, border=FAINT, radius=3):
    pdf.set_fill_color(*fill)
    pdf.set_draw_color(*border)
    pdf.set_line_width(0.5)
    pdf.rect(x, y, w, h, style='DF', round_corners=True, corner_radius=radius)

def shot(path, x, y, w):
    im = Image.open(path)
    h = w * im.height / im.width
    pdf.set_draw_color(*FAINT)
    pdf.set_line_width(0.5)
    pdf.image(path, x=x, y=y, w=w, h=h)
    pdf.rect(x, y, w, h, style='D')
    return h

maxy = {}
def end_page(n):
    m = pdf.get_y()
    maxy[n] = m
    footer(n)

# ================= P1 COVER =================
pdf.add_page()
pdf.set_fill_color(*DEEP)
pdf.rect(0, 0, W, H, style='F')
pdf.set_fill_color(14, 95, 68)
pdf.rect(0, 118, W, 62, style='F')
pdf.set_font('arial', 'B', 11)
pdf.set_text_color(168, 220, 192)
pdf.set_xy(ML, 12)
pdf.cell(CW, 6, T('AI BUILDER CUP 2026  \u00b7  GOOGLE CLOUD JAPAC HACKATHON'))
pdf.set_font('arial', 'B', 30)
pdf.set_text_color(*WHITE)
pdf.set_xy(ML, 26)
pdf.multi_cell(CW, 12.5, T('CarbonLedger \u2014 Scope 3 Carbon Accounting\nand Disclosure Agent'))
y = pdf.get_y() + 4
pdf.set_fill_color(11, 77, 55)
pdf.set_draw_color(*WHITE)
pdf.set_line_width(0.8)
tw = pdf.get_string_width('Track: Sustainability & Social Impact') + 12
pdf.rect(ML, y, tw + 6, 11, style='D', round_corners=True, corner_radius=5.5)
pdf.set_font('arial', 'B', 12)
pdf.set_xy(ML + 3, y + 2)
pdf.cell(tw, 7, T('Track: Sustainability & Social Impact'))
y += 18
pdf.set_fill_color(19, 105, 74)
pdf.rect(ML, y, CW, 30, style='F', round_corners=True, corner_radius=3)
pdf.set_font('arial', 'I', 12.5)
pdf.set_text_color(235, 248, 240)
pdf.set_xy(ML + 6, y + 4)
pdf.multi_cell(CW - 12, 7, T('CarbonLedger compresses the cost of producing a Scope 3 report from '
    '"$30,000 + 3 weeks" to "1 hour + near-zero marginal cost", while making every single '
    'number traceable back to its source document.'))
pdf.set_font('arial', 'B', 12)
pdf.set_text_color(*WHITE)
pdf.set_xy(ML, 158)
pdf.cell(200, 7, T('Live demo:  https://myproject-dc19d.web.app'))
pdf.set_font('arial', '', 10)
pdf.set_text_color(168, 220, 192)
pdf.set_xy(W - MR - 130, 158)
pdf.cell(130, 7, T('Anonymous sign-in \u00b7 No registration'), align='R')
maxy[1] = 165
pdf.set_font('arial', '', 8)
pdf.set_text_color(150, 200, 175)
pdf.set_xy(ML, 168)
pdf.cell(150, 5, T('CarbonLedger  \u00b7  Sustainability & Social Impact'))
pdf.set_xy(W - MR - 40, 168)
pdf.cell(40, 5, T('1 / 13'), align='R')

# ================= P2 PROBLEM =================
pdf.add_page()
header('02 \u00b7 THE PROBLEM')
y0 = page_title('Evidence is scattered. Expertise is expensive.')
cards = [
    ('Scattered evidence. ', 'Invoices, scans, photos and spreadsheets live with different suppliers. Manual compilation takes 2\u20133 weeks per report.'),
    ('Semantic, not string match. ', '"Air-freighting 1,200 kg of temperature-sensitive goods from Long Beach to Tokyo" is a reasoning task \u2014 never a keyword lookup.'),
    ('A bill that repeats. ', 'Consultant reports cost $20,000\u2013$50,000, are re-done every year, and stay hard for auditors to verify.'),
]
cw3 = (CW - 12) / 3
for i, (lead, rest) in enumerate(cards):
    x = ML + i * (cw3 + 6)
    card(x, y0, cw3, 62)
    pdf.set_xy(x + 5, y0 + 5)
    pdf.set_font('arial', 'B', 26)
    pdf.set_text_color(*GREEN)
    pdf.cell(20, 12, T(f'0{i+1}'))
    pdf.set_xy(x + 5, y0 + 22)
    pdf.set_font('arial', 'B', 11.5)
    pdf.set_text_color(*INK)
    pdf.multi_cell(cw3 - 10, 6, T(lead))
    pdf.set_xy(x + 5, pdf.get_y() + 1)
    pdf.set_font('arial', '', 10)
    pdf.set_text_color(*INK)
    pdf.multi_cell(cw3 - 10, 5.4, T(rest))
y0 += 62 + 8
pdf.set_fill_color(*DEEP)
pdf.rect(ML, y0, CW, 26, style='F', round_corners=True, corner_radius=3)
stats = [('2\u20133 WEEKS', 'of manual work per report'), ('$20,000\u2013$50,000',
    'consultant fee, every year'), ('HARD TO VERIFY', 'for auditors, line by line')]
for i, (big, small) in enumerate(stats):
    x = ML + 10 + i * (CW / 3)
    pdf.set_xy(x, y0 + 4)
    pdf.set_font('arial', 'B', 15)
    pdf.set_text_color(*WHITE)
    pdf.cell(100, 8, T(big))
    pdf.set_xy(x, y0 + 13)
    pdf.set_font('arial', '', 9.5)
    pdf.set_text_color(190, 225, 205)
    pdf.cell(100, 6, T(small))
end_page(2)

# ================= P3 SOLUTION =================
pdf.add_page()
header('03 \u00b7 THE SOLUTION')
y0 = page_title('One upload. A full, traceable report.')
items = [
    ('Mixed upload. ', 'PDF including scans, photos (JPG/PNG), XLSX and CSV \u2014 one task, one queue.'),
    ('Classify + extract. ', 'Every page classified; activity data, quantities, units and locations extracted.'),
    ('Match + grade. ', 'Public factors matched semantically; uncertainty graded per record.'),
    ('Compute. ', 'Scope 1/2/3 totals, three reduction scenarios, GWP folding with AR5/AR6 disclosure.'),
    ('Disclose. ', 'A ten-chapter GHG Protocol report with PDF/CSV export.'),
    ('Trace everything. ', 'Each number carries a citation anchor that jumps back to its source document.'),
]
y = bullets(ML, y0, 132, items, size=10, lh=5.4)
h = shot(IMG_REPORT, ML + 142, y0, CW - 142)
pdf.set_font('arial', 'I', 8.5)
pdf.set_text_color(*MUTED)
pdf.set_xy(ML + 142, y0 + h + 2)
pdf.multi_cell(CW - 142, 4.5, T('Live UI: ten-chapter report reader with clickable citation anchors.'))
end_page(3)

# ================= P4 WHY GEN AI =================
pdf.add_page()
header('04 \u00b7 WHY GEN AI IS THE PRODUCT')
y0 = page_title('Factor matching is a reasoning problem.')
items = [
    ('1 \u00b7 Recall. ', 'Dual-channel recall: keyword plus official embeddings (gemini-embedding-001); 5\u201315 candidates with threshold relaxation.'),
    ('2 \u00b7 Select. ', 'The model writes a 40+ word comparative rationale and retains the runner-up for review.'),
    ('3 \u00b7 Grade. ', 'Rule-based uncertainty grading with unit-caliber self-checks auditors can recompute.'),
]
y = bullets(ML, y0, 132, items, size=10, lh=5.4)
pdf.set_fill_color(*LIGHTG)
pdf.set_xy(ML, y + 2)
pdf.set_font('arial', 'B', 10)
pdf.set_text_color(*DEEP)
pdf.multi_cell(132, 5.6, T('Remove the model and the system cannot run: rule engines cannot choose between boundary calibers. This is the differentiator \u2014 not a wrapper.'))
y = pdf.get_y()
h = shot(IMG_MATCH, ML + 142, y0, CW - 142)
pdf.set_font('arial', 'I', 8.5)
pdf.set_text_color(*MUTED)
pdf.set_xy(ML + 142, y0 + h + 2)
pdf.multi_cell(CW - 142, 4.5, T('Live UI: best-vs-runner-up comparison with the stored rationale and recall scores.'))
pdf.set_font('arial', '', 8.5)
pdf.set_text_color(*MUTED)
pdf.set_xy(ML, 156)
pdf.cell(132, 5, T('All generative calls: gemini-3.5-flash-lite, structured output.'))
end_page(4)

# ================= P5 ANTI-HALLUCINATION =================
pdf.add_page()
header('05 \u00b7 ANTI-HALLUCINATION ENGINEERING')
y0 = page_title('Trust is engineered, not promised.')
quads = [
    ('Structured output everywhere', 'Every generative call uses a response schema. No free-text parsing anywhere in the codebase.'),
    ('Closed enums, validated', 'Enum violations are retried with the error fed back \u2014 never silently accepted.'),
    ('Candidates only', 'A factor id outside the candidate list is a failed call. It is retried, never used.'),
    ('Citation veto', 'Every numeric conclusion carries an anchor. One dangling reference vetoes the whole verdict.'),
]
qw = (CW - 8) / 2
for i, (t, d) in enumerate(quads):
    x = ML + (i % 2) * (qw + 8)
    yy = y0 + (i // 2) * 44
    card(x, yy, qw, 40)
    pdf.set_xy(x + 6, yy + 5)
    pdf.set_font('arial', 'B', 11.5)
    pdf.set_text_color(*DEEP)
    pdf.multi_cell(qw - 12, 6, T(t))
    pdf.set_xy(x + 6, pdf.get_y() + 1)
    pdf.set_font('arial', '', 10)
    pdf.set_text_color(*INK)
    pdf.multi_cell(qw - 12, 5.4, T(d))
y0 += 2 * 44 + 7
pdf.set_fill_color(*DEEP)
pdf.rect(ML, y0, CW, 17, style='F', round_corners=True, corner_radius=3)
pdf.set_font('arial', 'B', 12)
pdf.set_text_color(*WHITE)
pdf.set_xy(ML, y0 + 4.5)
pdf.cell(CW, 8, T('Measured:  100% citation coverage   \u00b7   0 invalid references'), align='C')
end_page(5)

# ================= P6 PIPELINE + DATA =================
pdf.add_page()
header('06 \u00b7 PIPELINE AND DATA')
y0 = page_title('From upload to audited disclosure.')
pdf.set_font('arial', 'B', 11)
pdf.set_text_color(*DEEP)
pdf.set_xy(ML, y0)
pdf.cell(150, 6, T('Eleven steps, fully traced'))
steps = ['task creation', 'upload & parsing', 'page classification', 'field extraction',
         'normalization', 'boundary decision', 'factor recall', 'factor selection',
         'uncertainty grading', 'calculation', 'scenarios \u2192 report & review']
sy = y0 + 8
for i, s in enumerate(steps):
    col, row = (0, i) if i < 6 else (1, i - 6)
    x = ML + col * 74
    yy = sy + row * 11.5
    pdf.set_fill_color(*LIGHTG)
    pdf.set_font('arial', 'B', 8.5)
    pdf.set_text_color(*DEEP)
    pdf.set_xy(x, yy)
    pdf.cell(9, 8, T(f'{i+1}'))
    pdf.set_font('arial', '', 8.5)
    pdf.set_text_color(*INK)
    pdf.set_xy(x + 9, yy)
    pdf.cell(63, 8, T(s))
yy = sy + 6 * 11.5 + 3
pdf.set_font('arial', '', 9.5)
pdf.set_text_color(*INK)
pdf.set_xy(ML, yy)
pdf.multi_cell(148, 5.4, T('Uncertain records route to a human review queue. Every AI call logs latency, tokens and cost into ai_traces.'))
# right data panel
px = ML + 162
card(px, y0, CW - 162, 108, fill=LIGHTG, border=LIGHTG)
pdf.set_font('arial', 'B', 44)
pdf.set_text_color(*GREEN)
pdf.set_xy(px, y0 + 6)
pdf.cell(CW - 162, 20, T('741'), align='C')
pdf.set_font('arial', 'B', 11)
pdf.set_text_color(*INK)
pdf.set_xy(px + 8, y0 + 30)
pdf.multi_cell(CW - 162 - 16, 6, T('public emission factors,\nshipped offline'), align='C')
pdf.set_font('arial', '', 9.5)
pdf.set_text_color(*MUTED)
pdf.set_xy(px + 8, y0 + 50)
pdf.multi_cell(CW - 162 - 16, 5.4, T('UK DESNZ 2026 + US EPA 2025 + USEEIO \u00b7 five industries \u00b7 loading never touches the network'), align='C')
pdf.set_font('arial', 'B', 9.5)
pdf.set_text_color(*DEEP)
pdf.set_xy(px + 8, y0 + 78)
pdf.multi_cell(CW - 162 - 16, 5.4, T('Data-only growth: new industries need zero code change.'), align='C')
end_page(6)

# ================= P7 ARCHITECTURE =================
pdf.add_page()
header('07 \u00b7 ARCHITECTURE')
y0 = page_title('Boring infra. Serious guarantees.')
boxes = [('React SPA', 'Firebase Hosting'), ('Node / Express API', 'Cloud Run \u00b7 scale-to-zero'),
         ('Firestore + Storage', 'Cloud Tasks queue'), ('Gemini AI layer', 'Flash-Lite + embedding-001')]
bw = (CW - 3 * 10) / 4
for i, (a, b) in enumerate(boxes):
    x = ML + i * (bw + 10)
    card(x, y0, bw, 34, fill=LIGHTG, border=LIGHTG)
    pdf.set_font('arial', 'B', 10.5)
    pdf.set_text_color(*INK)
    pdf.set_xy(x + 4, y0 + 5)
    pdf.multi_cell(bw - 8, 5.6, T(a), align='C')
    pdf.set_font('arial', '', 9)
    pdf.set_text_color(*MUTED)
    pdf.set_xy(x + 4, pdf.get_y() + 1)
    pdf.multi_cell(bw - 8, 5, T(b), align='C')
    if i < 3:
        ax = x + bw + 2
        pdf.set_font('arial', 'B', 14)
        pdf.set_text_color(*GREEN)
        pdf.set_xy(ax, y0 + 11)
        pdf.cell(6, 8, T('>'))
y0 += 34 + 7
notes = [
    ('Zero-barrier access. ', 'Anonymous sign-in completes automatically; a judge uses the full flow with no registration. Per-uid task ownership isolates every visitor.'),
    ('Reproducible offline. ', 'Local storage adapters run the identical code for tests and the offline evaluation tool \u2014 no mocks in measured metrics.'),
    ('Observable. ', 'Cloud Logging/Trace plus per-call ai_traces: input/output summary, latency, tokens and cost estimate.'),
]
bullets(ML, y0, CW, notes, size=10, lh=5.6)
end_page(7)

# ================= P8 EVALUATION =================
pdf.add_page()
header('08 \u00b7 EVALUATION')
y0 = page_title('Measured, not claimed \u2014 11/11 PASS.',
               'Full run on the real adapter and the public deployment. Overall verdict: PASS.')
rows = [
    ('Document classification (Top-1)', '\u2265 93%', '29/30 (96.7%)'),
    ('Field extraction accuracy', 'avg \u2265 95%; qty/unit \u2265 98%', '100.0% (qty 100%, unit 100%)'),
    ('Factor matching (Top-1 / Top-3)', '\u2265 85% / \u2265 95%', '34/40 (85.0%) / 39/40 (97.5%)'),
    ('Scope decision accuracy', '\u2265 90%', 'scope 9/10, category 12/12'),
    ('Calculation correctness', '100%', '10/10 exact'),
    ('Citation coverage', '100%', '100%'),
    ('Invalid references (veto)', '0', '0'),
    ('End-to-end P90, 20 docs', '\u2264 3 min', '61.3 s'),
    ('AI cost per document', '\u2264 $0.03', '$0.00058'),
]
c1, c2, c3 = 108, 78, CW - 108 - 78
pdf.set_fill_color(*DEEP)
pdf.rect(ML, y0, CW, 10, style='F')
pdf.set_font('arial', 'B', 10)
pdf.set_text_color(*WHITE)
for x, w, t in [(ML, c1, 'Metric'), (ML + c1, c2, 'Target'), (ML + c1 + c2, c3, 'Measured')]:
    pdf.set_xy(x + 3, y0 + 2)
    pdf.cell(w - 3, 6, T(t))
yy = y0 + 10
pdf.set_font('arial', '', 9.3)
for i, (m, t2, ms) in enumerate(rows):
    h = 11.3
    if i % 2 == 0:
        pdf.set_fill_color(*BG)
        pdf.rect(ML, yy, CW, h, style='F')
    pdf.set_text_color(*INK)
    pdf.set_xy(ML + 3, yy + 2.8)
    pdf.cell(c1 - 3, 6, T(m))
    pdf.set_text_color(*MUTED)
    pdf.set_xy(ML + c1 + 3, yy + 2.8)
    pdf.cell(c2 - 3, 6, T(t2))
    pdf.set_font('arial', 'B', 9.3)
    pdf.set_text_color(*DEEP)
    pdf.set_xy(ML + c1 + c2 + 3, yy + 2.8)
    pdf.cell(c3 - 3, 6, T(ms))
    pdf.set_font('arial', '', 9.3)
    yy += h
pdf.set_draw_color(*FAINT)
pdf.set_line_width(0.4)
pdf.rect(ML, y0, CW, yy - y0, style='D')
pdf.set_font('arial', '', 8.5)
pdf.set_text_color(*MUTED)
pdf.set_xy(ML, yy + 3)
pdf.multi_cell(CW, 5, T('Machine-readable JSON + human-readable markdown: eval/results/run-online/. P90 latency from 10 public one-click runs; cost covers 102 model calls per 20-document run.'))
end_page(8)

# ================= P9 SCENARIOS =================
pdf.add_page()
header('09 \u00b7 SCENARIO INTELLIGENCE')
y0 = page_title('Every report ships with a reduction plan.')
sc = [('S-1 \u00b7 Mode shift', 'Move freight to lower-carbon transport modes; savings computed from the same ledger math.'),
      ('S-2 \u00b7 Supplier swap', 'Re-point activity to cleaner suppliers or grids and see the delta instantly.'),
      ('S-3 \u00b7 Material substitution', 'Replace carbon-intensive inputs; every figure stays hand-recomputable.')]
cw3 = (CW - 12) / 3
for i, (t, d) in enumerate(sc):
    x = ML + i * (cw3 + 6)
    card(x, y0, cw3, 56)
    pdf.set_font('arial', 'B', 13)
    pdf.set_text_color(*GREEN)
    pdf.set_xy(x + 6, y0 + 6)
    pdf.multi_cell(cw3 - 12, 6.5, T(t))
    pdf.set_font('arial', '', 10)
    pdf.set_text_color(*INK)
    pdf.set_xy(x + 6, pdf.get_y() + 2)
    pdf.multi_cell(cw3 - 12, 5.6, T(d))
y0 += 56 + 8
pdf.set_fill_color(*LIGHTG)
pdf.rect(ML, y0, CW, 24, style='F', round_corners=True, corner_radius=3)
pdf.set_font('arial', '', 10)
pdf.set_text_color(*INK)
pdf.set_xy(ML + 6, y0 + 4)
pdf.multi_cell(CW - 12, 5.6, T('Adjustable ratios for what-if planning. Scenarios with no applicable activity are stated honestly as zero \u2014 never padded to look good.'))
end_page(9)

# ================= P10 HITL =================
pdf.add_page()
header('10 \u00b7 HUMAN-IN-THE-LOOP BY DESIGN')
y0 = page_title('Humans decide where it matters.')
items = [
    ('Sorted by doubt. ', 'The review queue ranks records by uncertainty, highest first \u2014 reviewers start where risk is.'),
    ('Edits recalculate. ', 'A field edit immediately recalculates affected totals and refreshes the report.'),
    ('Overrides are labelled. ', 'Manual factor assignments are tagged, take precedence, and stay auditable.'),
    ('Exclusions need reasons. ', 'Excluded records require an English reason and still appear in the report.'),
]
bullets(ML, y0, 132, items, size=10, lh=5.4)
h = shot(IMG_REVIEW, ML + 142, y0, CW - 142)
pdf.set_font('arial', 'I', 8.5)
pdf.set_text_color(*MUTED)
pdf.set_xy(ML + 142, y0 + h + 2)
pdf.multi_cell(CW - 142, 4.5, T('Live UI: review queue with inline editing, exclusion reasons and instant recalculation.'))
end_page(10)

# ================= P11 IMPACT =================
pdf.add_page()
header('11 \u00b7 IMPACT')
y0 = page_title('From a $30,000 engagement to self-serve.')
comp = [('Cost', '$20,000\u2013$50,000, yearly', 'Near-zero marginal cost ($0.00058/doc)'),
        ('Time', '2\u20133 weeks', 'About 1 hour (P90 61.3 s / 20 docs)'),
        ('Trust', 'Hard for auditors to verify', 'Every number traceable to source'),
        ('Reuse', 'A new bill each period', 'Reusable every reporting period')]
lw = 132
pdf.set_fill_color(*DEEP)
pdf.rect(ML, y0, lw, 10, style='F')
pdf.set_font('arial', 'B', 9.5)
pdf.set_text_color(*WHITE)
pdf.set_xy(ML + 3, y0 + 2)
pdf.cell(30, 6, T(''))
pdf.set_xy(ML + 34, y0 + 2)
pdf.cell(44, 6, T('Consultant'))
pdf.set_xy(ML + 80, y0 + 2)
pdf.cell(52, 6, T('CarbonLedger'))
yy = y0 + 10
for i, (m, c, k) in enumerate(comp):
    h = 14.5
    if i % 2 == 0:
        pdf.set_fill_color(*BG)
        pdf.rect(ML, yy, lw, h, style='F')
    pdf.set_font('arial', 'B', 9.5)
    pdf.set_text_color(*INK)
    pdf.set_xy(ML + 3, yy + 2)
    pdf.cell(30, 5, T(m))
    pdf.set_font('arial', '', 8.8)
    pdf.set_text_color(*MUTED)
    pdf.set_xy(ML + 34, yy + 2)
    pdf.multi_cell(44, 5, T(c))
    pdf.set_font('arial', 'B', 8.8)
    pdf.set_text_color(*DEEP)
    pdf.set_xy(ML + 80, yy + 2)
    pdf.multi_cell(50, 5, T(k))
    yy += h
pdf.set_draw_color(*FAINT)
pdf.rect(ML, y0, lw, yy - y0, style='D')
pdf.set_font('arial', '', 9.5)
pdf.set_text_color(*INK)
pdf.set_xy(ML, yy + 4)
pdf.multi_cell(lw, 5.4, T('SMEs self-serve a compliance artifact they previously outsourced \u2014 then reuse it every period.'))
h = shot(IMG_DASH, ML + 142, y0, CW - 142)
pdf.set_font('arial', 'I', 8.5)
pdf.set_text_color(*MUTED)
pdf.set_xy(ML + 142, y0 + h + 2)
pdf.multi_cell(CW - 142, 4.5, T('Live UI: emissions dashboard \u2014 scope donut, top sources, uncertainty split.'))
end_page(11)

# ================= P12 ROADMAP =================
pdf.add_page()
header('12 \u00b7 ROADMAP')
y0 = page_title('What comes next.')
items = [
    ('More industries, data-only. ', 'New sectors arrive as factor-file additions \u2014 zero code change to the pipeline.'),
    ('Supplier-specific factors. ', 'Intake path for primary supplier data alongside public averages, with provenance kept.'),
    ('Assurance-ready exports. ', 'Evidence packs shaped for third-party verification: ledger, citations, method notes.'),
    ('Why it scales. ', 'The factor library is data; the pipeline is industry-agnostic; the review loop compounds trust.'),
]
bullets(ML, y0, 190, items, size=10.5, lh=5.8)
px = ML + 202
card(px, y0, CW - 202, 84, fill=LIGHTG, border=LIGHTG)
pdf.set_font('arial', 'B', 13)
pdf.set_text_color(*DEEP)
pdf.set_xy(px + 7, y0 + 8)
pdf.multi_cell(CW - 202 - 14, 6.5, T('Built for this track'))
pdf.set_font('arial', '', 10)
pdf.set_text_color(*INK)
pdf.set_xy(px + 7, pdf.get_y() + 2)
pdf.multi_cell(CW - 202 - 14, 5.6, T('Entered in AI Builder Cup 2026, Sustainability & Social Impact: measurable decarbonization leverage for every SME supplier in a value chain.'))
end_page(12)

# ================= P13 CLOSING =================
pdf.add_page()
pdf.set_fill_color(*DEEP)
pdf.rect(0, 0, W, H, style='F')
pdf.set_font('arial', '', 11)
pdf.set_text_color(168, 220, 192)
pdf.set_xy(ML, 18)
pdf.cell(CW, 6, T('TRACK:  SUSTAINABILITY & SOCIAL IMPACT'))
pdf.set_font('arial', 'B', 27)
pdf.set_text_color(*WHITE)
pdf.set_xy(ML, 30)
pdf.multi_cell(CW, 12, T('Every number traceable.\nEvery report reproducible.'))
pdf.set_font('arial', '', 12)
pdf.set_text_color(215, 238, 226)
pdf.set_xy(ML, 70)
pdf.multi_cell(CW, 7, T('Try it now \u2014 anonymous sign-in, one-click 20-document dataset, ten-chapter report in about a minute.'))
pdf.set_fill_color(*WHITE)
pdf.rect(ML, 100, CW, 26, style='F', round_corners=True, corner_radius=4)
pdf.set_font('arial', 'B', 17)
pdf.set_text_color(*DEEP)
pdf.set_xy(ML, 106)
pdf.cell(CW, 12, T('https://myproject-dc19d.web.app'), align='C')
pdf.set_font('arial', '', 10.5)
pdf.set_text_color(190, 225, 205)
pdf.set_xy(ML, 134)
pdf.multi_cell(CW, 6, T('Full source code, evaluation evidence and this deck ship with the submission. Thank you.'))
maxy[13] = 165
pdf.set_font('arial', '', 8)
pdf.set_text_color(150, 200, 175)
pdf.set_xy(ML, 168)
pdf.cell(150, 5, T('CarbonLedger  \u00b7  Sustainability & Social Impact'))
pdf.set_xy(W - MR - 40, 168)
pdf.cell(40, 5, T('13 / 13'), align='R')

# ---------- guards ----------
bad = [s for s in ALLTEXT if CJK.search(s)]
assert not bad, f'CJK found: {bad[:3]}'
for n, m in maxy.items():
    print(f'page {n}: max_y={m:.1f}')
    assert m < 165.5, f'page {n} overflow'

out = os.path.join(DELIV, 'CarbonLedger_Deck.pdf')
pdf.output(out)
print('pages:', len(pdf.pages))
print('size KB:', os.path.getsize(out) // 1024)
