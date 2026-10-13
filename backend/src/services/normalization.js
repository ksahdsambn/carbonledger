// Unit / location / transport-mode normalization engine (T-018, PRD 4.4).
// All 10 conversion pairs of the base table, full float precision, every
// conversion step written to the audit trail (FR-401); location normalization
// to country-region + city (FR-402); closed transport-mode enum (FR-403);
// currency identification without FX conversion; required-field gap list.

export const CONVERSIONS = {
  // mass -> kg
  t: { to: 'kg', factor: 1000 },
  lb: { to: 'kg', factor: 0.4536 },
  g: { to: 'kg', factor: 0.001 },
  kg: { to: 'kg', factor: 1 },
  // energy -> kWh
  MWh: { to: 'kWh', factor: 1000 },
  GJ: { to: 'kWh', factor: 277.78 },
  MMBtu: { to: 'kWh', factor: 293 }, // 1 MMBtu = 1e6 BTU x 0.000293 kWh/BTU (table constant)
  BTU: { to: 'kWh', factor: 0.000293 },
  kWh: { to: 'kWh', factor: 1 },
  // volume -> L
  m3: { to: 'L', factor: 1000 },
  gal: { to: 'L', factor: 3.785 }, // US gallon
  L: { to: 'L', factor: 1 },
  // distance -> km
  mile: { to: 'km', factor: 1.609 },
  nmi: { to: 'km', factor: 1.852 },
  km: { to: 'km', factor: 1 },
};

export const BASE_UNITS = { mass: 'kg', energy: 'kWh', volume: 'L', distance: 'km' };
export const UNIT_DIMENSION = {
  kg: 'mass', t: 'mass', lb: 'mass', g: 'mass',
  kWh: 'energy', MWh: 'energy', GJ: 'energy', BTU: 'energy',
  L: 'volume', m3: 'volume', gal: 'volume',
  km: 'distance', mile: 'distance', nmi: 'distance',
  't.km': 'freight', 'p.km': 'travel', MMBtu: 'energy',
};

export const TRANSPORT_MODES = [
  'Road freight', 'Rail transport', 'Sea transport (container)', 'Sea transport (bulk)',
  'Air transport (general cargo)', 'Air transport (cold chain)', 'International express',
  'Inland waterway transport', 'Pipeline transport', 'Not applicable',
];

export const CURRENCIES = ['USD', 'CNY', 'EUR', 'JPY', 'HKD'];

/** Converts a quantity to its base unit; returns null when not convertible. */
export function convertUnit(quantity, unit) {
  const c = CONVERSIONS[unit];
  if (!c) return null;
  return { quantity: quantity * c.factor, unit: c.to, factor: c.factor, from: unit };
}

// Location normalization: ISO alpha-2 country + city, two-level structure
// (FR-402). Handles bilingual aliases and common port/airport names.
const LOCATION_ALIASES = {
  'hong kong': ['HK', 'Hong Kong'], 'hk': ['HK', 'Hong Kong'],
  'kwai chung': ['HK', 'Kwai Chung'], '葵涌': ['HK', 'Kwai Chung'],
  'hong kong kwai chung': ['HK', 'Kwai Chung'], '香港葵涌码头': ['HK', 'Kwai Chung'],
  'shenzhen': ['CN', 'Shenzhen'], 'yantian': ['CN', 'Shenzhen'], '深圳': ['CN', 'Shenzhen'],
  'shanghai': ['CN', 'Shanghai'], 'guangzhou': ['CN', 'Guangzhou'], 'dongguan': ['CN', 'Dongguan'],
  'ningbo': ['CN', 'Ningbo'], 'hangzhou': ['CN', 'Hangzhou'],
  'tokyo': ['JP', 'Tokyo'], 'osaka': ['JP', 'Osaka'], 'narita': ['JP', 'Tokyo'],
  'london': ['GB', 'London'], 'manchester': ['GB', 'Manchester'], 'heathrow': ['GB', 'London'],
  'edinburgh': ['GB', 'Edinburgh'], 'newcastle': ['GB', 'Newcastle'],
  'rotterdam': ['NL', 'Rotterdam'], 'hamburg': ['DE', 'Hamburg'], 'hannover': ['DE', 'Hannover'],
  'berlin': ['DE', 'Berlin'], 'munich': ['DE', 'Munich'], 'munchen': ['DE', 'Munich'],
  'paris': ['FR', 'Paris'], 'lyon': ['FR', 'Lyon'], 'milan': ['IT', 'Milan'], 'naples': ['IT', 'Naples'],
  'new york': ['US', 'New York'], 'los angeles': ['US', 'Los Angeles'], 'austin': ['US', 'Austin'],
  'chicago': ['US', 'Chicago'], 'st louis': ['US', 'St Louis'],
  'singapore': ['SG', 'Singapore'], 'jebel ali': ['AE', 'Jebel Ali'], 'warsaw': ['PL', 'Warsaw'],
  'antwerp': ['BE', 'Antwerp'], 'xi an': ['CN', "Xi'an"], "xi'an": ['CN', "Xi'an"],
  'zhengzhou': ['CN', 'Zhengzhou'], 'east midlands': ['GB', 'East Midlands'],
};

