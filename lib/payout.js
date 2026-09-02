// Lead-conversion payout engine — one shared, admin-configured tiered commission structure
// (Settings → Lead Conversion Payout, components/admin/SettingsPage.jsx's PayoutSettingsCard)
// that applies identically to every kind of referrer: a partner (any lead with partnerId set,
// whichever channel — Partner App punch, QR scan, or referral link), an employee (a lead they
// punched in themselves via the Team App — addedByEmployeeId), or eventually a customer referrer
// (a lead attributed to their own referral_customer link — attributionLinkId). One ladder, one
// rule, applied the same way everywhere — per the brief: "applicable to everyone... and that
// will be fixed."
//
// Design, spelled out (see also lib/payoutSettings.js for how the config itself is stored):
//
//  - PERIOD: the admin picks 'monthly' or 'quarterly'. Every payout is computed for the period
//    containing "now" (IST) — there's no historical period picker; this mirrors the "This
//    Month" framing the old mock earnings already used.
//  - SALE VALUE: the only leads that count are ones that have actually closed — stageOf(lead)
//    === 'Converted' (lib/leadStage.js) — and the amount counted is lead.finalPrice, the real
//    negotiated closing price (never quotationAmount, which is only ever a pre-negotiation
//    estimate — see lib/adminMetrics.js's header comment). A lead only counts toward a period
//    if it CONVERTED within that period (convertedAt), not merely created within it — matches
//    how lib/adminMetrics.js's revenueByMonth already buckets "when the money counts."
//  - TIER LOOKUP: flat/slab, not progressive brackets. Tiers are sorted ascending by their
//    upper bound (upTo); the referrer's WHOLE period total falls into exactly one tier — the
//    first one whose upTo is >= the total (or the last, open-ended tier if the total exceeds
//    every bounded one) — and that tier's rate applies to the ENTIRE total. E.g. tiers
//    [≤1,00,000 → 2%, ≤5,00,000 → 3%] and a ₹3,00,000 total pays 3% of the full ₹3,00,000, not
//    a blended rate. This is the ordinary "sales commission slab" model, not an income-tax-style
//    marginal bracket.
//  - WHO COUNTS AS "THIS REFERRER'S" LEADS is the caller's job, not this module's — pass in an
//    already-filtered list (e.g. leads.filter(l => l.partnerId === partner.id)), exactly the
//    same style every other per-referrer stat in this codebase already uses (lib/adminMetrics.js's
//    partnerStats/engineerStats/presalesStats). This keeps the engine itself referrer-agnostic.
//
// Pure, no I/O — safe to import from both server code and 'use client' components (the actual
// config is read/written through lib/payoutSettings.js on the server and the read-only
// /api/payout-settings route on the client).

import { stageOf } from '@/lib/leadStage';

export const DEFAULT_PAYOUT_CONFIG = { period: 'monthly', tiers: [] };

// Tiers as stored/edited: { upTo: number|null, rate: number }. `upTo` null means "no upper
// bound" — the open-ended top tier. Sorted ascending by upTo, with null (unbounded) sorted last;
// if more than one tier is left unbounded (a config mistake), the earliest one in that order
// wins for any total that reaches it, since tier lookup returns on first match.
export function normalizeTiers(tiers) {
  if (!Array.isArray(tiers)) return [];
  return tiers
    .map((t) => ({
      upTo: t && t.upTo !== '' && t.upTo != null ? Number(t.upTo) : null,
      rate: Math.max(0, Number(t?.rate) || 0),
    }))
    .filter((t) => t.upTo === null || (Number.isFinite(t.upTo) && t.upTo > 0))
    .sort((a, b) => (a.upTo === null ? Infinity : a.upTo) - (b.upTo === null ? Infinity : b.upTo));
}

// Defends every consumer against a not-yet-loaded / malformed config — useApiResource
// (lib/useApiResource.js) defaults an unfetched GET to `[]`, not `{}`, so every reader of
// /api/payout-settings should normalize through here rather than trust the raw shape.
export function normalizeConfig(raw) {
  const period = raw && raw.period === 'quarterly' ? 'quarterly' : 'monthly';
  const tiers = normalizeTiers(raw && raw.tiers);
  return { period, tiers };
}

// Calendar bounds (as Date instants) of the period containing `ref`, computed in IST — Heseos
// operates in India (see lib/date.js's header) and every payout period should line up with the
// calendar month/quarter an Indian admin actually means, not the server's UTC day.
export function periodBounds(period, ref = new Date()) {
  const ist = new Date(ref.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const y = ist.getFullYear();
  const m = ist.getMonth();
  if (period === 'quarterly') {
    const qStart = Math.floor(m / 3) * 3;
    return { start: new Date(y, qStart, 1), end: new Date(y, qStart + 3, 1) };
  }
  return { start: new Date(y, m, 1), end: new Date(y, m + 1, 1) };
}

// A short, human label for the period containing `ref` — "September 2026" or "Q3 2026".
export function periodLabel(period, ref = new Date()) {
  const ist = new Date(ref.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  if (period === 'quarterly') {
    const q = Math.floor(ist.getMonth() / 3) + 1;
    return `Q${q} ${ist.getFullYear()}`;
  }
  return ist.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

// Which tier a total value falls into (flat/slab — see file header), plus the next tier up (for
// a "₹X more to reach Y%" progress nudge) and how much more total value is needed to cross into
// it. tiers must already be normalizeTiers()'d (ascending, null-upTo last).
export function tierInfoFor(tiers, totalValue) {
  if (!tiers || tiers.length === 0) return { rate: 0, index: -1, current: null, next: null, remainingToNext: null };
  let index = tiers.findIndex((t) => t.upTo === null || totalValue <= t.upTo);
  if (index === -1) index = tiers.length - 1; // shouldn't happen (last tier is usually unbounded), but never fall through with no match
  const current = tiers[index];
  const next = tiers[index + 1] || null;
  const remainingToNext = next && current.upTo !== null ? Math.max(0, current.upTo - totalValue) : null;
  return { rate: current.rate, index, current, next, remainingToNext };
}

// The value of a lead toward payout tiering: only converted leads have one at all.
export function leadSaleValue(lead) {
  if (!lead || stageOf(lead) !== 'Converted' || lead.finalPrice == null) return 0;
  return Number(lead.finalPrice) || 0;
}

// The full payout computation for one referrer's already-filtered lead list, for the period
// containing `ref` (defaults to now). See file header for the exact rules being applied.
export function payoutFor(leads, rawConfig, ref = new Date()) {
  const config = normalizeConfig(rawConfig);
  const { start, end } = periodBounds(config.period, ref);
  let totalValue = 0;
  let convertedCount = 0;
  for (const l of leads || []) {
    const value = leadSaleValue(l);
    if (value <= 0) continue;
    const convertedAt = l.convertedAt ? new Date(l.convertedAt) : null;
    if (!convertedAt || convertedAt < start || convertedAt >= end) continue;
    totalValue += value;
    convertedCount += 1;
  }
  const info = tierInfoFor(config.tiers, totalValue);
  const payout = Math.round(totalValue * info.rate) / 100;
  return {
    period: config.period,
    periodLabel: periodLabel(config.period, ref),
    periodStart: start,
    periodEnd: end,
    totalValue,
    convertedCount,
    rate: info.rate,
    payout,
    hasTiers: config.tiers.length > 0,
    tierIndex: info.index,
    nextTier: info.next,
    remainingToNextTier: info.remainingToNext,
  };
}
