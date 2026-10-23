'use client';
// Operations panel (desktop) — every order from Confirmed onward, so operations can plan
// packing -> dispatch -> delivery -> installation, and record the installation date they agree
// with the customer on the phone (the customer then gets a WhatsApp confirmation).
//
// Same sidebar/topbar/table language as Admin and the other employee panels
// (components/employee/ui.jsx's EmployeeShell, app/admin/admin.css) and the same endpoints as
// Admin -> Orders (/api/admin/orders, /api/admin/orders/[id]) — which any logged-in employee can
// use; cancelling is the one action the API keeps for admins. The phone-sized version of this
// lives in components/team/OperationsOrdersScreen.jsx.
import { useMemo, useState } from 'react';
import { EmployeeShell } from '@/components/employee/ui';
import { StatCard, Modal, Pagination } from '@/components/admin/ui';
import { IconOrders, IconDemo, IconSearch, IconConversions, IconLeads, IconPhone, IconWhatsApp, IconDownload } from '@/components/admin/icons';
import { useApiResource, invalidate } from '@/lib/useApiResource';
import ShippingSection from '@/components/admin/ShippingSection';

const ORDERS_URL = '/api/admin/orders';
const PAGE_SIZE = 10;

// Local copies of lib/heseosOrders.js constants (server file).
const INSTALL_SLOTS = ['Morning (9 am – 12 pm)', 'Afternoon (12 – 4 pm)', 'Evening (4 – 7 pm)'];
const STAGES = [
  { key: 'confirmed', tab: 'To pack', label: 'Confirmed', next: 'packed', action: 'Mark Packed' },
  { key: 'packed', tab: 'Packed', label: 'Packed', next: 'shipped', action: 'Mark Dispatched' },
  { key: 'shipped', tab: 'Dispatched', label: 'Dispatched', next: 'delivered', action: 'Mark Delivered' },
  { key: 'delivered', tab: 'Delivered / to install', label: 'Delivered', next: 'installed', action: 'Mark Installed' },
  { key: 'installed', tab: 'Installed', label: 'Installation Done', next: null, action: null },
];
const STAGE = Object.fromEntries(STAGES.map((s) => [s.key, s]));
// A cancel only makes sense until the goods are with the customer (same rule as Admin -> Orders).
const CANCELLABLE = new Set(['confirmed', 'packed', 'shipped']);
const NAV = [
  { key: 'orders', label: 'Orders', Icon: IconOrders },
  { key: 'schedule', label: 'Installations', Icon: IconDemo },
  { key: 'leads', label: 'Converted Leads', Icon: IconLeads },
];
const LEADS_URL = '/api/admin/installations/leads';
const leadBucket = (j) => (j.done ? 'done' : j.partnerId ? 'claimed' : j.installDate && Number(j.fee) > 0 ? 'open' : 'plan');
const LEAD_TABS = [
  { key: 'plan', tab: 'To schedule' }, { key: 'open', tab: 'Open for installers' },
  { key: 'claimed', tab: 'Claimed' }, { key: 'done', tab: 'Installed' },
];

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const digits = (p) => String(p || '').replace(/\D/g, '');
const waHref = (p) => { const d = digits(p); return `https://wa.me/${d.length === 10 ? `91${d}` : d}`; };
const telHref = (p) => { const d = digits(p); return `tel:${d.length === 10 ? '+91' : '+'}${d}`; };
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fmtDate(ymd) {
  if (!ymd) return '';
  return new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
function dueTag(ymd) { const t = todayStr(); return ymd < t ? 'overdue' : ymd === t ? 'today' : ''; }
const ts = (x) => new Date(x || 0).getTime();

export default function OperationsPanel({ employee }) {
  const { data: orders, loading } = useApiResource(ORDERS_URL, { pollMs: 20000 });
  const { data: leadJobs, loading: leadsLoading } = useApiResource(LEADS_URL, { pollMs: 30000 });
  const { data: partners } = useApiResource('/api/admin/partners', { pollMs: 60000 });
  const pmap = useMemo(() => Object.fromEntries(partners.map((p) => [p.id, p])), [partners]);
  const [leadTab, setLeadTab] = useState('plan');
  const [leadModalId, setLeadModalId] = useState(null);
  const [lq, setLq] = useState('');
  const [section, setSection] = useState('orders');
  const [tab, setTab] = useState('confirmed');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [modalId, setModalId] = useState(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');

  function flash(msg) { setNotice(msg); setTimeout(() => setNotice(''), 5000); }

  const pipeline = useMemo(() => orders.filter((o) => STAGE[o.status]), [orders]);
  const counts = useMemo(() => {
    const c = {};
    for (const s of STAGES) c[s.key] = 0;
    for (const o of pipeline) c[o.status] += 1;
    return c;
  }, [pipeline]);
  const open = pipeline.filter((o) => o.status !== 'installed');
  const noDate = open.filter((o) => !o.installDate).length;
  const dueToday = open.filter((o) => o.installDate === todayStr()).length;

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    let list = pipeline.filter((o) => (s ? `${o.id} ${o.customerName || ''} ${o.phone || ''} ${o.city || ''} ${o.pincode || ''}`.toLowerCase().includes(s) : o.status === tab));
    if (tab === 'installed' && !s) return list.sort((a, b) => ts(b.updatedAt) - ts(a.updatedAt));
    return list.sort((a, b) => {
      if (tab === 'delivered' && !!a.installDate !== !!b.installDate) return a.installDate ? 1 : -1;
      if (a.installDate && b.installDate && a.installDate !== b.installDate) return a.installDate < b.installDate ? -1 : 1;
      return ts(a.createdAt) - ts(b.createdAt);
    });
  }, [pipeline, tab, q]);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const schedule = useMemo(() => open.filter((o) => o.installDate).sort((a, b) => (a.installDate < b.installDate ? -1 : a.installDate > b.installDate ? 1 : ts(a.createdAt) - ts(b.createdAt))), [open]);
  const unscheduled = useMemo(() => open.filter((o) => !o.installDate).sort((a, b) => ts(a.createdAt) - ts(b.createdAt)), [open]);

  const leadCounts = useMemo(() => { const c = { plan: 0, open: 0, claimed: 0, done: 0 }; for (const j of leadJobs) c[leadBucket(j)] += 1; return c; }, [leadJobs]);
  const leadRows = useMemo(() => {
    const t = lq.trim().toLowerCase();
    return leadJobs.filter((j) => (t ? `${j.ref} ${j.customerName} ${j.phone} ${j.city}`.toLowerCase().includes(t) : leadBucket(j) === leadTab))
      .sort((a, b) => (a.installDate && b.installDate ? (a.installDate < b.installDate ? -1 : 1) : a.installDate ? 1 : b.installDate ? -1 : 0));
  }, [leadJobs, leadTab, lq]);
  const leadModal = leadModalId ? leadJobs.find((j) => j.id === leadModalId) : null;

  const modalOrder = modalId ? orders.find((o) => o.id === modalId) : null;

  async function patch(order, body) {
    setBusy(order.id);
    try {
      const res = await fetch(`${ORDERS_URL}/${order.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      await invalidate(ORDERS_URL);
      if (!res.ok) { flash(data.error || 'Could not save — try again'); return null; }
      return data;
    } catch {
      flash('Network problem — try again');
      return null;
    } finally { setBusy(''); }
  }

  async function advance(order) {
    const st = STAGE[order.status];
    if (!st?.next) return;
    if (!window.confirm(`${st.action} for ${order.customerName || order.id}? The customer gets a WhatsApp update.`)) return;
    const r = await patch(order, { status: st.next });
    if (r) flash(`Order ${order.id} → ${STAGE[st.next].label}${r.whatsappSent ? ' — customer notified on WhatsApp' : ' — WhatsApp message could not be sent'}`);
  }
  async function markPaid(order) {
    if (!window.confirm(`Payment of ${money(order.subtotal)} received for ${order.id}?`)) return;
    if (await patch(order, { markPaid: true })) flash('Payment marked as received');
  }
  async function cancel(order) {
    if (!window.confirm(`Cancel order ${order.id}? This can't be undone, and the customer is told on WhatsApp.`)) return;
    const r = await patch(order, { status: 'cancelled' });
    if (r) { setModalId(null); flash(`Order ${order.id} cancelled${r.whatsappSent ? ' — customer notified on WhatsApp' : ' — WhatsApp message could not be sent'}`); }
  }
  async function saveSchedule(order, date, slot, fee) {
    const r = await patch(order, { installation: { date, slot, fee: fee === '' ? null : Number(fee) } });
    if (!r) return false;
    flash(date ? `Installation saved for ${fmtDate(date)}${r.whatsappSent ? ' — customer notified on WhatsApp' : ''}` : 'Installation date cleared');
    return true;
  }
  async function releaseInstaller(order) {
    if (!window.confirm('Take this job back from the installer? It becomes available to other installers again.')) return;
    if (await patch(order, { installation: { releaseInstaller: true } })) flash('Installer released');
  }

  // Converted leads (closed deals) — separate endpoint, same idea.
  async function patchLead(job, body) {
    setBusy(job.id);
    try {
      const res = await fetch(`${LEADS_URL}/${job.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      await invalidate(LEADS_URL);
      if (!res.ok) { flash(data.error || 'Could not save — try again'); return null; }
      return data;
    } catch { flash('Network problem — try again'); return null; } finally { setBusy(''); }
  }
  async function saveLead(job, date, slot, fee) {
    const r = await patchLead(job, { date, slot, fee: fee === '' ? null : Number(fee) });
    if (r) flash(date ? `Installation saved for ${fmtDate(date)}` : 'Installation date cleared');
    return !!r;
  }
  async function releaseLead(job) {
    if (!window.confirm('Take this job back from the installer? It becomes available to other installers again.')) return;
    if (await patchLead(job, { releaseInstaller: true })) flash('Installer released');
  }
  async function completeLead(job) {
    if (!window.confirm(`Mark the installation for ${job.customerName || job.ref} as done?${job.partnerId ? ' The installer’s fee goes to payouts.' : ''}`)) return;
    if (await patchLead(job, { complete: true })) { setLeadModalId(null); flash('Marked installed'); }
  }
  // Velocity courier shipment: 'create' (also the retry), 'sync' (refresh tracking), 'cancel'.
  async function shippingAction(order, action) {
    if (action === 'cancel' && !window.confirm(`Cancel the courier shipment for ${order.id}? This only works before the courier has picked it up.`)) return;
    const r = await patch(order, { shipping: action });
    if (!r) return;
    flash(r.shippingError ? `Velocity: ${r.shippingError}` : action === 'create' ? 'Sent to Velocity — pick the courier there' : action === 'sync' ? 'Tracking refreshed' : 'Cancellation requested');
  }
  async function saveNotes(order, notes) {
    if (!(await patch(order, { notes }))) return false;
    flash('Note saved');
    return true;
  }

  return (
    <EmployeeShell employee={employee} section={section} onSection={(k) => { setSection(k); setModalId(null); }} navItems={NAV}>
      <div className="adm-page-head">
        <div>
          <h1 className="adm-h1">{section === 'orders' ? 'Orders' : section === 'schedule' ? 'Installations' : 'Converted Leads'}</h1>
          <p className="adm-page-sub">{section === 'orders'
            ? 'Confirmed orders through to installation — pack, dispatch, deliver, then call the customer and fix an installation date'
            : section === 'schedule' ? 'Installation dates agreed with customers, soonest first — and the orders still waiting for a date'
            : 'Deals closed by sales engineers — set the installation date and the installer’s fee, then installers in the city can claim the job'}</p>
        </div>
      </div>

      {notice && <div className="adm-notice">{notice}</div>}

      <div className="adm-stat-row">
        <StatCard label="To Pack" value={counts.confirmed} Icon={IconOrders} tone="orange" />
        <StatCard label="In Transit" value={counts.packed + counts.shipped} Icon={IconLeads} tone="purple" />
        <StatCard label="Need Install Date" value={noDate} Icon={IconPhone} tone="teal" />
        <StatCard label={dueToday ? 'Installing Today' : 'Installed'} value={dueToday || counts.installed} Icon={IconConversions} tone="green" />
      </div>

      {section === 'orders' && (
        <div className="adm-card">
          <div className="adm-toolbar">
            <div className="adm-search adm-search--inline"><IconSearch size={16} /><input placeholder="Search by order ID, customer, phone or city…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
          </div>
          <div className="adm-tabs">
            {STAGES.map((s) => (
              <button key={s.key} type="button" className={`adm-tab${tab === s.key && !q.trim() ? ' active' : ''}`} onClick={() => { setTab(s.key); setQ(''); setPage(1); }}>
                {s.tab} <span className="adm-tab-count">{counts[s.key]}</span>
              </button>
            ))}
          </div>
          <div className="adm-table-scroll">
            <table className="adm-table">
              <thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th><th>Installation</th><th></th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={8} className="adm-empty">Loading…</td></tr>
                  : pageRows.length === 0 ? <tr><td colSpan={8} className="adm-empty">{q.trim() ? 'No orders match this search.' : 'Nothing here right now.'}</td></tr>
                    : pageRows.map((o) => <OrderRow key={o.id} o={o} busy={busy === o.id} onOpen={() => setModalId(o.id)} onAdvance={() => advance(o)} installer={pmap[o.installPartnerId]} />)}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageCount={pageCount} total={rows.length} pageSize={PAGE_SIZE} onPage={setPage} />
        </div>
      )}

      {section === 'schedule' && (
        <>
          <div className="adm-card">
            <div className="adm-card-title" style={{ marginBottom: 10 }}>Scheduled installations ({schedule.length})</div>
            <div className="adm-table-scroll">
              <table className="adm-table">
                <thead><tr><th>Date</th><th>Time window</th><th>Customer</th><th>Address</th><th>Order status</th><th></th></tr></thead>
                <tbody>
                  {schedule.length === 0 ? <tr><td colSpan={6} className="adm-empty">No installation dates set yet.</td></tr> : schedule.map((o) => {
                    const due = dueTag(o.installDate);
                    return (
                      <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => setModalId(o.id)}>
                        <td><strong>{fmtDate(o.installDate)}</strong>{due && <span className={`adm-status-pill${due === 'today' ? ' active' : ''}`} style={{ marginLeft: 8 }}>{due === 'today' ? 'Today' : 'Overdue'}</span>}</td>
                        <td>{o.installSlot || '—'}</td>
                        <td><div className="adm-lead-name">{o.customerName || '—'}</div><div className="adm-lead-sub">{o.phone}</div></td>
                        <td style={{ maxWidth: 280 }}>{o.deliveryAddress || '—'}</td>
                        <td><span className="adm-status-pill pending">{STAGE[o.status].label}</span></td>
                        <td className="adm-row-actions"><button className="adm-chip-btn" onClick={(e) => { e.stopPropagation(); setModalId(o.id); }}>Manage</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="adm-card" style={{ marginTop: 16 }}>
            <div className="adm-card-title" style={{ marginBottom: 10 }}>Waiting for an installation date ({unscheduled.length})</div>
            <div className="adm-table-scroll">
              <table className="adm-table">
                <thead><tr><th>Order</th><th>Customer</th><th>Order status</th><th></th></tr></thead>
                <tbody>
                  {unscheduled.length === 0 ? <tr><td colSpan={4} className="adm-empty">Every open order has a date.</td></tr> : unscheduled.map((o) => (
                    <tr key={o.id}>
                      <td><code>{o.id}</code></td>
                      <td><div className="adm-lead-name">{o.customerName || '—'}</div><div className="adm-lead-sub">{o.phone}</div></td>
                      <td><span className="adm-status-pill pending">{STAGE[o.status].label}</span></td>
                      <td className="adm-row-actions"><button className="adm-chip-btn" onClick={() => setModalId(o.id)}>Set date</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {section === 'leads' && (
        <div className="adm-card">
          <div className="adm-toolbar">
            <div className="adm-search adm-search--inline"><IconSearch size={16} /><input placeholder="Search by name, phone, city or lead ID…" value={lq} onChange={(e) => setLq(e.target.value)} /></div>
          </div>
          <div className="adm-tabs">
            {LEAD_TABS.map((t) => (
              <button key={t.key} type="button" className={`adm-tab${leadTab === t.key && !lq.trim() ? ' active' : ''}`} onClick={() => { setLeadTab(t.key); setLq(''); }}>
                {t.tab} <span className="adm-tab-count">{leadCounts[t.key]}</span>
              </button>
            ))}
          </div>
          <div className="adm-table-scroll">
            <table className="adm-table">
              <thead><tr><th>Lead</th><th>Customer</th><th>Products</th><th>Deal value</th><th>Installation</th><th>Installer</th><th></th></tr></thead>
              <tbody>
                {leadsLoading ? <tr><td colSpan={7} className="adm-empty">Loading…</td></tr>
                  : leadRows.length === 0 ? <tr><td colSpan={7} className="adm-empty">Nothing here right now.</td></tr>
                    : leadRows.map((j) => (
                      <tr key={j.id} style={{ cursor: 'pointer' }} onClick={() => setLeadModalId(j.id)}>
                        <td><code>{j.ref}</code></td>
                        <td><div className="adm-lead-name">{j.customerName || '—'}</div><div className="adm-lead-sub">{j.phone}{j.city ? ` · ${j.city}` : ''}</div></td>
                        <td>{j.items.map((i) => `${i.name}${i.qty > 1 ? ` × ${i.qty}` : ''}`).join(', ') || '—'}</td>
                        <td>{j.finalPrice ? money(j.finalPrice) : '—'}</td>
                        <td>{j.installDate ? <span style={{ fontWeight: 600 }}>{fmtDate(j.installDate)}{j.installSlot ? <span className="adm-lead-sub" style={{ display: 'block' }}>{j.installSlot}</span> : null}</span> : <span className="adm-lead-sub">Not set</span>}</td>
                        <td>{Number(j.fee) > 0 ? <span style={{ fontWeight: 600 }}>{money(j.fee)}</span> : <span className="adm-lead-sub">No fee</span>}{j.partnerId && <span className="adm-lead-sub" style={{ display: 'block' }}>{pmap[j.partnerId]?.name || 'Assigned'}</span>}</td>
                        <td className="adm-row-actions"><button className="adm-chip-btn" onClick={(e) => { e.stopPropagation(); setLeadModalId(j.id); }}>Manage</button></td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {leadModal && (
        <LeadModal
          key={leadModal.id}
          job={leadModal}
          installer={pmap[leadModal.partnerId]}
          busy={busy === leadModal.id}
          onClose={() => setLeadModalId(null)}
          onSave={(d, s, f) => saveLead(leadModal, d, s, f)}
          onRelease={() => releaseLead(leadModal)}
          onComplete={() => completeLead(leadModal)}
        />
      )}

      {modalOrder && (
        <OrderModal
          key={modalOrder.id}
          order={modalOrder}
          busy={busy === modalOrder.id}
          onClose={() => setModalId(null)}
          onAdvance={() => advance(modalOrder)}
          onPaid={() => markPaid(modalOrder)}
          onCancel={() => cancel(modalOrder)}
          installer={pmap[modalOrder.installPartnerId]}
          onRelease={() => releaseInstaller(modalOrder)}
          onSchedule={(d, s, f) => saveSchedule(modalOrder, d, s, f)}
          onNotes={(n) => saveNotes(modalOrder, n)}
          onShipping={(a) => shippingAction(modalOrder, a)}
        />
      )}
    </EmployeeShell>
  );
}

function OrderRow({ o, busy, onOpen, onAdvance, installer }) {
  const st = STAGE[o.status];
  const done = o.status === 'installed';
  const due = o.installDate && !done ? dueTag(o.installDate) : '';
  return (
    <tr style={{ cursor: 'pointer' }} onClick={onOpen}>
      <td><code>{o.id}</code><div className="adm-lead-sub">{o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : ''}</div></td>
      <td><div className="adm-lead-name">{o.customerName || '—'}</div><div className="adm-lead-sub">{o.phone}{o.city ? ` · ${o.city}` : ''}</div></td>
      <td>{(o.items || []).map((i) => `${i.name}${i.qty > 1 ? ` × ${i.qty}` : ''}`).join(', ') || '—'}</td>
      <td>{money(o.subtotal)}</td>
      <td><span className={`adm-status-pill${o.paymentStatus === 'paid' ? ' active' : ' pending'}`}>{o.paymentStatus === 'paid' ? 'Paid' : 'Pending'}</span></td>
      <td><span className={`adm-status-pill${done ? ' active' : ' pending'}`}>{st.label}</span></td>
      <td>
        {o.installDate
          ? <span style={{ fontWeight: 600, color: due === 'overdue' ? '#b91c1c' : due === 'today' ? '#9a4a00' : undefined }}>{fmtDate(o.installDate)}{o.installSlot ? <span className="adm-lead-sub" style={{ display: 'block' }}>{o.installSlot}</span> : null}{due === 'overdue' ? <span className="adm-lead-sub" style={{ display: 'block', color: '#b91c1c' }}>Overdue</span> : null}</span>
          : done ? '—' : <span className="adm-lead-sub">Not set</span>}
        {awaitingConfirm(o) && <span className="adm-lead-sub" style={{ display: 'block', color: '#9a4a00', fontWeight: 600 }}>Customer booked — confirm</span>}
        {Number(o.installFee) > 0 && <span className="adm-lead-sub" style={{ display: 'block' }}>Fee {money(o.installFee)}{o.installPartnerId ? ` · ${installer?.name || 'Installer'}` : o.installDate ? ' · open' : ''}</span>}
      </td>
      <td className="adm-row-actions" style={{ whiteSpace: 'nowrap' }}>
        {st.next && <button className="adm-chip-btn" disabled={busy} onClick={(e) => { e.stopPropagation(); onAdvance(); }}>{st.action}</button>}{' '}
        <button className="adm-chip-btn" onClick={(e) => { e.stopPropagation(); onOpen(); }}>Manage</button>
      </td>
    </tr>
  );
}

// A date the customer picked via the "Book installation" button that Operations haven't confirmed yet.
const awaitingConfirm = (o) => !!(o && o.installDate && o.installRequestSource === 'customer' && !o.installConfirmedAt);

function OrderModal({ order, busy, installer, onClose, onAdvance, onPaid, onCancel, onRelease, onSchedule, onNotes, onShipping }) {
  const st = STAGE[order.status];
  const done = order.status === 'installed';
  const [date, setDate] = useState(order.installDate || '');
  const [slot, setSlot] = useState(order.installSlot || '');
  const [notes, setNotes] = useState(order.notes || '');
  const [fee, setFee] = useState(order.installFee != null ? String(order.installFee) : '');
  const dateDirty = date !== (order.installDate || '') || slot !== (order.installSlot || '');
  const feeDirty = fee !== (order.installFee != null ? String(order.installFee) : '');
  return (
    <Modal title={`Order ${order.id}`} sub={`${st.label} · placed ${order.createdAt ? new Date(order.createdAt).toLocaleString('en-IN') : '—'}`} onClose={onClose} wide>
      <div className="adm-detail-grid">
        <div><span className="adm-detail-label">Customer</span>{order.customerName || '—'}</div>
        <div>
          <span className="adm-detail-label">Phone</span>{order.phone}{' '}
          <a className="adm-chip-btn" href={telHref(order.phone)} style={{ textDecoration: 'none', marginLeft: 6 }}>Call</a>{' '}
          <a className="adm-chip-btn" href={waHref(order.phone)} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}><IconWhatsApp size={12} /> WhatsApp</a>
        </div>
        <div><span className="adm-detail-label">Payment</span>{order.paymentStatus === 'paid' ? `Paid${order.paidAt ? ` (${new Date(order.paidAt).toLocaleDateString('en-IN')})` : ''}` : 'Pending (Cash/UPI on delivery)'}</div>
        <div><span className="adm-detail-label">Total</span>{money(order.subtotal)}</div>
      </div>
      <div className="adm-detail-notes" style={{ marginTop: 4 }}>
        <span className="adm-detail-label">Delivery Address</span>{order.deliveryAddress}
      </div>
      <div style={{ marginTop: 12 }}>
        <span className="adm-detail-label">Items</span>
        <div style={{ marginTop: 4 }}>{(order.items || []).map((i, k) => <div key={k}>{i.name} × {i.qty} — {money(i.lineTotal ?? i.price * i.qty)}</div>)}</div>
      </div>

      <ShippingSection order={order} onAction={onShipping} />

      {!done && (
        <InstallForm
          job={{ installDate: order.installDate, installFee: order.installFee, partnerId: order.installPartnerId, city: order.city }}
          date={date} setDate={setDate} slot={slot} setSlot={setSlot} fee={fee} setFee={setFee}
          dirty={dateDirty || feeDirty} dateDirty={dateDirty} awaiting={awaitingConfirm(order)} customerNote={order.installCustomerNote} busy={busy} installer={installer} notify
          onSave={() => onSchedule(date, slot, fee)}
          onClear={() => { setDate(''); setSlot(''); onSchedule('', '', fee); }}
          onRelease={onRelease}
        />
      )}
      {done && order.installDate && (
        <div className="adm-detail-notes" style={{ marginTop: 14 }}><span className="adm-detail-label">Installed on schedule</span>{fmtDate(order.installDate)}{order.installSlot ? ` · ${order.installSlot}` : ''}</div>
      )}

      <div style={{ marginTop: 16 }}>
        <span className="adm-detail-label">Internal note (never shown to the customer)</span>
        <textarea className="lf-input" rows={3} maxLength={1000} style={{ marginTop: 6, width: '100%', resize: 'vertical' }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Customer asked to call after 6 pm" />
        {notes !== (order.notes || '') && <button className="adm-chip-btn" style={{ marginTop: 6 }} disabled={busy} onClick={() => onNotes(notes.trim())}>Save note</button>}
      </div>

      <div className="lf-actions" style={{ marginTop: 18, flexWrap: 'wrap' }}>
        <a className="adm-btn-outline" style={{ whiteSpace: 'nowrap' }} href={`/api/admin/orders/${order.id}/pdf?type=slip`}><IconDownload size={15} /> Generate Slip</a>
        <a className="adm-btn-outline" style={{ whiteSpace: 'nowrap' }} href={`/api/admin/orders/${order.id}/pdf?type=invoice`}><IconDownload size={15} /> Generate Invoice</a>
        {order.paymentStatus !== 'paid' && <button className="adm-chip-btn" style={{ whiteSpace: 'nowrap' }} disabled={busy} onClick={onPaid}>Mark Paid</button>}
        {CANCELLABLE.has(order.status) && <button className="lf-btn-back" style={{ whiteSpace: 'nowrap' }} disabled={busy} onClick={onCancel}>Cancel Order</button>}
        {st.next && <button className="lf-btn-next" style={{ flex: '1 1 100%', whiteSpace: 'nowrap' }} disabled={busy} onClick={onAdvance}>{st.action}</button>}
      </div>
      {st.next && <p className="adm-lead-sub" style={{ marginTop: 8 }}>The customer gets a WhatsApp update when you move this order forward.</p>}
    </Modal>
  );
}

// Date + time window + installer fee, and who (if anyone) has claimed the job — shared by the
// order window and the converted-lead window.
function InstallForm({ job, date, setDate, slot, setSlot, fee, setFee, dirty, dateDirty, awaiting = false, customerNote = '', busy, installer, notify, onSave, onClear, onRelease }) {
  const hasFee = Number(fee) > 0;
  return (
    <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--adm-border)' }}>
      <span className="adm-detail-label">Installation</span>
      {awaiting && (
        <p className="adm-lead-sub" style={{ marginTop: 6, color: '#9a4a00', fontWeight: 600 }}>
          The customer booked this date from the WhatsApp “Book installation” button. Confirm it (change it if needed) and add the installer fee.
          {customerNote ? <span style={{ display: 'block', fontWeight: 400 }}>Customer note: {customerNote}</span> : null}
        </p>
      )}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
        <input className="lf-input" type="date" min={todayStr()} value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 170 }} />
        <select className="lf-input" value={slot} onChange={(e) => setSlot(e.target.value)} style={{ width: 210 }}>
          <option value="">Any time (confirm on call)</option>
          {INSTALL_SLOTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input className="lf-input" type="number" min="0" placeholder="Installer fee ₹" value={fee} onChange={(e) => setFee(e.target.value)} style={{ width: 150 }} />
        <button className="lf-btn-next" disabled={busy || (!dirty && !awaiting) || (!date && !hasFee)} onClick={onSave}>{notify && awaiting && !dateDirty ? 'Confirm & notify customer' : notify && dateDirty ? 'Save & notify customer' : 'Save'}</button>
        {job.installDate && <button className="lf-btn-back" disabled={busy} onClick={onClear}>Clear date</button>}
      </div>
      <p className="adm-lead-sub" style={{ marginTop: 6 }}>
        Installers in {job.city || 'the order’s city'} can claim the job once it has a date and a fee.{notify ? ' The customer is sent a WhatsApp message whenever the date or time changes.' : ''}
      </p>
      {job.partnerId ? (
        <div className="adm-detail-notes" style={{ marginTop: 8 }}>
          <span className="adm-detail-label">Installer</span>
          {installer?.name || 'Assigned'}{installer?.phone ? ` · ${installer.phone}` : ''}{' '}
          <button className="adm-chip-btn" disabled={busy} onClick={onRelease}>Release</button>
        </div>
      ) : job.installDate && Number(job.installFee) > 0 ? (
        <p className="adm-lead-sub" style={{ marginTop: 6, color: '#0a7d3b' }}>Open — waiting for an installer to claim it.</p>
      ) : null}
    </div>
  );
}

function LeadModal({ job, installer, busy, onClose, onSave, onRelease, onComplete }) {
  const done = job.done;
  const [date, setDate] = useState(job.installDate || '');
  const [slot, setSlot] = useState(job.installSlot || '');
  const [fee, setFee] = useState(job.fee != null ? String(job.fee) : '');
  const dateDirty = date !== (job.installDate || '') || slot !== (job.installSlot || '');
  const dirty = dateDirty || fee !== (job.fee != null ? String(job.fee) : '');
  return (
    <Modal title={`Lead ${job.ref}`} sub={`${job.customerName || 'Customer'}${job.city ? ` · ${job.city}` : ''}`} onClose={onClose} wide>
      <div className="adm-detail-grid">
        <div><span className="adm-detail-label">Customer</span>{job.customerName || '—'}</div>
        <div>
          <span className="adm-detail-label">Phone</span>{job.phone}{' '}
          <a className="adm-chip-btn" href={telHref(job.phone)} style={{ textDecoration: 'none', marginLeft: 6 }}>Call</a>{' '}
          <a className="adm-chip-btn" href={waHref(job.phone)} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}><IconWhatsApp size={12} /> WhatsApp</a>
        </div>
        <div><span className="adm-detail-label">Deal value</span>{job.finalPrice ? money(job.finalPrice) : '—'}</div>
        <div><span className="adm-detail-label">Status</span>{done ? 'Installed' : job.partnerId ? 'Installer assigned' : 'Awaiting installer'}</div>
      </div>
      {job.address && <div className="adm-detail-notes" style={{ marginTop: 4 }}><span className="adm-detail-label">Site address</span>{job.address}</div>}
      <div style={{ marginTop: 12 }}>
        <span className="adm-detail-label">Products (from the latest quotation)</span>
        <div style={{ marginTop: 4 }}>{job.items.length ? job.items.map((i, k) => <div key={k}>{i.name} × {i.qty}</div>) : <span className="adm-lead-sub">No itemised quotation on file</span>}</div>
      </div>
      {!done && (
        <InstallForm
          job={{ installDate: job.installDate, installFee: job.fee, partnerId: job.partnerId, city: job.city }}
          date={date} setDate={setDate} slot={slot} setSlot={setSlot} fee={fee} setFee={setFee}
          dirty={dirty} dateDirty={dateDirty} busy={busy} installer={installer}
          onSave={() => onSave(date, slot, fee)}
          onClear={() => { setDate(''); setSlot(''); onSave('', '', fee); }}
          onRelease={onRelease}
        />
      )}
      {done && job.installDate && <div className="adm-detail-notes" style={{ marginTop: 14 }}><span className="adm-detail-label">Installed on schedule</span>{fmtDate(job.installDate)}{job.installSlot ? ` · ${job.installSlot}` : ''}</div>}
      {!done && (
        <div className="lf-actions" style={{ marginTop: 18, flexWrap: 'wrap' }}>
          <button className="lf-btn-next" style={{ flex: '1 1 100%', whiteSpace: 'nowrap' }} disabled={busy} onClick={onComplete}>Mark Installation Done</button>
        </div>
      )}
    </Modal>
  );
}
