// Where HESEOS delivers + installs the door lock. Today: Pune only. An order for any other pincode is refused
// (app/api/shop/door-lock) and the visitor is recorded as a "not serviceable" request instead, so we can see
// which cities are asking and tell them when we reach them. Admin -> Landing Activity shows these.
//
// To open another city, set the SERVICEABLE_CITIES env var on Vercel (comma separated, e.g. "Pune,Mumbai") — no
// code change. India Post names the DISTRICT for a pincode ("Pune" covers Pune city, Pimpri-Chinchwad, Hinjewadi,
// Haveli, Mulshi…), which is what is matched.
import { dbGetById, dbInsert } from '@/lib/db';
import { checkRateLimit } from '@/lib/rateLimit';
import { lookupPincode } from '@/lib/pincodeLookup';

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z]+/g, ' ').trim();

export function serviceableCities() {
  const raw = (process.env.SERVICEABLE_CITIES || 'Pune').split(',').map((s) => s.trim()).filter(Boolean);
  return raw.length ? raw : ['Pune'];
}
export function isServiceableCity(city) {
  const c = norm(city);
  if (!c) return false;
  return serviceableCities().some((s) => { const k = norm(s); return c === k || c.startsWith(`${k} `); });
}

export const NOT_SERVICEABLE_MESSAGE = 'Sorry, we’re not serviceable in your area yet. We’ll get back to you once we start serving your area.';

// Pincode -> { city, state, serviceable }. If India Post can't be reached, Pune's own 411xxx pincodes are still
// recognised, so a lookup outage never turns away a real Pune customer.
export async function checkServiceArea(pincode) {
  const pin = String(pincode || '').replace(/\D/g, '');
  let { city, state } = await lookupPincode(pin);
  if (!city && /^411\d{3}$/.test(pin) && isServiceableCity('Pune')) { city = 'Pune'; state = state || 'Maharashtra'; }
  return { pincode: pin, city, state, known: !!city, serviceable: isServiceableCity(city) };
}

const clamp = (v, n) => String(v ?? '').slice(0, n);
const digits10 = (v) => { const d = String(v || '').replace(/\D/g, ''); return d.length >= 10 ? d.slice(-10) : ''; };

// Saves (or updates) one "not serviceable" request in the landing_activity collection (kind 'unserviceable').
// One row per visit + pincode: first it may be just the pincode they typed, then it gains their name / mobile when
// they ask to be told. Never throws.
export async function recordUnserviceable({ page = 'door_lock', pincode, city, state, name, phone, sid, ip, geo, source }) {
  try {
    const pin = String(pincode || '').replace(/\D/g, '');
    if (!/^\d{6}$/.test(pin)) return null;
    const visit = /^[a-z0-9]{8,40}$/.test(String(sid || '')) ? String(sid) : `p${digits10(phone) || 'anon'}`;
    const id = `ns_${visit}_${pin}`;
    const now = new Date().toISOString();
    const existing = await dbGetById('landing_activity', id);
    if (existing) {
      const row = {
        ...existing, lastAt: now, hits: (existing.hits || 1) + 1,
        name: clamp(name, 60) || existing.name || '',
        phone: digits10(phone) || existing.phone || '',
        wantsCallback: existing.wantsCallback || !!digits10(phone),
        source: digits10(phone) && existing.source === 'pincode_check' ? 'notify_me' : existing.source,
      };
      await dbInsert('landing_activity', id, row);
      return row;
    }
    const rl = await checkRateLimit(`ns:${ip || 'unknown'}`, { max: 60, windowMs: 60 * 60 * 1000 });
    if (!rl.allowed) return null;
    const row = {
      id, kind: 'unserviceable', page, at: now, lastAt: now, hits: 1,
      pincode: pin, city: clamp(city, 60), state: clamp(state, 60),
      name: clamp(name, 60), phone: digits10(phone), wantsCallback: !!digits10(phone),
      sid: visit, ip: ip && ip !== 'unknown' ? clamp(ip, 64) : '',
      ipCity: clamp(geo?.city, 60), ipRegion: clamp(geo?.region, 10),
      source: clamp(source, 30),
    };
    await dbInsert('landing_activity', id, row);
    return row;
  } catch (err) {
    console.error('recordUnserviceable error:', err?.message || err);
    return null;
  }
}
