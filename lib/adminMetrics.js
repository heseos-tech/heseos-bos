// lib/adminMetrics.js
// Pure, side-effect-free derived metrics for the admin dashboard — every number here is
// computed from real leads/partners/employees records (lib/db.js via the existing API
// routes), nothing is fabricated. Client-safe (no next/headers imports) so these can run
// in 'use client' admin pages.

import { LEAD_SOURCES, partnerCategoryLabel } from './formOptions';
import { payoutFor } from './payout';
import { displayStatus } from './leadStage';

const DAY = 24 * 60 * 60 * 1000;

// Fixed-order categorical palette (validated for adjacent-pair CVD/contrast — see the
// dataviz skill's reference palette). Never reassign a color by rank; always by category.
export const CHART_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#4a3aa7'];

export function pctChange(current, previous) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

// Count records whose `field` timestamp falls in the last `days` vs the `days` before that,
// and the % change between the two windows — used for every "↑12% vs last 7 days" chip.
export function windowDelta(records, field, days = 7) {
  const now = Date.now();
  const w = days * DAY;
  let cur = 0, prev = 0;
  for (const r of records) {
    const t = r && r[field] ? new Date(r[field]).getTime() : NaN;
    if (isNaN(t)) continue;
    if (t > now - w && t <= now) cur++;
    else if (t > now - 2 * w && t <= now - w) prev++;
  }
  return { value: cur, pct: pctChange(cur, prev) };
}

// ── Lead funnel (Dashboard) ────────────────────────────────────────────────
export function funnelData(leads) {
  const total = leads.length;
  const contacted = leads.filter((l) => l.contactStageAt).length;
  const qualified = leads.filter((l) => l.contactStage === 'qualified').length;
  const demoScheduled = leads.filter((l) => l.demoScheduledAt).length;
  const quotationsSent = leads.filter((l) => l.quotationSentAt).length;
  const converted = leads.filter((l) => l.demoOutcome === 'converted').length;
  const rows = [
    { key: 'total', label: 'Total Leads', count: total },
    { key: 'contacted', label: 'Contacted', count: contacted },
    { key: 'qualified', label: 'Qualified', count: qualified },
    { key: 'demo', label: 'Demo Scheduled', count: demoScheduled },
    { key: 'quotation', label: 'Quotations Sent', count: quotationsSent },
    { key: 'converted', label: 'Converted', count: converted },
  ];
  return rows.map((r) => ({ ...r, pct: total ? Math.round((r.count / total) * 100) : 0 }));
}

// ── Leads by source (Dashboard donut) ──────────────────────────────────────
export function sourceBreakdown(leads) {
  const counts = {};
  for (const l of leads) {
    const key = l.source || 'manual_entry';
    counts[key] = (counts[key] || 0) + 1;
  }
  const total = leads.length;
  const order = Object.keys(LEAD_SOURCES); // stable, fixed order — never reassign color by rank
  const rows = order
    .filter((k) => counts[k])
    .map((k, i) => ({ key: k, label: LEAD_SOURCES[k], count: counts[k], pct: total ? Math.round((counts[k] / total) * 100) : 0, color: CHART_COLORS[i % CHART_COLORS.length] }));
  // any source value outside the known LEAD_SOURCES map still gets counted, not dropped
  for (const k of Object.keys(counts)) {
    if (!order.includes(k)) rows.push({ key: k, label: k, count: counts[k], pct: total ? Math.round((counts[k] / total) * 100) : 0, color: CHART_COLORS[rows.length % CHART_COLORS.length] });
  }
  return rows.sort((a, b) => b.count - a.count);
}

// ── Recent activity feed (Dashboard) — every lead's history[] is already a timestamped
// audit trail; this just flattens and sorts all of them across every lead.
export function recentActivity(leads, limit = 6) {
  const events = [];
  for (const l of leads) {
    for (const h of l.history || []) {
      events.push({ leadId: l.id, leadName: l.name, propertyType: l.propertyType, city: l.city, event: h.event, by: h.by, note: h.note, at: h.at });
    }
  }
  events.sort((a, b) => new Date(b.at) - new Date(a.at));
  return events.slice(0, limit);
}

// ── Partners page ───────────────────────────────────────────────────────────
// `payoutConfig` is the shared tiered payout ladder from Settings → Lead Conversion Payout
// (lib/payout.js) — pass it through from wherever it was fetched (e.g. useApiResource('/api/
// payout-settings') in components/admin/PartnersPage.jsx); omitted, it defaults to no tiers
// configured (₹0 payout), never a stale/fake number.
export function partnerStats(partner, leads, payoutConfig) {
  const own = leads.filter((l) => l.partnerId === partner.id);
  const converted = own.filter((l) => l.demoOutcome === 'converted').length;
  const rate = own.length ? Math.round((converted / own.length) * 1000) / 10 : 0;
  const payout = payoutFor(own, payoutConfig, 'partner');
  return { leadsCount: own.length, converted, conversionRate: rate, earnings: payout.payout, categoryLabel: partnerCategoryLabel(partner.type) };
}

