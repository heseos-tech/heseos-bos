// Installation jobs — the work installation partners pick up. A job is either an ORDER (door-lock
// landing-page order; its date/fee are set by Operations — see setInstallationSchedule in
// lib/heseosOrders.js) or a converted LEAD (a deal closed by a sales engineer; set from the same
// Operations panel via setLeadInstallation below). Both carry the same four fields:
//
//   installDate (YYYY-MM-DD) · installSlot · installFee (₹ the installer earns) · installPartnerId
//
// A job is AVAILABLE to installers once it has a date AND a fee and nobody has claimed it. It is
// shown to every installation partner whose coverage city matches the job's city; the first one to
// claim wins (race-safe via dbClaim — the same mechanism sales engineers use to claim demos).
// Customer phone and full address stay hidden until the job is claimed.
//
// Completing a job (by the installer, or by Operations marking the order/lead installed) writes a
// PENDING entry to the same `payouts` ledger Admin -> Payouts already settles, so installation
// earnings are paid out exactly like partner payouts.
import { dbList, dbGetById, dbPatch, dbClaim, dbInsert, dbWhere } from '@/lib/db';
import { advanceOrderStatus } from '@/lib/heseosOrders';
import { notifyHeseosOrderStatus } from '@/lib/heseosNotify';
import { pushHistory } from '@/lib/leadStage';

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const norm = (s) => String(s || '').trim().toLowerCase();
const ORDER_OPEN = new Set(['confirmed', 'packed', 'shipped', 'delivered']);

// A partner may cover more than one city — "Pune, Mumbai" (also / or ;).
export function partnerCities(partner) {
  return String(partner?.city || '').split(/[,/;]/).map(norm).filter(Boolean);
}
export function cityMatches(partner, city) {
  const c = norm(city);
  return !!c && partnerCities(partner).includes(c);
}

export function isInstaller(partner) {
  return !!partner && partner.type === 'installer' && partner.active !== false;
}

function latestItems(lead) {
  const revs = Array.isArray(lead.quotationRevisions) ? lead.quotationRevisions : [];
  for (let i = revs.length - 1; i >= 0; i--) {
    if (Array.isArray(revs[i].items) && revs[i].items.length) return revs[i].items.map((it) => ({ name: it.name, qty: it.qty || 1 }));
  }
  return [];
}

export function orderToJob(o) {
  return {
    kind: 'order', id: o.id, ref: o.id,
    customerName: o.customerName || '', phone: o.phone || '', address: o.deliveryAddress || '',
    city: o.city || '', pincode: o.pincode || '',
    items: (o.items || []).map((i) => ({ name: i.name, qty: i.qty || 1 })),
    installDate: o.installDate || '', installSlot: o.installSlot || '', fee: o.installFee ?? null,
    partnerId: o.installPartnerId || null, claimedAt: o.installClaimedAt || null, completedAt: o.installCompletedAt || null,
    payoutId: o.installPayoutId || null,
    stage: o.status, done: o.status === 'installed', open: ORDER_OPEN.has(o.status),
    notes: o.notes || '',
  };
}

export function leadToJob(l) {
  const converted = l.demoOutcome === 'converted';
  const done = l.installStatus === 'completed';
  return {
    kind: 'lead', id: l.id, ref: l.id,
    customerName: l.name || '', phone: l.phone || '', address: l.demoAddress || '',
    city: l.city || '', pincode: l.pincode || '',
    items: latestItems(l),
    installDate: l.installDate ? String(l.installDate).slice(0, 10) : '', installSlot: l.installSlot || '', fee: l.installFee ?? null,
    partnerId: l.installPartnerId || null, claimedAt: l.installClaimedAt || null, completedAt: l.installCompletedAt || null,
    payoutId: l.installPayoutId || null,
    stage: done ? 'installed' : (l.installStatus || 'pending'), done, open: converted && !done,
    notes: l.conversionNote || '',
  };
}

export const toJob = (kind, row) => (kind === 'lead' ? leadToJob(row) : orderToJob(row));
const TABLE = { order: 'orders', lead: 'leads' };

export function isAvailable(job) {
  return !!job && job.open && !job.done && DATE_RE.test(job.installDate) && Number(job.fee) > 0 && !job.partnerId;
}

// What an installer sees BEFORE claiming: enough to judge the job, not enough to bypass Heseos.
export function publicJob(job) {
  const { phone, address, customerName, notes, payoutId, ...rest } = job; // eslint-disable-line no-unused-vars
  return { ...rest, area: [job.city, job.pincode].filter(Boolean).join(' · '), masked: true };
}

