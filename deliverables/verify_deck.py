import os, re
from pypdf import PdfReader

path = r'D:\opencode\carbonledger\deliverables\CarbonLedger_Deck.pdf'
r = PdfReader(path)
print('pages:', len(r.pages))
print('bytes:', os.path.getsize(path))
full = '\n'.join((p.extract_text() or '') for p in r.pages)
cjk = re.findall(r'[一-鿿豈-﫿぀-ヿ가-힯]', full)
print('CJK chars:', len(cjk), cjk[:10])
checks = [
    'CarbonLedger \u2014 Scope 3 Carbon Accounting', 'and Disclosure Agent',
    'Sustainability & Social Impact',
    'CarbonLedger compresses the cost of producing a Scope 3 report',
    '"$30,000 + 3 weeks"',
    '"1 hour + near-zero marginal cost"',
    'every single number traceable back to its source document',
    '29/30 (96.7%)',
    '100.0% (qty 100%, unit 100%)',
    '34/40 (85.0%) / 39/40 (97.5%)',
    'scope 9/10, category 12/12',
    '10/10 exact',
    '61.3 s',
    '$0.00058',
    'myproject-dc19d.web.app',
    'gemini-3.5-flash-lite',
    'gemini-embedding-001',
    '741',
]
ok = True
for s in checks:
    hit = s in full
    ok = ok and hit
    print(('FOUND   ' if hit else 'MISSING ') + s)
print('ALL OK' if ok else 'FAILURES PRESENT')
