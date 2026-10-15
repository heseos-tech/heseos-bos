// Landing-page analytics for the two WhatsApp-linked pages (/lock = door lock, /smart-home).
//
// Two kinds of rows live in the `landing_activity` collection:
//   kind 'session'    one per visit (browser tab). public/hs-track.js keeps a CUMULATIVE snapshot of
//                     what the visitor did (scroll depth, sections reached, buttons tapped, form
//                     started / submitted, time on page) and POSTs it to /api/track repeatedly; we
//                     merge it into one row, so a late or out-of-order snapshot can never lose data.
//   kind 'card_sent'  one per WhatsApp link card HESEOS Buddy sends (lib/botFlowEngine.js). WhatsApp
//                     gives no "button tapped" callback, so a card counts as OPENED when a session
//                     arrives from that phone number (the link carries ?p=<mobile>).
//
// First-party only: no cookies, no IP address stored, no third-party scripts. The phone number is
// only known when the link carried it (?p=) or the visitor actually submitted the form.

import { dbGetById, dbInsert, dbListSince } from '@/lib/db';
import { checkRateLimit } from '@/lib/rateLimit';

export const LANDING_PAGES = { door_lock: 'Door Lock', smart_home: 'Smart Home' };

// Section ids present on each page (in page order) — labels for the "how far did they get" chart.
const SECTIONS = {
  door_lock: [['hero', 'Top of page'], ['features', 'Features'], ['built', 'Built to last'], ['order', 'Order form']],
  smart_home: [['hero', 'Top of page'], ['asaan', 'Asaan hai'], ['products', 'Products'], ['app', 'The app'], ['how', 'How it works'], ['enquire', 'Enquiry form']],
};

const SID_RE = /^[a-z0-9]{8,40}$/;
const SECTION_ID_RE = /^[a-z0-9_-]{1,30}$/i;
const clamp = (v, n) => String(v ?? '').slice(0, n);
const num = (v, max) => Math.max(0, Math.min(max, Math.round(Number(v) || 0)));
const digits10 = (v) => { const d = String(v || '').replace(/\D/g, ''); return d.length >= 10 ? d.slice(-10) : ''; };

function cleanSnapshot(b) {
  const sections = (Array.isArray(b.sections) ? b.sections : []).slice(0, 14)
    .filter((s) => Array.isArray(s) && SECTION_ID_RE.test(String(s[0] || '')))
    .map((s) => [String(s[0]).toLowerCase(), num(s[1], 7200)]);
  const clicks = (Array.isArray(b.clicks) ? b.clicks : []).slice(0, 40)
    .filter((c) => Array.isArray(c) && c[0])
    .map((c) => [clamp(c[0], 40), clamp(c[1], 30), num(c[2], 7200)]);
  const contact = b.contact && typeof b.contact === 'object'
    ? { name: clamp(b.contact.name, 60), phone: digits10(b.contact.phone) } : null;
  return {
    page: String(b.page || ''),
    via: b.via === 'wa' ? 'wa' : '',
    ref: /^[A-Za-z0-9]{4,24}$/.test(String(b.ref || '')) ? String(b.ref) : '',
    phone: digits10(b.p),
    utm: { source: clamp(b.utm?.source, 40), medium: clamp(b.utm?.medium, 40), campaign: clamp(b.utm?.campaign, 60) },
    referrer: clamp(b.referrer, 60),
    device: ['mobile', 'tablet', 'desktop'].includes(b.device) ? b.device : 'mobile',
    maxScroll: num(b.maxScroll, 100),
    activeSeconds: num(b.activeSeconds, 7200),
    sections,
    clicks,
    formStartSecs: b.formStartSecs == null ? null : num(b.formStartSecs, 7200),
    fields: (Array.isArray(b.fields) ? b.fields : []).slice(0, 15).map((f) => clamp(f, 20)),
    submitAttempts: num(b.submitAttempts, 50),
    errors: num(b.errors, 50),
    submittedSecs: b.submittedSecs == null ? null : num(b.submittedSecs, 7200),
    contact: contact && (contact.name || contact.phone) ? contact : null,
    refId: clamp(b.refId, 40),
  };
}

const minNum = (a, b) => (a == null ? b : b == null ? a : Math.min(a, b));

