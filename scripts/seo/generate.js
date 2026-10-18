// SEO asset generator for CarbonLedger (run: node scripts/seo/generate.js).
//
// Produces, into frontend/public/ (copied verbatim into dist by Vite):
//   - favicon.svg / favicon.ico / favicon-16x16.png / favicon-32x32.png
//   - apple-touch-icon.png, icons/icon-192.png, icons/icon-512.png,
//     icons/icon-maskable-512.png
//   - og/og-<lang>.png (1200x630 Open Graph card, one per locale)
//   - <lang>/index.html localized, crawler-friendly landing pages
//   - robots.txt, sitemap.xml (with the hreflang cluster), site.webmanifest
//
// All copy lives in scripts/seo/locales.json (translations are delegated to
// the translator agent; regenerate after editing that file only).
// Rasterization uses headless Microsoft Edge (Chromium) from the system; no
// npm dependency is added. The English canonical page is frontend/index.html
// (hand-maintained) — only its OG image and sitemap entry are generated here.
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, mkdtempSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readPng, pixelAlpha } from './png.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const PUB = join(ROOT, 'frontend', 'public');
const WORK = mkdtempSync(join(tmpdir(), 'carbonledger-seo-'));
process.on('exit', () => rmSync(WORK, { recursive: true, force: true })); // even on early failures

const CONFIG = JSON.parse(readFileSync(join(HERE, 'locales.json'), 'utf8'));
const SITE = CONFIG.site;
const HOST = new URL(SITE).host; // shown as card/footer text, derived from the site URL
const LOCALES = CONFIG.locales;
const EN = LOCALES.find((l) => l.lang === 'en');

// Brand palette (mirrors frontend/src/styles.css tokens).
const C = {
  accent: '#1d6f54', accentDeep: '#0e4534', bg: '#f6f8f7', ink: '#1f2933',
  inkSoft: '#52606d', line: '#e3e7ea', accentSoft: '#e7f2ed', accentLine: '#b7d9cc',
  ogFrom: '#0c3a2c', ogMid: '#155843', ogTo: '#1d6f54',
};

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const pageUrl = (l) => (l.path ? `${SITE}/${l.path}/` : `${SITE}/`);
const hreflangCluster = () => LOCALES.map((l) => ({ hreflang: l.lang, href: pageUrl(l) }))
  .concat([{ hreflang: 'x-default', href: `${SITE}/` }]);

function findEdge() {
  const candidates = [
    process.env.EDGE_PATH,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean);
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error('Microsoft Edge not found; set EDGE_PATH to a Chromium executable');
  return found;
}
const EDGE = findEdge();

/** Renders an HTML or SVG document to an exact-size PNG via headless Edge. */
function render(content, w, h, outFile, { extension = 'html' } = {}) {
  const src = join(WORK, `r${render.counter += 1}.${extension}`);
  writeFileSync(src, content, 'utf8');
  const out = spawnSync(EDGE, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--disable-extensions',
    '--no-first-run', '--no-default-browser-check', '--force-device-scale-factor=1',
    `--window-size=${w},${h}`, '--default-background-color=00000000',
    '--virtual-time-budget=5000', `--user-data-dir=${join(WORK, 'profile')}`,
    `--screenshot=${outFile}`, pathToFileURL(src).href,
  ], { timeout: 90000, encoding: 'utf8' });
  if (out.error) throw out.error;
  if (!existsSync(outFile)) throw new Error(`Edge did not produce ${outFile}\n${out.stdout}\n${out.stderr}`);
  return outFile;
}
render.counter = 0;

// ---------------------------------------------------------------- logo SVG
// A white leaf whose veins are ledger bars (descending = reduction), on a
// green gradient tile. One mark, three colorings, reused everywhere.
function leafMark({ leaf, bars, stem }, scale = 1) {
  const body = `
    <path d="M256 88 C372 148 412 268 256 424 C100 268 140 148 256 88 Z" fill="${leaf}"/>
    <rect x="172" y="212" width="168" height="30" rx="15" fill="${bars}"/>
    <rect x="194" y="258" width="124" height="30" rx="15" fill="${bars}"/>
    <rect x="215" y="304" width="82" height="30" rx="15" fill="${bars}"/>
    <path d="M256 424 C258 456 282 474 314 478" fill="none" stroke="${stem}" stroke-width="20" stroke-linecap="round"/>`;
  return scale === 1 ? body : `<g transform="translate(256 256) scale(${scale}) translate(-256 -256)">${body}</g>`;
}

