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
  async function saveSchedule(order, date, slot) {
    const r = await patch(order, { installation: { date, slot } });
    if (!r) return false;
    flash(date ? `Installation set for ${fmtDate(date)}${r.whatsappSent ? ' — customer notified on WhatsApp' : ' — saved (WhatsApp message could not be sent)'}` : 'Installation date cleared');
    return true;
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
          <h1 className="adm-h1">{section === 'orders' ? 'Orders' : 'Installations'}</h1>
          <p className="adm-page-sub">{section === 'orders'
            ? 'Confirmed orders through to installation — pack, dispatch, deliver, then call the customer and fix an installation date'
            : 'Installation dates agreed with customers, soonest first — and the orders still waiting for a date'}</p>
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
                    : pageRows.map((o) => <OrderRow key={o.id} o={o} busy={busy === o.id} onOpen={() => setModalId(o.id)} onAdvance={() => advance(o)} />)}
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

      {modalOrder && (
        <OrderModal
          key={modalOrder.id}
          order={modalOrder}
          busy={busy === modalOrder.id}
          onClose={() => setModalId(null)}
          onAdvance={() => advance(modalOrder)}
          onPaid={() => markPaid(modalOrder)}
          onCancel={() => cancel(modalOrder)}
          onSchedule={(d, s) => saveSchedule(modalOrder, d, s)}
          onNotes={(n) => saveNotes(modalOrder, n)}
        />
      )}
    </EmployeeShell>
  );
}

function OrderRow({ o, busy, onOpen, onAdvance }) {
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
      </td>
      <td className="adm-row-actions" style={{ whiteSpace: 'nowrap' }}>
        {st.next && <button className="adm-chip-btn" disabled={busy} onClick={(e) => { e.stopPropagation(); onAdvance(); }}>{st.action}</button>}{' '}
        <button className="adm-chip-btn" onClick={(e) => { e.stopPropagation(); onOpen(); }}>Manage</button>
      </td>
    </tr>
  );
}

function OrderModal({ order, busy, onClose, onAdvance, onPaid, onCancel, onSchedule, onNotes }) {
  const st = STAGE[order.status];
  const done = order.status === 'installed';
  const [date, setDate] = useState(order.installDate || '');
  const [slot, setSlot] = useState(order.installSlot || '');
  const [notes, setNotes] = useState(order.notes || '');
  const dateDirty = date !== (order.installDate || '') || slot !== (order.installSlot || '');
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

      {!done && (
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--adm-border)' }}>
          <span className="adm-detail-label">Installation date</span>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
            <input className="lf-input" type="date" min={todayStr()} value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 180 }} />
            <select className="lf-input" value={slot} onChange={(e) => setSlot(e.target.value)} style={{ width: 220 }}>
              <option value="">Any time (confirm on call)</option>
              {INSTALL_SLOTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button className="lf-btn-next" disabled={busy || !date || !dateDirty} onClick={() => onSchedule(date, slot)}>Save &amp; notify customer</button>
            {order.installDate && <button className="lf-btn-back" disabled={busy} onClick={() => { setDate(''); setSlot(''); onSchedule('', ''); }}>Clear</button>}
          </div>
          <p className="adm-lead-sub" style={{ marginTop: 6 }}>The customer is sent a WhatsApp message with this date as soon as you save.</p>
        </div>
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
