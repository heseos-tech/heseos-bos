// Maps a Meta Instant Form submission's `field_data` into Heseos's lead schema.
//
// Meta's built-in "Contact Information" fields have fixed, predictable keys (full_name,
// email, phone_number, city, post_code) — those map directly. Custom questions ("What are
// you looking for?", "Your Apartment Size", …) get a `name` key Meta derives from the
// question text when the form was built, which we can't know for certain without the real
// form — so those are matched by keyword against the question text/key, and the answer
// LABEL is matched against our own option labels (case-insensitive, partial match).
//
// Nothing is ever silently dropped: every field also lands in `rawMetaFields` on the lead,
// so pre-sales can see exactly what the customer answered even if a mapping is imperfect —
// and you can tighten the keyword rules below once you see real Meta form field keys.

import { PRODUCT_INTEREST, PROPERTY_TYPE, TIMELINE, PERSONA_TYPE, BUDGET_BY_PROPERTY } from '@/lib/formOptions';

const norm = (s) => String(s || '').toLowerCase().trim();

function matchLabel(list, answer) {
  const a = norm(answer);
  if (!a) return '';
  const exact = list.find((o) => norm(o.l) === a);
  if (exact) return exact.v;
  const partial = list.find((o) => a.includes(norm(o.l)) || norm(o.l).includes(a));
  return partial ? partial.v : '';
}

function matchBudget(answer) {
  const a = norm(answer);
  for (const opts of Object.values(BUDGET_BY_PROPERTY)) {
    const hit = opts.find((o) => norm(o.l).replace(/[₹,\s]/g, '') === a.replace(/[₹,\s]/g, ''));
    if (hit) return hit.v;
  }
  return '';
}

const STANDARD_KEYS = {
  full_name: 'name',
  first_name: 'name',
  email: 'email',
  phone_number: 'phone',
  city: 'city',
  post_code: 'postcode',
  zip_code: 'postcode',
};

export function mapMetaLead(fieldData = []) {
  const out = {
    name: '', phone: '', email: '', city: '', postcode: '',
    productInterest: [], propertyType: '', budget: '', timeline: '', persona: '',
  };
  const raw = {};

  for (const f of fieldData) {
    const key = norm(f.name);
    const value = Array.isArray(f.values) ? f.values.join(', ') : String(f.values || '');
    raw[f.name] = value;
    if (!value) continue;

    if (STANDARD_KEYS[key]) {
      out[STANDARD_KEYS[key]] = out[STANDARD_KEYS[key]] || value;
      continue;
    }

    if (/looking|automat|product|interest|switch|lock|curtain|door\s*phone|scene/.test(key)) {
      const hit = matchLabel(PRODUCT_INTEREST, value);
      if (hit && !out.productInterest.includes(hit)) out.productInterest.push(hit);
      else if (!hit) out.productInterest.push(value); // keep the raw answer if we can't classify it
      continue;
    }
    if (/apartment|property\s*type|space\s*type|bhk/.test(key)) {
      out.propertyType = out.propertyType || matchLabel(PROPERTY_TYPE, value);
      continue;
    }
    if (/budget/.test(key)) {
      out.budget = out.budget || matchBudget(value);
      continue;
    }
    if (/soon|timeline|when|days?/.test(key)) {
      out.timeline = out.timeline || matchLabel(TIMELINE, value);
      continue;
    }
    if (/define|yourself|persona|builder|architect|designer|client/.test(key)) {
      out.persona = out.persona || matchLabel(PERSONA_TYPE, value);
      continue;
    }
  }

  return { mapped: out, rawMetaFields: raw };
}