function mergeSession(existing, snap, nowIso) {
  const sectionMap = new Map((existing.sections || []).map(([id, s]) => [id, s]));
  for (const [id, s] of snap.sections) sectionMap.set(id, sectionMap.has(id) ? Math.min(sectionMap.get(id), s) : s);
  const clickKeys = new Set();
  const clicks = [];
  for (const c of [...(existing.clicks || []), ...snap.clicks]) {
    const k = c.join('|');
    if (!clickKeys.has(k) && clicks.length < 40) { clickKeys.add(k); clicks.push(c); }
  }
  return {
    ...existing,
    lastSeenAt: nowIso,
    updates: (existing.updates || 0) + 1,
    maxScroll: Math.max(existing.maxScroll || 0, snap.maxScroll),
    activeSeconds: Math.max(existing.activeSeconds || 0, snap.activeSeconds),
    sections: [...sectionMap.entries()],
    clicks,
    formStartSecs: minNum(existing.formStartSecs ?? null, snap.formStartSecs),
    fields: [...new Set([...(existing.fields || []), ...snap.fields])].slice(0, 15),
    submitAttempts: Math.max(existing.submitAttempts || 0, snap.submitAttempts),
    errors: Math.max(existing.errors || 0, snap.errors),
    submittedSecs: minNum(existing.submittedSecs ?? null, snap.submittedSecs),
    contact: snap.contact || existing.contact || null,
    refId: snap.refId || existing.refId || '',
    // First-touch facts never change once the session exists.
    phone: existing.phone || snap.phone,
  };
}

// Called by POST /api/track. Never throws for bad input — analytics must never break a page.
export async function recordLandingSnapshot(body, ip) {
  const sid = String(body?.sid || '');
  if (!SID_RE.test(sid) || !LANDING_PAGES[body?.page]) return { ok: false };
  const snap = cleanSnapshot(body);
  const id = `ls_${sid}`;
  const now = new Date().toISOString();
  const existing = await dbGetById('landing_activity', id);
  if (existing) {
    if ((existing.updates || 0) >= 400) return { ok: true, ignored: true }; // runaway tab / abuse guard
    await dbInsert('landing_activity', id, mergeSession(existing, snap, now));
    return { ok: true };
  }
  // A brand-new session: cap how many one IP can open per hour.
  const rl = await checkRateLimit(`landing:${ip}`, { max: 40, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) return { ok: false, limited: true };
  const base = {
    id, kind: 'session', sid, at: now, lastSeenAt: now, updates: 1,
    page: snap.page, via: snap.via, ref: snap.ref, utm: snap.utm, referrer: snap.referrer, device: snap.device,
    phone: snap.phone,
    maxScroll: 0, activeSeconds: 0, sections: [], clicks: [], formStartSecs: null, fields: [],
    submitAttempts: 0, errors: 0, submittedSecs: null, contact: null, refId: '',
  };
  await dbInsert('landing_activity', id, mergeSession(base, snap, now));
  return { ok: true };
}

// Called from lib/botFlowEngine.js whenever a WhatsApp link card pointing at a landing page is sent.
export async function logLandingCardSent({ phone, url, chatId, attributionKind }) {
  const page = /\/smart-home\b/.test(url || '') ? 'smart_home' : /\/lock\b/.test(url || '') ? 'door_lock' : null;
  const p = digits10(phone);
  if (!page || !p) return null;
  const at = new Date().toISOString();
  const id = `cs_${p}_${Date.now().toString(36)}`;
  return dbInsert('landing_activity', id, { id, kind: 'card_sent', page, phone: p, at, chatId: chatId || null, attributionKind: attributionKind || null });
}

const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);
const funnelRows = (stages) => stages.map(([key, label, count], i) => ({ key, label, count, pct: pct(count, stages[0][2]) }));

function statusOf(s) {
  if (s.submittedSecs != null) return 'submitted';
  if (s.formStartSecs != null) return 'form_started';
  if (s.maxScroll >= 50) return 'browsed';
  return 'opened';
}
export const sourceOf = (s) => (s.via === 'wa' ? 'WhatsApp' : s.ref ? 'QR / Referral' : 'Direct / other');