// ── Sales Engineers page ────────────────────────────────────────────────────
export function engineerStats(engineer, leads) {
  const assigned = leads.filter((l) => l.salesEngineerId === engineer.id);
  const demosDone = assigned.filter((l) => l.demoScheduledAt).length;
  const quotationsSent = assigned.filter((l) => l.quotationSentAt).length;
  const conversions = assigned.filter((l) => l.demoOutcome === 'converted').length;
  const rate = assigned.length ? Math.round((conversions / assigned.length) * 1000) / 10 : 0;
  const now = Date.now();
  const demosThisWeek = assigned.filter((l) => l.demoDate && Math.abs(new Date(l.demoDate).getTime() - now) <= 7 * DAY).length;
  return { assigned: assigned.length, demosDone, quotationsSent, conversions, conversionRate: rate, demosThisWeek };
}

// ── Pre-sales page ───────────────────────────────────────────────────────────
export function presalesStats(emp, leads) {
  const assigned = leads.filter((l) => l.assignedTo === emp.id);
  const callsMade = assigned.filter((l) => l.contactStageAt).length;
  const demosScheduled = assigned.filter((l) => l.demoScheduledAt).length;
  const demosCompleted = assigned.filter((l) => l.demoOutcomeAt).length;
  const converted = assigned.filter((l) => l.demoOutcome === 'converted').length;
  const rate = demosScheduled ? Math.round((converted / demosScheduled) * 1000) / 10 : 0;
  return { assigned: assigned.length, callsMade, demosScheduled, demosCompleted, conversions: converted, conversionRate: rate };
}

export function performanceTag(rate) {
  if (rate >= 35) return { label: 'Excellent', tone: 'good' };
  if (rate >= 28) return { label: 'Very Good', tone: 'good' };
  if (rate >= 18) return { label: 'Good', tone: 'info' };
  if (rate >= 8) return { label: 'Average', tone: 'warn' };
  return { label: 'Needs Improvement', tone: 'bad' };
}

// A lead's status for admin tables — layers "Quotation Sent" on top of leadStage's
// displayStatus() (which doesn't know about quotations) whenever one has gone out and the
// demo hasn't yet been marked won/lost.
export function adminStatus(lead) {
  if (lead.quotationSentAt && lead.demoOutcome !== 'converted' && !(lead.demoOutcome && lead.demoOutcome !== 'converted' && lead.demoOutcome.includes('not_interested'))) {
    return { key: 'quotation_sent', label: 'Quotation Sent', c: '#7C3AED', bg: '#EDE9FE' };
  }
  const st = displayStatus(lead);
  return st.label === 'Rejected' ? { ...st, label: 'Lost' } : st;
}

// Coarse status bucket for the admin Leads table tabs (All / New / In Progress / Demo
// Scheduled / Quotation Sent / Converted / Lost) — a simplified view over the finer-grained
// contactStage/demoOutcome states used elsewhere.
export const LEAD_BUCKETS = [
  { key: 'all', label: 'All Leads' },
  { key: 'new', label: 'New' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'demo', label: 'Demo Scheduled' },
  { key: 'quotation', label: 'Quotation Sent' },
  { key: 'converted', label: 'Converted' },
  { key: 'lost', label: 'Lost' },
];
export function leadBucket(lead) {
  const st = adminStatus(lead);
  if (st.label === 'Lost') return 'lost';
  if (lead.demoOutcome === 'converted') return 'converted';
  if (lead.quotationSentAt) return 'quotation';
  if (lead.demoScheduledAt) return 'demo';
  if (lead.contactStageAt) return 'in_progress';
  return 'new';
}

// What an admin should do next with a lead, given its current bucket.
export function nextAction(lead) {
  const b = leadBucket(lead);
  if (b === 'converted') return { label: 'Completed', key: 'done' };
  if (b === 'lost') return { label: '—', key: 'none' };
  if (b === 'quotation') return { label: 'Follow Up', key: 'follow_up' };
  if (b === 'demo') return { label: 'Send Quotation', key: 'quote' };
  if (b === 'in_progress') return { label: 'Schedule Demo', key: 'schedule' };
  return { label: lead.assignedTo ? 'Call' : 'Assign & Call', key: 'assign_call' };
}

// ── Reports page ─────────────────────────────────────────────────────────────
// Every "revenue" figure below comes strictly from finalPrice on CONVERTED leads — the
// negotiated, closed amount (see the 'demoOutcome' PATCH type, which now requires it).
// quotationAmount is pipeline/potential value, never revenue, and is kept clearly separate.

