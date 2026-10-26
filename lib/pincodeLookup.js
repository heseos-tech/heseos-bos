// Pincode -> city + state for the order form (and the courier hand-off). India Post's public lookup is the
// source of truth; the first-digits table is the offline fallback (state only). Pure helpers + one fetch —
// safe to import from API routes and from lib/velocityShipping.js.

export const INDIAN_STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir',
  'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh',
  'Uttarakhand', 'West Bengal',
];

const key = (s) => String(s || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z]+/g, ' ').trim();
const ALIASES = {
  orissa: 'Odisha', 'nct of delhi': 'Delhi', 'new delhi': 'Delhi', pondicherry: 'Puducherry', uttaranchal: 'Uttarakhand',
  'daman and diu': 'Dadra and Nagar Haveli and Daman and Diu', 'dadra and nagar haveli': 'Dadra and Nagar Haveli and Daman and Diu',
  'jammu and kashmir': 'Jammu and Kashmir',
};
const BY_KEY = new Map(INDIAN_STATES.map((s) => [key(s), s]));

// Maps whatever spelling comes in ("Jammu & Kashmir", "ORISSA") to the canonical name above, or ''.
export function canonicalState(name) {
  const k = key(name);
  if (!k) return '';
  return BY_KEY.get(k) || ALIASES[k] || '';
}

const PIN_PREFIX_STATE = {
  11: 'Delhi', 12: 'Haryana', 13: 'Haryana', 14: 'Punjab', 15: 'Punjab', 16: 'Punjab', 17: 'Himachal Pradesh',
  18: 'Jammu and Kashmir', 19: 'Jammu and Kashmir', 20: 'Uttar Pradesh', 21: 'Uttar Pradesh', 22: 'Uttar Pradesh',
  23: 'Uttar Pradesh', 24: 'Uttar Pradesh', 25: 'Uttar Pradesh', 26: 'Uttar Pradesh', 27: 'Uttar Pradesh', 28: 'Uttar Pradesh',
  30: 'Rajasthan', 31: 'Rajasthan', 32: 'Rajasthan', 33: 'Rajasthan', 34: 'Rajasthan',
  36: 'Gujarat', 37: 'Gujarat', 38: 'Gujarat', 39: 'Gujarat',
  40: 'Maharashtra', 41: 'Maharashtra', 42: 'Maharashtra', 43: 'Maharashtra', 44: 'Maharashtra',
  45: 'Madhya Pradesh', 46: 'Madhya Pradesh', 47: 'Madhya Pradesh', 48: 'Madhya Pradesh', 49: 'Chhattisgarh',
  50: 'Telangana', 51: 'Andhra Pradesh', 52: 'Andhra Pradesh', 53: 'Andhra Pradesh',
  56: 'Karnataka', 57: 'Karnataka', 58: 'Karnataka', 59: 'Karnataka',
  60: 'Tamil Nadu', 61: 'Tamil Nadu', 62: 'Tamil Nadu', 63: 'Tamil Nadu', 64: 'Tamil Nadu',
  67: 'Kerala', 68: 'Kerala', 69: 'Kerala',
  70: 'West Bengal', 71: 'West Bengal', 72: 'West Bengal', 73: 'West Bengal', 74: 'West Bengal',
  75: 'Odisha', 76: 'Odisha', 77: 'Odisha', 78: 'Assam', 79: 'Arunachal Pradesh',
  80: 'Bihar', 81: 'Bihar', 82: 'Bihar', 83: 'Jharkhand', 84: 'Bihar', 85: 'Jharkhand',
};
export function stateFromPincodePrefix(pin) {
  const p = String(pin || '');
  if (!/^\d{6}$/.test(p)) return '';
  const three = Number(p.slice(0, 3));
  if (three === 403) return 'Goa';
  if ((three >= 244 && three <= 249) || three === 262 || three === 263) return 'Uttarakhand';
  if (three === 160) return 'Chandigarh';
  if (three >= 500 && three <= 509) return 'Telangana';
  if ((three >= 814 && three <= 816) || (three >= 825 && three <= 835)) return 'Jharkhand';
  return PIN_PREFIX_STATE[Number(p.slice(0, 2))] || '';
}

// Server-side gate for partner / installer sign-up and profile edits: a valid 6-digit pincode that resolves
// to a city. -> { ok: true, pincode, city, state } | { ok: false, status, error }
export async function resolveServiceArea(pincode) {
  const pin = String(pincode || '').replace(/\D/g, '');
  if (!/^\d{6}$/.test(pin)) return { ok: false, status: 400, error: 'Please enter a valid 6-digit pincode' };
  const { city, state } = await lookupPincode(pin);
  if (!city) return { ok: false, status: 400, error: 'We couldn\u2019t find a city for this pincode — please check it and try again' };
  return { ok: true, pincode: pin, city, state };
}

const cache = new Map(); // pin -> { at, value }
const TTL = 24 * 60 * 60 * 1000;

// -> { city, state } — either may be '' when unknown. Never throws.
export async function lookupPincode(pin) {
  const p = String(pin || '');
  if (!/^\d{6}$/.test(p)) return { city: '', state: '' };
  const hit = cache.get(p);
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  let value = null;
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${p}`, { signal: AbortSignal.timeout(4000) });
    const po = (await res.json())?.[0]?.PostOffice?.[0];
    if (po) {
      const state = canonicalState(po.State) || stateFromPincodePrefix(p);
      const city = String(po.District || po.Block || po.Division || '').trim();
      value = { city, state };
    }
  } catch { /* use the offline table below */ }
  if (value) { cache.set(p, { at: Date.now(), value }); return value; }
  return { city: '', state: stateFromPincodePrefix(p) }; // not cached: the live lookup may work next time
}
