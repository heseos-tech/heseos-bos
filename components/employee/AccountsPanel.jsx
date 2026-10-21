'use client';
// Accounts desktop panel (/employee, role "accounts"): the money side of the business.
//   Orders  — every order with its payment status and full details; the ONE thing Accounts can do
//             to an order is mark it paid (the API enforces that too — app/api/admin/orders/[id]).
//   Payouts — the same partner / installer payout ledger Admin uses (components/admin/PayoutsPage.jsx):
//             record, settle and mark payouts paid. Tracking only — nothing here moves money.
// Same sidebar + admin.css look as the other employee panels (components/employee/ui.jsx).
import { useMemo, useState } from 'react';
import { EmployeeShell } from '@/components/employee/ui';
import PayoutsPage from '@/components/admin/PayoutsPage';
import { StatCard, Modal, Pagination } from '@/components/admin/ui';
import { IconOrders, IconPayouts, IconConversions, IconSearch, IconSettings, IconDownload } from '@/components/admin/icons';
import { useApiResource, invalidate } from '@/lib/useApiResource';

const ORDERS_URL = '/api/admin/orders';
const PAGE_SIZE = 10;
const NAV = [
  { key: 'orders', label: 'Orders', Icon: IconOrders },
  { key: 'payouts', label: 'Payouts', Icon: IconPayouts },
  { key: 'settings', label: 'Settings', Icon: IconSettings },
];
const STATUS_LABEL = { placed: 'Placed', confirmed: 'Confirmed', packed: 'Packed', shipped: 'Dispatched', delivered: 'Delivered', installed: 'Installation Done', cancelled: 'Cancelled' };
const TABS = [{ key: 'unpaid', label: 'Unpaid' }, { key: 'paid', label: 'Paid' }, { key: 'cancelled', label: 'Cancelled' }, { key: 'all', label: 'All' }];

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const isPaid = (o) => o.paymentStatus === 'paid';
const dateOf = (iso) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

export default function AccountsPanel({ employee }) {
  const [section, setSection] = useState('orders');
  return (
    <EmployeeShell employee={employee} section={section} onSection={setSection} navItems={NAV}>
      {section === 'orders' && <OrdersSection />}
      {section === 'payouts' && <PayoutsPage />}
      {section === 'settings' && <SettingsSection employee={employee} />}
    </EmployeeShell>
  );
}