function iconSVG(size, { rx = 96, markScale = 1 } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs><linearGradient id="clg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${C.accent}"/><stop offset="1" stop-color="${C.accentDeep}"/>
  </linearGradient></defs>
  <rect width="512" height="512" rx="${rx}" fill="url(#clg)"/>
  ${leafMark({ leaf: '#ffffff', bars: C.accentDeep, stem: '#ffffff' }, markScale)}
</svg>`;
}

/** Small white rounded tile with the green mark — used on the OG card. */
function ogTileSVG() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="116" height="116" viewBox="0 0 116 116">
  <rect width="116" height="116" rx="28" fill="#ffffff"/>
  <g transform="translate(58 58) scale(0.172) translate(-256 -256)">
    ${leafMark({ leaf: C.accent, bars: '#ffffff', stem: C.accent })}
  </g>
</svg>`;
}

/** Outline-only oversized leaf used as OG-card background decoration. */
function ogDecoSVG() {
  return `<svg class="deco" viewBox="0 0 512 512" aria-hidden="true">
  <path d="M256 88 C372 148 412 268 256 424 C100 268 140 148 256 88 Z" fill="none" stroke="rgba(255,255,255,0.09)" stroke-width="14"/>
</svg>`;
}

// ---------------------------------------------------------------- OG card
function ogHTML(loc) {
  const s = loc.strings;
  return `<!doctype html>
<html lang="${loc.lang}" dir="${loc.dir}">
<head><meta charset="utf-8"><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1200px; height: 630px; overflow: hidden; }
  .og { position: relative; width: 1200px; height: 630px; overflow: hidden;
        background: linear-gradient(132deg, ${C.ogFrom} 0%, ${C.ogMid} 55%, ${C.ogTo} 100%);
        font-family: ${loc.font}; color: #ffffff; display: flex; flex-direction: column;
        justify-content: center; padding: 0 76px; text-align: start; }
  .og::after { content: ''; position: absolute; inset: 0;
        background: radial-gradient(760px 440px at 82% 16%, rgba(255,255,255,0.10), transparent 70%); }
  .deco { position: absolute; inset-inline-end: -64px; top: 26px; width: 540px; height: 540px; }
  .row { display: flex; align-items: center; gap: 28px; }
  .row svg { width: 116px; height: 116px; display: block;
        filter: drop-shadow(0 6px 18px rgba(0,0,0,0.25)); }
  .name { font-size: 63px; font-weight: 700; letter-spacing: -1px; line-height: 1.05; }
  .tagline { margin-top: 24px; font-size: 30px; line-height: 1.42; font-weight: 400;
        color: #d9efe6; max-width: 880px; }
  .chips { margin-top: 34px; display: flex; gap: 13px; flex-wrap: wrap; }
  .chips span { font-size: 16.5px; color: #d3ebe1; border: 1.5px solid rgba(255,255,255,0.42);
        border-radius: 999px; padding: 9px 20px; white-space: nowrap; }
  .url { position: absolute; bottom: 42px; inset-inline-start: 76px; font-size: 16px;
        letter-spacing: 0.6px; color: rgba(255,255,255,0.68); }
</style></head>
<body>
  <div class="og">
    ${ogDecoSVG()}
    <div class="row">${ogTileSVG()}<div class="name" dir="ltr">CarbonLedger</div></div>
    <div class="tagline">${esc(s.tagline)}</div>
    <div class="chips">${CONFIG.chips.map((c) => `<span dir="ltr">${esc(c)}</span>`).join('')}</div>
    <div class="url" dir="ltr">${HOST}</div>
  </div>
</body>
</html>`;
}