export async function buildLandingReport({ days = 7, page = 'all' } = {}) {
  const d = [1, 7, 30, 90].includes(Number(days)) ? Number(days) : 7;
  const pg = LANDING_PAGES[page] ? page : 'all';
  const since = new Date(Date.now() - d * 86400000).toISOString();
  const rows = await dbListSince('landing_activity', 'at', since);
  const inPage = (r) => pg === 'all' || r.page === pg;
  const sessions = rows.filter((r) => r.kind === 'session' && inPage(r));
  const cardRows = rows.filter((r) => r.kind === 'card_sent' && inPage(r));

  // WhatsApp cards: one "person" per (phone, page) — the earliest card in the window.
  const people = new Map();
  for (const c of cardRows) {
    const k = `${c.phone}|${c.page}`;
    if (!people.has(k) || c.at < people.get(k).at) people.set(k, c);
  }
  const sessionFor = (c) => sessions.filter((s) => s.phone === c.phone && s.page === c.page && s.at >= new Date(new Date(c.at).getTime() - 60000).toISOString());
  const opened = []; const notOpened = [];
  const fifteenMinAgo = new Date(Date.now() - 15 * 60000).toISOString();
  for (const c of people.values()) {
    const ss = sessionFor(c);
    if (ss.length) opened.push({ card: c, sessions: ss });
    else if (c.at <= fifteenMinAgo) notOpened.push(c);
  }
  const waFunnel = funnelRows([
    ['sent', 'Cards sent', people.size],
    ['opened', 'Opened page', opened.length],
    ['read', 'Read 50%+', opened.filter((o) => o.sessions.some((s) => s.maxScroll >= 50)).length],
    ['form', 'Started form', opened.filter((o) => o.sessions.some((s) => s.formStartSecs != null)).length],
    ['done', 'Submitted', opened.filter((o) => o.sessions.some((s) => s.submittedSecs != null)).length],
  ]);
  const allFunnel = funnelRows([
    ['visits', 'Visits', sessions.length],
    ['engaged', 'Engaged', sessions.filter((s) => s.maxScroll >= 50 || s.activeSeconds >= 30).length],
    ['form', 'Started form', sessions.filter((s) => s.formStartSecs != null).length],
    ['done', 'Submitted', sessions.filter((s) => s.submittedSecs != null).length],
  ]);

  const bySource = { WhatsApp: 0, 'QR / Referral': 0, 'Direct / other': 0 };
  const byDevice = { mobile: 0, tablet: 0, desktop: 0 };
  for (const s of sessions) { bySource[sourceOf(s)] += 1; byDevice[s.device] = (byDevice[s.device] || 0) + 1; }

  let sections = [];
  if (pg !== 'all') {
    sections = SECTIONS[pg].map(([id, label]) => {
      const count = id === 'hero' ? sessions.length : sessions.filter((s) => (s.sections || []).some(([sid]) => sid === id)).length;
      return { id, label, count, pct: pct(count, sessions.length) };
    });
  }

  const clickAgg = new Map();
  for (const s of sessions) {
    const seen = new Set();
    for (const [label, loc] of s.clicks || []) {
      const k = `${label}||${loc}`;
      const e = clickAgg.get(k) || { label, loc, taps: 0, people: 0, page: s.page };
      e.taps += 1;
      if (!seen.has(k)) { e.people += 1; seen.add(k); }
      clickAgg.set(k, e);
    }
  }
  const clicks = [...clickAgg.values()].sort((a, b) => b.taps - a.taps).slice(0, 12);

  const avg = (arr) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0);
  const summary = {
    visits: sessions.length,
    submitted: sessions.filter((s) => s.submittedSecs != null).length,
    avgSeconds: avg(sessions.map((s) => s.activeSeconds)),
    avgScroll: avg(sessions.map((s) => s.maxScroll)),
    cardsSent: people.size,
    cardsOpened: opened.length,
    bounced: sessions.filter((s) => s.maxScroll < 25 && s.activeSeconds < 10 && !(s.clicks || []).length).length,
  };

  const recent = [...sessions].sort((a, b) => String(b.lastSeenAt).localeCompare(String(a.lastSeenAt))).slice(0, 150).map((s) => ({
    id: s.id, at: s.at, lastSeenAt: s.lastSeenAt, page: s.page, source: sourceOf(s), via: s.via, ref: s.ref,
    utm: s.utm, referrer: s.referrer, device: s.device,
    phone: s.contact?.phone || s.phone || '', name: s.contact?.name || '', refId: s.refId,
    maxScroll: s.maxScroll, activeSeconds: s.activeSeconds, sections: s.sections, clicks: s.clicks,
    formStartSecs: s.formStartSecs, fields: s.fields, submitAttempts: s.submitAttempts, errors: s.errors,
    submittedSecs: s.submittedSecs, status: statusOf(s),
  }));

  return {
    days: d, page: pg, generatedAt: new Date().toISOString(),
    summary, waFunnel, allFunnel, bySource, byDevice, sections, clicks, recent,
    notOpened: notOpened.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 100).map((c) => ({ phone: c.phone, page: c.page, sentAt: c.at })),
  };
}
