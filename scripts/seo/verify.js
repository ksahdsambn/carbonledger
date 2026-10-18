// SEO asset acceptance checks over frontend/dist (run after the build):
//   node scripts/seo/verify.js
// Verifies, without external services: the full file set, per-page head
// correctness (title/description/canonical/hreflang cluster/Open Graph/
// Twitter/JSON-LD), sitemap hreflang reciprocity, robots.txt, the web
// manifest, PNG dimensions, the ICO directory, and that every local URL
// referenced from a page resolves to a file in the dist tree.
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pngSize } from './png.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const DIST = join(ROOT, 'frontend', 'dist');
const CONFIG = JSON.parse(readFileSync(join(HERE, 'locales.json'), 'utf8'));
const SITE = CONFIG.site;
const LOCALES = CONFIG.locales;

let failures = 0;
let checks = 0;
if (!existsSync(join(DIST, 'index.html'))) {
  console.error('FAIL  frontend/dist is not built — run `npm run build` before verifying');
  process.exit(1);
}
/** Reads a dist file, or returns null when absent (reported as a FAIL, not a crash). */
const readOrNull = (rel) => (existsSync(join(DIST, rel)) ? readFileSync(join(DIST, rel)) : null);
function check(name, ok, detail = '') {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const pageUrl = (l) => (l.path ? `${SITE}/${l.path}/` : `${SITE}/`);
const cluster = LOCALES.map((l) => ({ hreflang: l.lang, href: pageUrl(l) }))
  .concat([{ hreflang: 'x-default', href: `${SITE}/` }]);

// Regex-based extractors over the raw HTML (no dependency parser needed for
// the flat, generator-produced head structure this project ships).
const metaContent = (html, nameOrProperty) => {
  const patterns = [
    `<meta name="${nameOrProperty}" content="([^"]*)"`,
    `<meta property="${nameOrProperty}" content="([^"]*)"`,
  ];
  for (const p of patterns) {
    const m = new RegExp(p).exec(html);
    if (m) return m[1];
  }
  return null;
};
const hreflangMap = (html) => {
  const map = {};
  const re = /<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"\s*\/>/g;
  let m;
  while ((m = re.exec(html)) !== null) map[m[1]] = m[2];
  return map;
};
const unesc = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');

// ------------------------------------------------------------------ files
const requiredFiles = [
  'favicon.svg', 'favicon.ico', 'favicon-16x16.png', 'favicon-32x32.png',
  'apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png',
  'icons/icon-maskable-512.png', 'robots.txt', 'sitemap.xml', 'site.webmanifest',
  ...LOCALES.filter((l) => l.path).map((l) => `${l.path}/index.html`),
  ...LOCALES.map((l) => `og/og-${l.lang}.png`),
];
check('dist contains every generated SEO file',
  requiredFiles.every((f) => existsSync(join(DIST, f))),
  `${requiredFiles.filter((f) => !existsSync(join(DIST, f))).join(', ') || 'all present'}`);

// ------------------------------------------------------------------ pages
const scriptProbe = {
  zh: /[\u4e00-\u9fff]/, ja: /[\u3040-\u30ff]/, ko: /[\uac00-\ud7af]/,
  ru: /[\u0400-\u04ff]/, ar: /[\u0600-\u06ff]/,
};
for (const loc of LOCALES) {
  const rel = loc.path ? `${loc.path}/index.html` : 'index.html';
  const file = join(DIST, rel);
  if (!existsSync(file)) continue; // already reported above
  const html = readFileSync(file, 'utf8');
  const label = `/${loc.path || ''}`;
  const title = /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? '';

  check(`[${label}] lang and dir attributes`,
    new RegExp(`<html lang="${loc.lang}" dir="${loc.dir}"`).test(html),
    `lang=${loc.lang} dir=${loc.dir}`);
  check(`[${label}] title matches the locale copy`,
    unesc(title) === `CarbonLedger — ${loc.strings.tagline}` && title.length > 10,
    `${title.length} chars`);
  const desc = metaContent(html, 'description');
  check(`[${label}] meta description present and bounded`,
    desc !== null && desc.length >= 40 && desc.length <= 320, `${desc?.length ?? 0} chars`);
  check(`[${label}] robots meta allows indexing`,
    metaContent(html, 'robots') === 'index, follow');
  check(`[${label}] canonical URL`,
    new RegExp(`<link rel="canonical" href="${pageUrl(loc)}"`).test(html), pageUrl(loc));

  const got = hreflangMap(html);
  const expected = Object.fromEntries(cluster.map((a) => [a.hreflang, a.href]));
  check(`[${label}] hreflang cluster complete and reciprocal`,
    Object.keys(expected).length === Object.keys(got).length
    && Object.entries(expected).every(([k, v]) => got[k] === v),
    `${Object.keys(got).length} alternates`);

  check(`[${label}] og:locale`,
    metaContent(html, 'og:locale') === loc.ogLocale, metaContent(html, 'og:locale') ?? 'missing');
  const altCount = (html.match(/og:locale:alternate/g) ?? []).length;
  check(`[${label}] og:locale:alternate covers the other locales`, altCount === LOCALES.length - 1, `${altCount}`);
  check(`[${label}] og:image is the localized absolute card`,
    metaContent(html, 'og:image') === `${SITE}/og/og-${loc.lang}.png`
    && metaContent(html, 'og:image:width') === '1200'
    && metaContent(html, 'og:image:height') === '630'
    && !!metaContent(html, 'og:image:alt'));
  check(`[${label}] Twitter large-image card`,
    metaContent(html, 'twitter:card') === 'summary_large_image'
    && metaContent(html, 'twitter:image') === `${SITE}/og/og-${loc.lang}.png`
    && !!metaContent(html, 'twitter:title') && !!metaContent(html, 'twitter:description'));

  const ldRaw = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)?.[1];
  let ldOk = false;
  let ldDetail = 'missing';
  try {
    const ld = JSON.parse(ldRaw);
    ldOk = ld['@type'] === 'WebApplication' && ld.name === 'CarbonLedger'
      && ld.inLanguage === loc.lang && ld.url === pageUrl(loc)
      && ld.description === loc.strings.description
      && Array.isArray(ld.featureList) && ld.featureList.length === 6;
    ldDetail = `${ld['@type']} inLanguage=${ld.inLanguage}`;
  } catch (e) {
    ldDetail = `JSON parse error: ${e.message}`;
  }
  check(`[${label}] JSON-LD parses and matches the locale`, ldOk, ldDetail);

  const probe = scriptProbe[loc.lang];
  if (probe) check(`[${label}] copy is really in its script`, probe.test(loc.strings.description));

  // Every root-relative local reference resolves to a real file in dist
  // (directories do not count; "/" maps to the directory index).
  const refs = [...html.matchAll(/(?:href|src)="(\/[^"]*)"/g)].map((m) => m[1])
    .filter((u) => !u.startsWith('/api/') && !u.startsWith('/__'));
  const toDistPath = (u) => {
    let p = u.split('?')[0].split('#')[0];
    if (p.endsWith('/')) p += 'index.html';
    return join(DIST, p);
  };
  const missing = refs.filter((u) => {
    const f = toDistPath(u);
    return !existsSync(f) || !statSync(f).isFile();
  });
  check(`[${label}] all local hrefs/srcs resolve to files`,
    missing.length === 0 && refs.length > 0, missing.join(', ') || `${refs.length} refs`);
}