// ------------------------------------------------------------ landing page
const FEATURE_ICONS = [
  '<path d="M12 16V5m0 0 4 4m-4-4-4 4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke-linecap="round" stroke-linejoin="round"/>',
  '<path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.2 2.2m8.4 8.4 2.2 2.2m0-12.8-2.2 2.2M7.8 16.2l-2.2 2.2" stroke-linecap="round"/><circle cx="12" cy="12" r="3.2"/>',
  '<path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.2 1.2" stroke-linecap="round"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7L12.7 18" stroke-linecap="round"/>',
  '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h3m5 0h.01M8 15h3m5 0h.01M8 19h3m5 0h.01" stroke-linecap="round"/>',
  '<path d="M4 20V10m5 10V4m5 16v-7m5 7V8" stroke-linecap="round"/>',
  '<path d="M12 3 4 6v5c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10V6l-8-3Z" stroke-linejoin="round"/><path d="m9 12 2 2 4-4.5" stroke-linecap="round" stroke-linejoin="round"/>',
];

function landingHTML(loc) {
  const s = loc.strings;
  const title = `CarbonLedger — ${s.tagline}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'CarbonLedger',
    url: pageUrl(loc),
    description: s.description,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Any (web browser)',
    browserRequirements: 'Requires JavaScript',
    inLanguage: loc.lang,
    isAccessibleForFree: true,
    featureList: s.features.map((f) => f.title),
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    publisher: { '@type': 'Organization', name: 'CarbonLedger', url: `${SITE}/` },
  };
  const alternates = LOCALES.filter((l) => l.lang !== loc.lang).map((l) => l.ogLocale);
  const headLinks = hreflangCluster().map((a) =>
    `    <link rel="alternate" hreflang="${a.hreflang}" href="${a.href}" />`).join('\n');
  const cards = s.features.map((f, i) => `
      <li class="card">
        <span class="ic"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="${C.accent}" stroke-width="1.8">${FEATURE_ICONS[i]}</svg></span>
        <h2>${esc(f.title)}</h2>
        <p>${esc(f.desc)}</p>
      </li>`).join('');
  const langLinks = LOCALES.map((l) => l.lang === loc.lang
    ? `<a href="${pageUrl(l)}" aria-current="true">${esc(l.native)}</a>`
    : `<a href="${pageUrl(l)}" hreflang="${l.lang}">${esc(l.native)}</a>`).join('');

  return `<!doctype html>
<html lang="${loc.lang}" dir="${loc.dir}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(s.description)}" />
    <meta name="robots" content="index, follow" />
    <meta name="author" content="CarbonLedger Team" />
    <meta name="theme-color" content="${C.accent}" />
    <link rel="canonical" href="${pageUrl(loc)}" />
${headLinks}
    <link rel="icon" href="/favicon.ico" sizes="any" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
    <link rel="manifest" href="/site.webmanifest" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="CarbonLedger" />
    <meta property="og:url" content="${pageUrl(loc)}" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(s.description)}" />
    <meta property="og:image" content="${SITE}/og/og-${loc.lang}.png" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${esc(s.og_alt)}" />
    <meta property="og:locale" content="${loc.ogLocale}" />
