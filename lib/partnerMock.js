// Partner-app-only helpers: display labels for the punch-lead wizard (friendlier copy than the
// raw formOptions values) and the Rewards & Earnings numbers. There's no payouts/wallet table
// in the backend yet, so earnings are a light mock derived from the partner's *real* lead
// counts (see earningsFor) rather than pure fiction — everything else here is static mock data,
// on purpose, per the "use mock data for rewards" brief.

import { PROPERTY_TYPE, TIMELINE, budgetOptionsFor } from './formOptions';
import { stageOf, needsReschedule } from './leadStage';

// Friendlier property-type labels for the partner wizard (same underlying values as
// formOptions.PROPERTY_TYPE, so leads still speak the same vocabulary as the rest of the app).
export const WIZARD_PROPERTY_TYPE = [
  { v: '1bhk', l: '1 BHK Apartment' },
  { v: '2bhk', l: '2 BHK Apartment' },
  { v: '3bhk_plus', l: '3 BHK & Above / Villa' },
  { v: 'commercial', l: 'Office / Commercial' },
];
export const PROPERTY_TYPE_LABEL = Object.fromEntries(PROPERTY_TYPE.map((p) => [p.v, WIZARD_PROPERTY_TYPE.find((w) => w.v === p.v)?.l || p.l]));

export const CONFIGURATION = [
  { v: 'standard', l: 'Standard' },
  { v: 'premium', l: 'Premium' },
  { v: 'luxury', l: 'Luxury' },
];
export const CONFIGURATION_LABEL = Object.fromEntries(CONFIGURATION.map((c) => [c.v, c.l]));

export const REFERRAL_SOURCE = [
  { v: 'walk_in', l: 'Walk-in' },
  { v: 'referral', l: 'Referral' },
  { v: 'social_media', l: 'Social Media' },
  { v: 'website_enquiry', l: 'Website Enquiry' },
  { v: 'cold_call', l: 'Cold Call' },
];
export const REFERRAL_SOURCE_LABEL = Object.fromEntries(REFERRAL_SOURCE.map((s) => [s.v, s.l]));

export const TIMELINE_LABEL = Object.fromEntries(TIMELINE.map((t) => [t.v, t.l]));
export function budgetLabel(propertyType, budget) {
  return budgetOptionsFor(propertyType).find((b) => b.v === budget)?.l || budget || '—';
}

export { budgetOptionsFor };

// A lead's real stage/outcome, folded into the 4 buckets the partner-app UI shows
// (New / In Progress / Follow Up / Converted), plus Rejected shown as its own badge.
export function partnerStatusOf(lead = {}) {
  const st = stageOf(lead);
  if (st === 'Converted') return 'converted';
  if (st === 'Rejected') return 'rejected';
  if (st === 'Demo Scheduled') return needsReschedule(lead) ? 'followup' : 'progress';
  return 'new';
}

// ── Rewards & Earnings (mock — no payouts backend yet) ─────────────────────
const RATE_PER_LEAD = 250;
const RATE_PER_CONVERSION = 1000;
const MONTHLY_BONUS = 450;

export function earningsFor(leads = []) {
  const now = new Date();
  const thisMonth = leads.filter((l) => {
    const d = new Date(l.createdAt || l.date);
    return !isNaN(d) && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const converted = thisMonth.filter((l) => stageOf(l) === 'Converted').length;
  const punched = thisMonth.length;
  const fromLeads = punched * RATE_PER_LEAD;
  const fromConversions = converted * RATE_PER_CONVERSION;
  const total = fromLeads + fromConversions + MONTHLY_BONUS;
  return {
    total, punched, converted, fromLeads, fromConversions, bonus: MONTHLY_BONUS,
    walletBalance: Math.round(total * 0.2),
  };
}

export const MOCK_PAYOUTS = [
  { date: '01 Aug 2026', amount: 5000, status: 'Paid' },
  { date: '15 Jul 2026', amount: 4000, status: 'Paid' },
  { date: '01 Jul 2026', amount: 3000, status: 'Paid' },
];

export const HOW_YOU_EARN = [
  { title: 'Punch a Lead', desc: `Earn ₹${RATE_PER_LEAD} for every genuine lead you submit through the app.` },
  { title: 'Lead Converts', desc: `An additional ₹${RATE_PER_CONVERSION} when your lead converts into a sale.` },
  { title: 'Monthly Bonus', desc: 'Top-performing partners earn extra monthly bonuses on top of standard payouts.' },
];