export async function listJobsForInstaller(partner) {
  const [orders, leads, mineOrders, mineLeads, payouts] = await Promise.all([
    dbList('orders'), dbList('leads'),
    dbWhere('orders', 'installPartnerId', partner.id), dbWhere('leads', 'installPartnerId', partner.id),
    dbWhere('payouts', 'partnerId', partner.id),
  ]);
  const byJob = new Map(payouts.filter((p) => p.source === 'installation').map((p) => [`${p.jobKind}:${p.jobId}`, p]));
  const sortByDate = (a, b) => (a.installDate < b.installDate ? -1 : a.installDate > b.installDate ? 1 : 0);

  const available = [...orders.map(orderToJob), ...leads.map(leadToJob)]
    .filter((j) => isAvailable(j) && cityMatches(partner, j.city))
    .sort(sortByDate).map(publicJob);

  const mine = [...mineOrders.map(orderToJob), ...mineLeads.map(leadToJob)]
    .map((j) => ({ ...j, payoutStatus: byJob.get(`${j.kind}:${j.id}`)?.status || null, paidAt: byJob.get(`${j.kind}:${j.id}`)?.paidAt || null }))
    .sort((a, b) => (a.done !== b.done ? (a.done ? 1 : -1) : a.done ? ts(b.completedAt) - ts(a.completedAt) : sortByDate(a, b)));
  return { available, mine };
}
const ts = (x) => new Date(x || 0).getTime();

async function load(kind, id) {
  const table = TABLE[kind];
  if (!table || !id) return null;
  const row = await dbGetById(table, String(id));
  return row ? { table, row, job: toJob(kind, row) } : null;
}

function stamp(kind, row, text, by) {
  const now = new Date().toISOString();
  if (kind === 'lead') return pushHistory(row, { event: text, by });
  return [...(row.history || []), { status: text, at: now, by }];
}

export async function claimJob(partner, kind, id) {
  const found = await load(kind, id);
  if (!found) return { ok: false, status: 404, error: 'Job not found' };
  const { table, row, job } = found;
  if (!cityMatches(partner, job.city)) return { ok: false, status: 403, error: 'This job is outside your coverage area' };
  if (!isAvailable(job)) return { ok: false, status: 409, error: job.partnerId ? 'Someone else already claimed this job' : 'This job is no longer available' };
  const now = new Date().toISOString();
  const patch = {
    installPartnerId: partner.id, installClaimedAt: now,
    history: stamp(kind, row, `Installation claimed by ${partner.name}`, `${partner.name} (installer)`),
  };
  if (kind === 'lead') patch.installStatus = 'scheduled';
  const r = await dbClaim(table, id, 'installPartnerId', patch);
  if (!r.ok) return { ok: false, status: r.reason === 'not_found' ? 404 : 409, error: r.reason === 'not_found' ? 'Job not found' : 'Someone else already claimed this job' };
  return { ok: true, job: toJob(kind, r.data) };
}

export async function releaseJob(partner, kind, id, { byOps = false, actor } = {}) {
  const found = await load(kind, id);
  if (!found) return { ok: false, status: 404, error: 'Job not found' };
  const { table, row, job } = found;
  if (!job.partnerId || (!byOps && job.partnerId !== partner?.id)) return { ok: false, status: 403, error: 'This job is not assigned to you' };
  if (job.done) return { ok: false, status: 400, error: 'This installation is already complete' };
  const label = byOps ? `Installer released by ${actor || 'Operations'}` : `Installation released by ${partner.name}`;
  const patch = { installPartnerId: null, installClaimedAt: null, history: stamp(kind, row, label, byOps ? (actor || 'Operations') : `${partner.name} (installer)`) };
  if (kind === 'lead') patch.installStatus = job.installDate ? 'scheduled' : 'pending';
  const updated = await dbPatch(table, id, patch);
  return { ok: true, job: toJob(kind, updated) };
}

// Creates the PENDING payout the installer is owed — once per job (deterministic id).
export async function ensureInstallPayout(kind, id) {
  const found = await load(kind, id);
  if (!found) return null;
  const { table, row, job } = found;
  if (!job.partnerId || !(Number(job.fee) > 0)) return null;
  const payId = `PAYI_${kind}_${id}`;
  const existing = await dbGetById('payouts', payId);
  if (existing) return existing;
  const now = new Date().toISOString();
  const payout = {
    id: payId, partnerId: job.partnerId, periodLabel: `Installation · ${job.ref}`, amount: Number(job.fee),
    status: 'pending', method: '', reference: '',
    note: `${job.customerName || ''}${job.items.length ? ` — ${job.items.map((i) => `${i.name} × ${i.qty}`).join(', ')}` : ''}`.trim(),
    source: 'installation', jobKind: kind, jobId: id,
    createdBy: 'system', createdAt: now, updatedAt: now, paidAt: null,
  };
  await dbInsert('payouts', payId, payout);
  await dbPatch(table, id, { installPayoutId: payId });
  return payout;
}