// Root SPA shell must still mount the built bundle (build sanity, not SEO).
const rootHtml = readFileSync(join(DIST, 'index.html'), 'utf8');
const bundleRefs = [...rootHtml.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)];
check('[/] built bundle assets referenced by the SPA shell exist',
  bundleRefs.length > 0 && bundleRefs.every((m) => {
    const p = join(DIST, m[1].slice(1));
    return existsSync(p) && statSync(p).isFile();
  }), `${bundleRefs.length} refs`);

// ---------------------------------------------------------------- images
for (const loc of LOCALES) {
  const p = join(DIST, 'og', `og-${loc.lang}.png`);
  if (!existsSync(p)) continue;
  const s = pngSize(readFileSync(p));
  check(`og/og-${loc.lang}.png is 1200x630`, s.width === 1200 && s.height === 630, `${s.width}x${s.height}`);
}
for (const [f, size] of [['favicon-16x16.png', 16], ['favicon-32x32.png', 32], ['apple-touch-icon.png', 180],
  ['icons/icon-192.png', 192], ['icons/icon-512.png', 512], ['icons/icon-maskable-512.png', 512]]) {
  const p = join(DIST, f);
  if (!existsSync(p)) continue;
  const s = pngSize(readFileSync(p));
  check(`${f} is ${size}x${size}`, s.width === size && s.height === size, `${s.width}x${s.height}`);
}
const icoBuf = readOrNull('favicon.ico');
check('favicon.ico carries 16/32/48 PNG entries',
  icoBuf !== null && icoBuf.length >= 6 + 16 * 3 && icoBuf.readUInt16LE(4) === 3
  && [16, 32, 48].every((s, i) => icoBuf[6 + i * 16] === s && icoBuf[6 + i * 16 + 1] === s)
  && icoBuf.subarray(icoBuf.readUInt32LE(6 + 12), icoBuf.readUInt32LE(6 + 12) + 4)
    .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])));