function OrdersSection() {
  const { data: orders, loading, refresh } = useApiResource(ORDERS_URL, { pollMs: 20000 });
  const [tab, setTab] = useState('unpaid');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [modalId, setModalId] = useState(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const flash = (m) => { setNotice(m); setTimeout(() => setNotice(''), 4000); };
  const groupOf = (o) => (o.status === 'cancelled' ? 'cancelled' : isPaid(o) ? 'paid' : 'unpaid');

  const stats = useMemo(() => {
    const s = { unpaid: 0, unpaidAmt: 0, paid: 0, paidAmt: 0, cancelled: 0 };
    for (const o of orders) {
      const g = groupOf(o);
      if (g === 'unpaid') { s.unpaid += 1; s.unpaidAmt += Number(o.subtotal) || 0; }
      else if (g === 'paid') { s.paid += 1; s.paidAmt += Number(o.subtotal) || 0; }
      else s.cancelled += 1;
    }
    return s;
  }, [orders]);
  const counts = { unpaid: stats.unpaid, paid: stats.paid, cancelled: stats.cancelled, all: orders.length };

  const filtered = useMemo(() => orders.filter((o) => {
    if (tab !== 'all' && groupOf(o) !== tab) return false;
    const s = q.trim().toLowerCase();
    return !s || `${o.id} ${o.customerName || ''} ${o.phone || ''}`.toLowerCase().includes(s);
  }), [orders, tab, q]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const modalOrder = modalId ? orders.find((o) => o.id === modalId) : null;

  async function markPaid(order) {
    if (!window.confirm(`Mark order ${order.id} (${money(order.subtotal)}) as paid? This records that the payment was received.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`${ORDERS_URL}/${order.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ markPaid: true }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { flash(d.error || 'Could not mark paid'); return; }
      await invalidate(ORDERS_URL); refresh();
      flash(`Order ${order.id} marked as paid`);
    } finally { setBusy(false); }
  }

  return (
    <>
      <div className="adm-page-head">
        <div><h1 className="adm-h1">Orders</h1><p className="adm-page-sub">Every order with its payment status — open one for the full details and mark it paid once the money is received</p></div>
      </div>
      {notice && <div className="adm-notice">{notice}</div>}

      <div className="adm-stat-row">
        <StatCard label="Unpaid Orders" value={stats.unpaid} Icon={IconOrders} tone="orange" />
        <StatCard label="Amount To Collect" value={money(stats.unpaidAmt)} Icon={IconPayouts} tone="purple" />
        <StatCard label="Paid Orders" value={stats.paid} Icon={IconConversions} tone="green" />
        <StatCard label="Amount Collected" value={money(stats.paidAmt)} Icon={IconPayouts} tone="teal" />
      </div>

      <div className="adm-card">
        <div className="adm-toolbar">
          <div className="adm-search adm-search--inline"><IconSearch size={16} /><input placeholder="Search by order ID, customer name or phone…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
        </div>
        <div className="adm-tabs">
          {TABS.map((t) => (
            <button key={t.key} type="button" className={`adm-tab${tab === t.key ? ' active' : ''}`} onClick={() => { setTab(t.key); setPage(1); }}>
              {t.label} <span className="adm-tab-count">{counts[t.key] || 0}</span>
            </button>
          ))}
        </div>
        <div className="adm-table-scroll">
          <table className="adm-table">
            <thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th><th>Placed On</th><th></th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={8} className="adm-empty">Loading…</td></tr> : rows.length === 0 ? <tr><td colSpan={8} className="adm-empty">No orders here.</td></tr> : rows.map((o) => (
                <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => setModalId(o.id)}>
                  <td><code>{o.id}</code></td>
                  <td><div className="adm-lead-name">{o.customerName || '—'}</div><div className="adm-lead-sub">{o.phone}</div></td>
                  <td>{(o.items || []).reduce((n, it) => n + (Number(it.qty) || 0), 0)} item(s)</td>
                  <td>{money(o.subtotal)}</td>
                  <td><span className={`adm-status-pill${isPaid(o) ? ' active' : ' pending'}`}>{isPaid(o) ? 'Paid' : 'Pending'}</span></td>
                  <td><span className={`adm-status-pill${o.status === 'delivered' || o.status === 'installed' ? ' active' : o.status === 'cancelled' ? '' : ' pending'}`}>{STATUS_LABEL[o.status] || o.status}</span></td>
                  <td>{dateOf(o.createdAt)}</td>
                  <td className="adm-row-actions" onClick={(e) => e.stopPropagation()}>
                    <button className="adm-chip-btn" onClick={() => setModalId(o.id)}>View</button>
                    {!isPaid(o) && o.status !== 'cancelled' && <button className="adm-chip-btn" style={{ marginLeft: 6 }} disabled={busy} onClick={() => markPaid(o)}>Mark Paid</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageCount={pageCount} total={filtered.length} pageSize={PAGE_SIZE} onPage={setPage} />
      </div>

      {modalOrder && <OrderModal order={modalOrder} busy={busy} onClose={() => setModalId(null)} onMarkPaid={() => markPaid(modalOrder)} />}
    </>
  );
}

function OrderModal({ order, busy, onClose, onMarkPaid }) {
  const paid = isPaid(order);
  return (
    <Modal title={`Order ${order.id}`} sub={`Placed ${order.createdAt ? new Date(order.createdAt).toLocaleString('en-IN') : '—'}`} onClose={onClose}>
      <div className="adm-detail-grid">
        <div><span className="adm-detail-label">Customer</span>{order.customerName || '—'}</div>
        <div><span className="adm-detail-label">Phone</span>{order.phone}</div>
        <div><span className="adm-detail-label">Order status</span>{STATUS_LABEL[order.status] || order.status}</div>
        <div><span className="adm-detail-label">Payment</span>{paid ? `Paid${order.paidAt ? ` (${dateOf(order.paidAt)})` : ''}` : 'Pending (Cash/UPI on delivery)'}</div>
        <div><span className="adm-detail-label">Order total</span>{money(order.subtotal)}</div>
        {Number(order.installFee) > 0 && <div><span className="adm-detail-label">Installer fee</span>{money(order.installFee)}</div>}
      </div>
      <div className="adm-detail-notes" style={{ marginTop: 4 }}>
        <span className="adm-detail-label">Delivery Address</span>
        {order.deliveryAddress || '—'}{order.city ? `, ${order.city}` : ''}
      </div>
      <div style={{ marginTop: 16 }}>
        <span className="adm-detail-label">Items</span>
        <table className="adm-table" style={{ marginTop: 6 }}>
          <thead><tr><th>Product</th><th>Qty</th><th>Price</th><th>Line Total</th></tr></thead>
          <tbody>
            {(order.items || []).map((it, i) => (
              <tr key={`${it.productId}_${i}`}><td>{it.name}</td><td>{it.qty}</td><td>{money(it.price)}</td><td>{money(it.lineTotal ?? it.price * it.qty)}</td></tr>
            ))}
            <tr><td colSpan={3} style={{ textAlign: 'right', fontWeight: 700 }}>Total</td><td style={{ fontWeight: 700 }}>{money(order.subtotal)}</td></tr>
          </tbody>
        </table>
      </div>
      {(order.history || []).length > 0 && (
        <div style={{ marginTop: 16 }}>
          <span className="adm-detail-label">History</span>
          {[...order.history].reverse().slice(0, 12).map((h, i) => (
            <div key={i} className="adm-lead-sub" style={{ marginTop: 4 }}><strong>{h.status}</strong> · {h.at ? new Date(h.at).toLocaleString('en-IN') : ''}{h.by ? ` · ${h.by}` : ''}</div>
          ))}
        </div>
      )}
      <div className="lf-actions" style={{ marginTop: 18, flexWrap: 'wrap' }}>
        <a className="adm-btn-outline" style={{ whiteSpace: 'nowrap' }} href={`/api/admin/orders/${order.id}/pdf?type=invoice`}><IconDownload size={15} /> Invoice</a>
        <button className="lf-btn-back" onClick={onClose}>Close</button>
        {!paid && order.status !== 'cancelled' && <button className="lf-btn-next" onClick={onMarkPaid} disabled={busy}>{busy ? 'Saving…' : 'Mark as Paid'}</button>}
      </div>
    </Modal>
  );
}

function SettingsSection({ employee }) {
  return (
    <>
      <div className="adm-page-head"><div><h1 className="adm-h1">Settings</h1><p className="adm-page-sub">Your account details</p></div></div>
      <div className="adm-card" style={{ maxWidth: 480 }}>
        <div className="adm-card-title">Profile</div>
        <div className="adm-card-sub">Contact an admin to change any of this, including your password.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><div className="adm-stat-label">Name</div><div style={{ fontSize: 14, fontWeight: 600 }}>{employee.name || '—'}</div></div>
          <div><div className="adm-stat-label">Email</div><div style={{ fontSize: 14, fontWeight: 600 }}>{employee.email || '—'}</div></div>
          {employee.phone && <div><div className="adm-stat-label">Phone</div><div style={{ fontSize: 14, fontWeight: 600 }}>{employee.phone}</div></div>}
          <div><div className="adm-stat-label">Role</div><div style={{ fontSize: 14, fontWeight: 600 }}>Accounts</div></div>
        </div>
      </div>
    </>
  );
}