// The installer marks the job done. Orders move to Installation Done (customer is told on
// WhatsApp); leads move to install status Completed.
export async function completeJob(partner, kind, id) {
  const found = await load(kind, id);
  if (!found) return { ok: false, status: 404, error: 'Job not found' };
  const { table, row, job } = found;
  if (job.partnerId !== partner.id) return { ok: false, status: 403, error: 'This job is not assigned to you' };
  if (job.done) return { ok: false, status: 400, error: 'This installation is already marked complete' };
  const now = new Date().toISOString();
  const by = `${partner.name} (installer)`;
  if (kind === 'order') {
    if (row.status !== 'delivered') return { ok: false, status: 400, error: "This order hasn't been marked Delivered yet — check with Operations" };
    const updated = await advanceOrderStatus(id, 'installed', by);
    await dbPatch('orders', id, { installCompletedAt: now });
    notifyHeseosOrderStatus(updated, 'installed').catch(() => {}); // best-effort, never blocks the completion
  } else {
    await dbPatch('leads', id, {
      installStatus: 'completed', installCompletedAt: now, installCompletedBy: partner.id,
      history: stamp('lead', row, 'Installation completed', by),
    });
  }
  const payout = await ensureInstallPayout(kind, id);
  const fresh = await load(kind, id);
  return { ok: true, job: fresh.job, payout };
}

// ── Operations side (leads) ─────────────────────────────────────────────────

export async function listLeadInstallJobs() {
  const leads = await dbList('leads');
  return leads.filter((l) => l.demoOutcome === 'converted').map(leadToJob);
}

export async function setLeadInstallation(id, { date, slot, fee, releaseInstaller } = {}, actor) {
  const lead = await dbGetById('leads', id);
  if (!lead || lead.demoOutcome !== 'converted') return { ok: false, status: 404, error: 'Converted lead not found' };
  if (lead.installStatus === 'completed') return { ok: false, status: 400, error: 'This installation is already complete' };
  if (releaseInstaller) {
    if (!lead.installPartnerId) return { ok: false, status: 400, error: 'No installer is assigned' };
    return releaseJob(null, 'lead', id, { byOps: true, actor });
  }
  const patch = {};
  const events = [];
  if (date !== undefined) {
    const d = String(date || '');
    if (d && !DATE_RE.test(d)) return { ok: false, status: 400, error: 'Pick a valid installation date' };
    const s = d ? String(slot || '').slice(0, 60) : '';
    if ((lead.installDate ? String(lead.installDate).slice(0, 10) : '') !== d || (lead.installSlot || '') !== s) {
      patch.installDate = d || null; patch.installSlot = s;
      if (!lead.installPartnerId) patch.installStatus = d ? 'scheduled' : 'pending';
      events.push(d ? `Installation scheduled for ${d}${s ? ` (${s})` : ''}` : 'Installation date cleared');
    }
  }
  if (fee !== undefined) {
    const n = fee === '' || fee === null ? null : Math.round(Number(fee) * 100) / 100;
    if (n !== null && (!Number.isFinite(n) || n < 0 || n > 1000000)) return { ok: false, status: 400, error: 'Enter a valid installation fee' };
    if ((lead.installFee ?? null) !== n) { patch.installFee = n; events.push(n == null ? 'Installation fee cleared' : `Installation fee set to ₹${n}`); }
  }
  if (!events.length) return { ok: true, job: leadToJob(lead), changed: false };
  let history = lead.history;
  for (const e of events) history = pushHistory({ history }, { event: e, by: actor || 'Operations' });
  patch.history = history;
  const updated = await dbPatch('leads', id, patch);
  return { ok: true, job: leadToJob(updated), changed: true };
}

// Operations marks a converted lead's installation done (when no installer app is involved, or on
// the installer's behalf). Pays the installer if one was assigned.
export async function completeLeadByOps(id, actor) {
  const lead = await dbGetById('leads', id);
  if (!lead || lead.demoOutcome !== 'converted') return { ok: false, status: 404, error: 'Converted lead not found' };
  if (lead.installStatus === 'completed') return { ok: false, status: 400, error: 'Already marked complete' };
  const now = new Date().toISOString();
  await dbPatch('leads', id, { installStatus: 'completed', installCompletedAt: now, history: pushHistory(lead, { event: 'Installation completed', by: actor || 'Operations' }) });
  await ensureInstallPayout('lead', id);
  const fresh = await dbGetById('leads', id);
  return { ok: true, job: leadToJob(fresh) };
}