${alternates.map((a) => `    <meta property="og:locale:alternate" content="${a}" />`).join('\n')}
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(s.description)}" />
    <meta name="twitter:image" content="${SITE}/og/og-${loc.lang}.png" />
    <meta name="twitter:image:alt" content="${esc(s.og_alt)}" />
    <script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; background: ${C.bg}; color: ${C.ink};
             font-family: ${loc.font}; -webkit-font-smoothing: antialiased; }
      a { color: ${C.accent}; }
      .wrap { max-width: 1000px; margin: 0 auto; padding: 0 24px; }
      header { background: #ffffff; border-bottom: 1px solid ${C.line}; }
      header .in { display: flex; align-items: center; gap: 12px; max-width: 1000px;
                   margin: 0 auto; padding: 13px 24px; }
      header .in svg { width: 38px; height: 38px; display: block; }
      .brand { font-weight: 700; font-size: 20px; color: ${C.accent}; text-decoration: none; }
      header .open { margin-inline-start: auto; font-size: 14.5px; font-weight: 600;
                     text-decoration: none; color: ${C.accent};
                     border: 1px solid ${C.accentLine}; background: ${C.accentSoft};
                     padding: 8px 16px; border-radius: 8px; }
      .hero { padding: 62px 0 30px; }
      h1 { font-size: clamp(30px, 4.6vw, 44px); line-height: 1.16; letter-spacing: -0.5px;
           margin: 0; max-width: 840px; }
      .lead { margin: 18px 0 0; font-size: 18px; line-height: 1.65; color: ${C.inkSoft};
              max-width: 780px; }
      .cta { display: inline-block; margin-top: 30px; background: ${C.accent}; color: #ffffff;
             text-decoration: none; font-weight: 600; font-size: 17px; padding: 14px 30px;
             border-radius: 10px; box-shadow: 0 2px 10px rgba(29, 111, 84, 0.28); }
      .cta:hover { background: #17604a; }
      .note { margin-top: 14px; font-size: 14px; color: ${C.inkSoft}; }
      ul.grid { list-style: none; padding: 0; margin: 46px 0 0;
                display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
      .card { background: #ffffff; border: 1px solid ${C.line}; border-radius: 10px;
              padding: 20px; box-shadow: 0 1px 2px rgba(31, 41, 51, 0.05); }
      .card .ic { width: 38px; height: 38px; border-radius: 9px; background: ${C.accentSoft};
                  display: flex; align-items: center; justify-content: center; }
      .card h2 { margin: 12px 0 0; font-size: 16.5px; }
      .card p { margin: 6px 0 0; font-size: 14.5px; line-height: 1.55; color: ${C.inkSoft}; }
      .langs { margin: 44px 0 0; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
      .langs svg { width: 18px; height: 18px; stroke: ${C.inkSoft}; margin-inline-end: 4px; }
      .langs a { font-size: 13.5px; color: ${C.inkSoft}; text-decoration: none; padding: 6px 12px;
                 border: 1px solid ${C.line}; border-radius: 999px; background: #ffffff; }
      .langs a[aria-current="true"] { color: ${C.accent}; border-color: ${C.accentLine};
                 background: ${C.accentSoft}; font-weight: 600; }
      footer { border-top: 1px solid ${C.line}; margin-top: 58px; background: #ffffff; }
      footer .in { max-width: 1000px; margin: 0 auto; padding: 22px 24px; font-size: 13.5px;
                   color: ${C.inkSoft}; display: flex; flex-wrap: wrap; gap: 8px 16px;
                   justify-content: space-between; }
      @media (max-width: 860px) { ul.grid { grid-template-columns: repeat(2, 1fr); } }
      @media (max-width: 560px) { ul.grid { grid-template-columns: 1fr; } }
    </style>
  </head>
  <body>
    <header>
      <div class="in">
        ${iconSVG(38)}
        <a class="brand" href="/">CarbonLedger</a>
        <a class="open" href="/">${esc(s.cta)}</a>
      </div>
    </header>
    <main class="wrap">
      <section class="hero">
        <h1>${esc(s.tagline)}</h1>
        <p class="lead">${esc(s.description)}</p>
        <a class="cta" href="/">${esc(s.cta)}</a>
        <p class="note">${esc(s.note)}</p>
      </section>
      <ul class="grid">${cards}
      </ul>
      <nav class="langs" aria-label="Language">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3Z"/></svg>
        ${langLinks}
      </nav>
    </main>
    <footer>
      <div class="in">
        <span>CarbonLedger · Sustainability &amp; Social Impact — AI Builder Cup 2026</span>
        <span>${HOST}</span>
      </div>
    </footer>
  </body>
</html>
`;
}

// ----------------------------------------------------------- sitemap & co
function sitemapXML() {
  const cluster = hreflangCluster();
  const urls = LOCALES.map((l) => `  <url>
    <loc>${pageUrl(l)}</loc>
${cluster.map((a) => `    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${a.href}" />`).join('\n')}
    <changefreq>monthly</changefreq>
  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`;
}

function robotsTXT() {
  return `User-agent: *
Allow: /
Disallow: /api/
Disallow: /factors/
Disallow: /__/

Sitemap: ${SITE}/sitemap.xml
`;
}

function manifestJSON() {
  return `${JSON.stringify({
    name: 'CarbonLedger',
    short_name: 'CarbonLedger',
    description: EN.strings.description,
    lang: 'en',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: C.bg,
    theme_color: C.accent,
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }, null, 2)}\n`;
}

// ------------------------------------------------------------------- ICO
/** Assembles a PNG-embedded .ico (universally supported by modern browsers). */
function buildIco(images, outFile) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);
  const entries = Buffer.alloc(16 * images.length);
  let offset = header.length + entries.length;
  images.forEach((m, i) => {
    const e = 16 * i;
    entries[e] = m.size >= 256 ? 0 : m.size;
    entries[e + 1] = m.size >= 256 ? 0 : m.size;
    entries[e + 2] = 0; // palette
    entries[e + 3] = 0; // reserved
    entries.writeUInt16LE(1, e + 4); // color planes
    entries.writeUInt16LE(32, e + 6); // bits per pixel
    entries.writeUInt32LE(m.buf.length, e + 8);
    entries.writeUInt32LE(offset, e + 12);
    offset += m.buf.length;
  });
  writeFileSync(outFile, Buffer.concat([header, entries, ...images.map((m) => m.buf)]));
  return outFile;
}

// ------------------------------------------------------------------ main
function main() {
  mkdirSync(join(PUB, 'og'), { recursive: true });
  mkdirSync(join(PUB, 'icons'), { recursive: true });
  for (const l of LOCALES) if (l.path) mkdirSync(join(PUB, l.path), { recursive: true });

  // Vector favicon keeps its transparent rounded corners natively.
  writeFileSync(join(PUB, 'favicon.svg'), iconSVG(512, { rx: 96 }), 'utf8');

  // Raster icons. Rounded corners require Edge to honor the transparent
  // default background; probe one render and fall back to full-bleed squares.
  // (Edge headless screenshots are written as opaque 8-bit RGB without an
  // alpha channel, so the probe concludes "not transparent" and the square
  // fallback is the expected permanent path on this toolchain.)
  const probe = join(WORK, 'probe-32.png');
  render(iconSVG(32, { rx: 96 }), 32, 32, probe, { extension: 'svg' });
  let transparent = false;
  try {
    const png = readPng(readFileSync(probe));
    transparent = png.channels === 4 && pixelAlpha(png, 1, 1) < 16 && pixelAlpha(png, 30, 1) < 16;
  } catch { transparent = false; }
  const rx = transparent ? 96 : 0;
  if (!transparent) console.log('note: headless render is opaque; using full-bleed square icons');

  const pngIcon = (size, name, opts = {}) => {
    const out = join(PUB, name);
    render(iconSVG(size, { rx: opts.square ? 0 : rx, markScale: opts.markScale ?? 1 }),
      size, size, out, { extension: 'svg' });
    return out;
  };
  pngIcon(16, 'favicon-16x16.png');
  pngIcon(32, 'favicon-32x32.png');
  pngIcon(180, 'apple-touch-icon.png', { square: true }); // iOS masks it itself
  pngIcon(192, 'icons/icon-192.png');
  pngIcon(512, 'icons/icon-512.png');
  pngIcon(512, 'icons/icon-maskable-512.png', { square: true, markScale: 0.72 }); // 20% safe zone

  const icoSizes = [16, 32, 48].map((size) => {
    const f = join(WORK, `ico-${size}.png`);
    render(iconSVG(size, { rx }), size, size, f, { extension: 'svg' });
    return { size, buf: readFileSync(f) };
  });
  buildIco(icoSizes, join(PUB, 'favicon.ico'));

  for (const l of LOCALES) {
    render(ogHTML(l), 1200, 630, join(PUB, 'og', `og-${l.lang}.png`));
    if (l.path) writeFileSync(join(PUB, l.path, 'index.html'), landingHTML(l), 'utf8');
  }

  writeFileSync(join(PUB, 'robots.txt'), robotsTXT(), 'utf8');
  writeFileSync(join(PUB, 'sitemap.xml'), sitemapXML(), 'utf8');
  writeFileSync(join(PUB, 'site.webmanifest'), manifestJSON(), 'utf8');

  console.log(`SEO assets generated into frontend/public (icons rx=${rx}, ${LOCALES.length} locales)`);
}

try {
  main();
} finally {
  rmSync(WORK, { recursive: true, force: true }); // also on render failures
}
