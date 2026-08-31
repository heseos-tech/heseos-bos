// Maps a Google Ads Lead Form webhook's `user_column_data` into Heseos's lead schema.
//
// Unlike Meta (lib/metaLeadMap.js), Google's standard questions have a fixed, documented
// `column_id` enum (FULL_NAME, PHONE_NUMBER, EMAIL, CITY, POSTAL_CODE, …) so those map
// directly and reliably. Only the admin's own CUSTOM_QUESTION_* fields are free text, and
// for those we fall back to the same keyword-over-column_name matching Meta's mapper uses.
//
// Nothing is ever silently dropped: every field also lands in `rawGoogleFields` on the lead,
// same as Meta's `rawMetaFields`, so pre-sales can see exactly what was submitted even when a
// custom question doesn't map to anything we track.

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

// Google's documented standard question column_id values that map straight onto a lead field.
// (WORK_EMAIL/WORK_PHONE_NUMBER fall back into email/phone only if the standard ones weren't
// also answered — a form can ask for both personal and work contact details.)
const STANDARD_COLUMN_IDS = {
  FULL_NAME: 'name',
  FIRST_NAME: 'name',
  PHONE_NUMBER: 'phone',
  WORK_PHONE_NUMBER: 'phone',
  EMAIL: 'email',
  WORK_EMAIL: 'email',
  CITY: 'city',
  POSTAL_CODE: 'postcode',
};

export function mapGoogleAdsLead(userColumnData = []) {
  const out = {
    name: '', phone: '', email: '', city: '', postcode: '',
    productInterest: [], propertyType: '', budget: '', timeline: '', persona: '',
  };
  const raw = {};

  for (const col of userColumnData) {
    const columnId = String(col.column_id || '').toUpperCase();
    const label = col.column_name || columnId;
    const value = String(col.string_value || '').trim();
    raw[label] = value;
    if (!value) continue;

    if (STANDARD_COLUMN_IDS[columnId]) {
      const field = STANDARD_COLUMN_IDS[columnId];
      out[field] = out[field] || value;
      continue;
    }

    // Everything else (CUSTOM_QUESTION_TEXT/RADIO_BUTTON/CHECKBOX/DROPDOWN, and any standard
    // column we don't specifically map like STATE_PROVINCE/COUNTRY/COMPANY_NAME) — try to
    // classify it by the question text, same keyword rules as Meta's custom questions.
    const key = norm(label);
    if (/looking|automat|product|interest|switch|lock|curtain|door\s*phone|scene/.test(key)) {
      const hit = matchLabel(PRODUCT_INTEREST, value);
      if (hit && !out.productInterest.includes(hit)) out.productInterest.push(hit);
      else if (!hit) out.productInterest.push(value);
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

  return { mapped: out, rawGoogleFields: raw };
}