/** Normalizes free-text location to "CC/City"; returns null if unrecognized. */
export function normalizeLocation(text) {
  if (!text) return null;
  const raw = String(text).trim();
  // already normalized form CC/City
  const m = /^([A-Z]{2})\/(.+)$/.exec(raw);
  if (m) return `${m[1]}/${titleCase(m[2])}`;
  const key = raw.toLowerCase().replace(/\s+/g, ' ');
  const hit = LOCATION_ALIASES[key];
  if (hit) return `${hit[0]}/${hit[1]}`;
  return null;
}

function titleCase(s) {
  return s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

/** Validates and canonicalizes a transport mode against the closed enum. */
export function validateTransportMode(mode) {
  if (mode == null) return { ok: true, mode: null };
  const exact = TRANSPORT_MODES.find((m) => m.toLowerCase() === String(mode).toLowerCase());
  if (exact) return { ok: true, mode: exact };
  return { ok: false, mode };
}

/** Identifies currency from text symbols/codes; no FX conversion (PRD 4.4). */
export function identifyCurrency(text) {
  if (!text) return null;
  const t = String(text);
  const table = [
    [/USD|\$|dollars?\b/i, 'USD'], [/CNY|人民币|RMB|¥/i, 'CNY'], [/EUR|€/i, 'EUR'],
    [/JPY|円|yen\b|¥jp/i, 'JPY'], [/HKD|港币/i, 'HKD'],
  ];
  for (const [re, code] of table) if (re.test(t)) return code;
  return null;
}

/** Required-for-calculation fields per PRD 4.3; missing ones form the gap list (step 5). */
export function computeGapList(record) {
  const gaps = [];
  const isTransport = record.transport_mode && record.transport_mode !== 'Not applicable';
  if (!record.activity_date) gaps.push('activity_date');
  if (!record.item_description) gaps.push('item_description');
  if (record.quantity == null && record.unit == null) {
    gaps.push('quantity', 'unit');
  } else {
    if (record.quantity == null) gaps.push('quantity');
    if (record.unit == null) gaps.push('unit');
  }
  if (isTransport) {
    if (!record.origin_location) gaps.push('origin_location');
    if (!record.destination_location) gaps.push('destination_location');
  }
  return gaps;
}

/** Applies full normalization to a record; writes steps to auditTrail sink. */
export async function normalizeRecord(record, { store }) {
  const steps = [];
  let out = { ...record };
  if (record.quantity != null && record.unit != null) {
    const conv = convertUnit(record.quantity, record.unit);
    if (conv) {
      out.quantity = conv.quantity;
      out.unit = conv.unit;
      steps.push({
        action: 'unit_conversion', from: `${record.quantity} ${conv.from}`,
        to: `${conv.quantity} ${conv.to}`, relation: `1 ${conv.from} = ${conv.factor} ${conv.to}`,
      });
    }
  }
  for (const field of ['origin_location', 'destination_location']) {
    const norm = normalizeLocation(out[field]);
    if (norm && norm !== out[field]) {
      steps.push({ action: 'location_normalization', from: out[field], to: norm });
      out[field] = norm;
    }
  }
  if (record.amount != null && !record.currency) {
    const c = identifyCurrency(record.item_description || '');
    if (c) {
      out.currency = c;
      steps.push({ action: 'currency_identified', currency: c, note: 'no FX conversion applied' });
    }
  }
  const gaps = computeGapList(out);
  if (steps.length > 0 || gaps.length > 0) {
    await store.put('audit_trail', `aud_${record.record_id}_norm`, {
      task_id: record.task_id || null,
      action_type: 'normalization',
      actor: 'normalization-engine',
      object_id: record.record_id,
      details: { steps, gaps },
      ts: new Date().toISOString(),
    });
  }
  return { record: out, steps, gaps };
}