// ------------------------------------------------------- sitemap & robots
const sitemapBuf = readOrNull('sitemap.xml');
check('sitemap.xml present', sitemapBuf !== null);
const sitemap = sitemapBuf?.toString('utf8') ?? '';
const blocks = sitemap.split(/<url>/).slice(1);
{
  const locs = blocks.map((b) => /<loc>([^<]+)<\/loc>/.exec(b)?.[1]);
  check('sitemap lists every language page exactly once',
    locs.length === LOCALES.length && locs.every((u, i) => u === pageUrl(LOCALES[i])), `${locs.length} urls`);
  let reciprocity = true;
  for (const b of blocks) {
    const got = {};
    const re = /<xhtml:link rel="alternate" hreflang="([^"]+)" href="([^"]+)"\s*\/>/g;
    let m;
    while ((m = re.exec(b)) !== null) got[m[1]] = m[2];
    for (const a of cluster) if (got[a.hreflang] !== a.href) reciprocity = false;
    if (Object.keys(got).length !== cluster.length) reciprocity = false;
  }
  check('sitemap hreflang clusters are complete and reciprocal', reciprocity);
  check('sitemap XML declares both namespaces',
    sitemap.includes('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')
    && sitemap.includes('xmlns:xhtml="http://www.w3.org/1999/xhtml"'));
}
const robotsBuf = readOrNull('robots.txt');
const robots = robotsBuf?.toString('utf8') ?? '';
check('robots.txt allows crawling, blocks API surfaces, points to the sitemap',
  robots.includes('Allow: /') && robots.includes('Disallow: /api/') && robots.includes('Disallow: /factors/')
  && robots.includes(`Sitemap: ${SITE}/sitemap.xml`));

// -------------------------------------------------------------- manifest
{
  const mfBuf = readOrNull('site.webmanifest');
  let mf = null;
  try { mf = mfBuf === null ? null : JSON.parse(mfBuf.toString('utf8')); } catch { mf = null; }
  const iconsOk = mf !== null && Array.isArray(mf.icons) && mf.icons.every((ic) => {
    const p = join(DIST, ic.src.slice(1));
    if (!existsSync(p) || !statSync(p).isFile()) return false;
    const s = pngSize(readFileSync(p));
    const [w, h] = ic.sizes.split('x').map(Number);
    return s.width === w && s.height === h;
  });
  check('site.webmanifest parses; every icon exists with declared size',
    iconsOk && mf?.name === 'CarbonLedger' && mf?.start_url === '/' && mf?.icons?.length === 3);
}

console.log(`\nSEO verify: ${checks - failures}/${checks} checks passed`);
process.exit(failures === 0 ? 0 : 1);