export function revenueOverview(leads) {
  const converted = leads.filter((l) => l.demoOutcome === 'converted' && l.finalPrice != null);
  const totalRevenue = converted.reduce((s, l) => s + (l.finalPrice || 0), 0);
  const dealsClosed = converted.length;
  const avgDealSize = dealsClosed ? Math.round(totalRevenue / dealsClosed) : 0;

  const quoted = leads.filter((l) => l.quotationAmount != null);
  const totalQuoted = quoted.reduce((s, l) => s + (l.quotationAmount || 0), 0);

  const totalLeads = leads.length;
  const conversionRate = totalLeads ? Math.round((dealsClosed / totalLeads) * 1000) / 10 : 0;

  // How much the final price differs from the last quoted amount, averaged across deals that
  // had both — a rough read on how much negotiation typically costs.
  const withBoth = converted.filter((l) => l.quotationAmount != null && l.quotationAmount > 0);
  const avgDiscountPct = withBoth.length
    ? Math.round((withBoth.reduce((s, l) => s + (l.quotationAmount - l.finalPrice) / l.quotationAmount, 0) / withBoth.length) * 1000) / 10
    : 0;

  return { totalRevenue, dealsClosed, avgDealSize, totalQuoted, conversionRate, avgDiscountPct };
}

// Revenue booked (by convertedAt's calendar month) for the last `months` months, oldest first
// — always a fixed rolling window, independent of any date-range filter applied elsewhere on
// the page, since a trend needs a stable time axis to actually read as a trend.
export function revenueByMonth(leads, months = 6) {
  const now = new Date();
  const buckets = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }), revenue: 0, deals: 0 });
  }
  const byKey = Object.fromEntries(buckets.map((b) => [b.key, b]));
  for (const l of leads) {
    if (l.demoOutcome !== 'converted' || l.finalPrice == null || !l.convertedAt) continue;
    const d = new Date(l.convertedAt);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (byKey[key]) { byKey[key].revenue += l.finalPrice; byKey[key].deals += 1; }
  }
  return buckets;
}

// Revenue by lead source — same fixed categorical color order as sourceBreakdown, so a source
// keeps the same hue whether you're looking at lead counts (Dashboard) or revenue (Reports).
export function revenueBySource(leads) {
  const sums = {};
  for (const l of leads) {
    if (l.demoOutcome !== 'converted' || l.finalPrice == null) continue;
    const key = l.source || 'manual_entry';
    sums[key] = (sums[key] || 0) + l.finalPrice;
  }
  const total = Object.values(sums).reduce((a, b) => a + b, 0);
  const order = Object.keys(LEAD_SOURCES);
  const rows = order
    .filter((k) => sums[k])
    .map((k, i) => ({ key: k, label: LEAD_SOURCES[k], count: sums[k], pct: total ? Math.round((sums[k] / total) * 100) : 0, color: CHART_COLORS[i % CHART_COLORS.length] }));
  for (const k of Object.keys(sums)) {
    if (!order.includes(k)) rows.push({ key: k, label: k, count: sums[k], pct: total ? Math.round((sums[k] / total) * 100) : 0, color: CHART_COLORS[rows.length % CHART_COLORS.length] });
  }
  return rows.sort((a, b) => b.count - a.count);
}

// Revenue leaderboard by sales engineer.
export function revenueByEngineer(leads, employees) {
  const engineers = employees.filter((e) => e.role === 'sales_engineer');
  return engineers
    .map((e) => {
      const won = leads.filter((l) => l.salesEngineerId === e.id && l.demoOutcome === 'converted' && l.finalPrice != null);
      const revenue = won.reduce((s, l) => s + l.finalPrice, 0);
      return { id: e.id, name: e.name, location: e.location, deals: won.length, revenue, avgDealSize: won.length ? Math.round(revenue / won.length) : 0 };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

// Revenue + funnel by city.
export function revenueByCity(leads) {
  const sums = {};
  for (const l of leads) {
    const city = l.city || 'Unknown';
    if (!sums[city]) sums[city] = { city, leads: 0, converted: 0, revenue: 0 };
    sums[city].leads += 1;
    if (l.demoOutcome === 'converted' && l.finalPrice != null) {
      sums[city].converted += 1;
      sums[city].revenue += l.finalPrice;
    }
  }
  return Object.values(sums)
    .map((r) => ({ ...r, conversionRate: r.leads ? Math.round((r.converted / r.leads) * 1000) / 10 : 0 }))
    .sort((a, b) => b.revenue - a.revenue);
}

// Filters leads created within a named range — used to scope the Reports KPIs/tables. 'all'
// returns every lead unchanged.
export function filterByRange(leads, range) {
  if (range === 'all') return leads;
  const now = new Date();
  let from;
  if (range === 'this_month') from = new Date(now.getFullYear(), now.getMonth(), 1);
  else if (range === 'last_3_months') from = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  else if (range === 'last_6_months') from = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  else if (range === 'this_year') from = new Date(now.getFullYear(), 0, 1);
  else return leads;
  return leads.filter((l) => l.createdAt && new Date(l.createdAt) >= from);
}

