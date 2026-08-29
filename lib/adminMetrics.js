// lib/adminMetrics.js
// Pure, side-effect-free derived metrics for the admin dashboard — every number here is
// computed from real leads/partners/employees records (lib/db.js via the existing API
// routes), nothing is fabricated. Client-safe (no next/headers imports) so these can run
// in 'use client' admin pages.

import { LEAD_SOURCES, partnerCategoryLabel } from './formOptions';
import { earningsFor } from './partnerMock';
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
    const key = l.source || 'website';
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
export function partnerStats(partner, leads) {
  const own = leads.filter((l) => l.partnerId === partner.id);
  const converted = own.filter((l) => l.demoOutcome === 'converted').length;
  const rate = own.length ? Math.round((converted / own.length) * 1000) / 10 : 0;
  const earnings = earningsFor(own);
  return { leadsCount: own.length, converted, conversionRate: rate, earnings: earnings.total, categoryLabel: partnerCategoryLabel(partner.type) };
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
