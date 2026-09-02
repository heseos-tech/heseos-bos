// Partner-app-only helpers: display labels for the punch-lead wizard (friendlier copy than the
// raw formOptions values) and lead-status bucketing for the partner UI. Real payout numbers
// (Rewards & Earnings) come from lib/payout.js's payoutFor() against the shared, admin-set
// Lead Conversion Payout tiers (Settings) — no mock earnings live here any more.

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

