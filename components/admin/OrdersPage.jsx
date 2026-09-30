'use client';
// Admin -> Orders: fulfillment queue for WhatsApp Shopping orders (see
// lib/heseosShoppingFlow.js/lib/heseosOrders.js for how one of these gets created — a customer
// browsing the catalog-node flow on WhatsApp, building a cart, and checking out). Deliberately
// modeled on GrowthPage.jsx's tab-row pattern (status as tabs with live counts, not a dropdown)
// and LeadsPage.jsx's pagination — same "read first, match the house style" approach used
// everywhere else on this admin, not a bespoke layout.
import { useMemo, useState } from 'react';
import { StatCard, Modal, Pagination } from './ui';
import { IconSearch, IconOrders, IconLeads, IconConversions } from './icons';
import { useApiResource, invalidate } from '@/lib/useApiResource';

const ORDERS_URL = '/api/admin/orders';
const PAGE_SIZE = 10;

// Mirrors lib/heseosOrders.js's ORDER_STATUSES/ORDER_FORWARD_STATUSES — kept as a plain local
// copy rather than importing that server-only file into a 'use client' component (same reason
// every other admin page re-states its own small label maps instead of importing lib/*.js
// modules that pull in dbGetById/dbPatch).
const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'placed', label: 'Placed' },
  { key: 'packed', label: 'Packed' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
];
const FORWARD_STATUSES = ['placed', 'packed', 'shipped', 'delivered'];
const STATUS_LABEL = Object.fromEntries(STATUS_TABS.map((s) => [s.key, s.label]));

function money(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

function nextForwardStatus(status) {
  const i = FORWARD_STATUSES.indexOf(status);
  return i >= 0 && i < FORWARD_STATUSES.length - 1 ? FORWARD_STATUSES[i + 1] : null;
}

export default function OrdersPage() {
  const { data: orders, loading, refresh } = useApiResource(ORDERS_URL, { pollMs: 20000 });
  const [status, setStatus] = useState('placed');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null); // { type: 'view', order }
  const [notice, setNotice] = useState('');

  function flash(msg) { setNotice(msg); setTimeout(() => setNotice(''), 2500); }
  function load() { invalidate(ORDERS_URL); refresh(); }

  const counts = useMemo(() => {
    const c = { all: orders.length };
    for (const s of STATUS_TABS) if (s.key !== 'all') c[s.key] = 0;
    for (const o of orders) c[o.status] = (c[o.status] || 0) + 1;
    return c;
  }, [orders]);

  const pendingPaymentCount = useMemo(() => orders.filter((o) => o.paymentStatus !== 'paid' && o.status !== 'cancelled').length, [orders]);

  const filtered = useMemo(() => orders.filter((o) => {
    if (status !== 'all' && o.status !== status) return false;
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      if (!(`${o.id} ${o.customerName || ''} ${o.phone || ''}`.toLowerCase().includes(s))) return false;
    }
    return true;
  }), [orders, status, q]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function patchOrder(id, body) {
    const res = await fetch(`${ORDERS_URL}/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    load();
    return data;
  }

  async function advance(order) {
    const next = nextForwardStatus(order.status);
    if (!next) return;
    const updated = await patchOrder(order.id, { status: next });
    setModal({ type: 'view', order: updated });
    flash(`Order marked ${STATUS_LABEL[next]}`);
  }

  async function cancel(order) {
    if (!window.confirm(`Cancel order ${order.id}? This can't be undone.`)) return;
    const updated = await patchOrder(order.id, { status: 'cancelled' });
    setModal({ type: 'view', order: updated });
    flash('Order cancelled');
  }

  async function markPaid(order) {
    const updated = await patchOrder(order.id, { markPaid: true });
    setModal({ type: 'view', order: updated });
    flash('Marked as paid');
  }

  return (
    <>
      <div className="adm-page-head">
        <div><h1 className="adm-h1">Orders</h1><p className="adm-page-sub">Orders placed through WhatsApp Shopping — pack, dispatch and mark delivered from here</p></div>
      </div>

      {notice && <div className="adm-notice">{notice}</div>}

      <div className="adm-stat-row">
        <StatCard label="Total Orders" value={orders.length} Icon={IconOrders} tone="orange" />
        <StatCard label="Placed" value={counts.placed || 0} Icon={IconLeads} tone="purple" />
        <StatCard label="Pending Payment" value={pendingPaymentCount} Icon={IconOrders} tone="teal" />
        <StatCard label="Delivered" value={counts.delivered || 0} Icon={IconConversions} tone="green" />
      </div>

      <div className="adm-card">
        <div className="adm-toolbar">
          <div className="adm-search adm-search--inline"><IconSearch size={16} /><input placeholder="Search by order ID, customer name or phone…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
        </div>

        <div className="adm-tabs">
          {STATUS_TABS.map((s) => (
            <button key={s.key} type="button" className={`adm-tab${status === s.key ? ' active' : ''}`} onClick={() => { setStatus(s.key); setPage(1); }}>
              {s.label} <span className="adm-tab-count">{counts[s.key] || 0}</span>
            </button>
          ))}
        </div>

        <div className="adm-table-scroll">
          <table className="adm-table">
            <thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th><th>Placed On</th><th></th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={8} className="adm-empty">Loading…</td></tr> : pageRows.length === 0 ? <tr><td colSpan={8} className="adm-empty">No orders match these filters.</td></tr> : pageRows.map((o) => (
                <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => setModal({ type: 'view', order: o })}>
                  <td><code>{o.id}</code></td>
                  <td>
                    <div className="adm-lead-name">{o.customerName || '—'}</div>
                    <div className="adm-lead-sub">{o.phone}</div>
                  </td>
                  <td>{(o.items || []).reduce((n, it) => n + (Number(it.qty) || 0), 0)} item(s)</td>
                  <td>{money(o.subtotal)}</td>
                  <td><span className={`adm-status-pill${o.paymentStatus === 'paid' ? ' active' : ' pending'}`}>{o.paymentStatus === 'paid' ? 'Paid' : 'Pending'}</span></td>
                  <td><span className={`adm-status-pill${o.status === 'delivered' ? ' active' : o.status === 'cancelled' ? '' : ' pending'}`}>{STATUS_LABEL[o.status] || o.status}</span></td>
                  <td>{o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                  <td className="adm-row-actions"><button className="adm-chip-btn" onClick={(e) => { e.stopPropagation(); setModal({ type: 'view', order: o }); }}>View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination page={page} pageCount={pageCount} total={filtered.length} pageSize={PAGE_SIZE} onPage={setPage} />
      </div>

      {modal?.type === 'view' && (
        <OrderDetailModal
          order={modal.order}
          onClose={() => setModal(null)}
          onAdvance={() => advance(modal.order)}
          onCancel={() => cancel(modal.order)}
          onMarkPaid={() => markPaid(modal.order)}
        />
      )}
    </>
  );
}

function OrderDetailModal({ order, onClose, onAdvance, onCancel, onMarkPaid }) {
  const next = nextForwardStatus(order.status);
  const isOpen = order.status !== 'delivered' && order.status !== 'cancelled';
  return (
    <Modal title={`Order ${order.id}`} sub={`Placed ${order.createdAt ? new Date(order.createdAt).toLocaleString('en-IN') : '—'}`} onClose={onClose}>
      <div className="adm-detail-grid">
        <div><span className="adm-detail-label">Customer</span>{order.customerName || '—'}</div>
        <div><span className="adm-detail-label">Phone</span>{order.phone}</div>
        <div><span className="adm-detail-label">Status</span>{STATUS_LABEL[order.status] || order.status}</div>
        <div><span className="adm-detail-label">Payment</span>{order.paymentStatus === 'paid' ? `Paid${order.paidAt ? ` (${new Date(order.paidAt).toLocaleDateString('en-IN')})` : ''}` : 'Pending (Cash/UPI on delivery)'}</div>
      </div>
      <div className="adm-detail-notes" style={{ marginTop: 4 }}>
        <span className="adm-detail-label">Delivery Address</span>
        {order.deliveryAddress}
      </div>

      <div style={{ marginTop: 16 }}>
        <span className="adm-detail-label">Items</span>
        <table className="adm-table" style={{ marginTop: 6 }}>
          <thead><tr><th>Product</th><th>Qty</th><th>Price</th><th>Line Total</th></tr></thead>
          <tbody>
            {(order.items || []).map((it, i) => (
              <tr key={`${it.productId}_${i}`}>
                <td>{it.name}</td>
                <td>{it.qty}</td>
                <td>{money(it.price)}</td>
                <td>{money(it.lineTotal ?? it.price * it.qty)}</td>
              </tr>
            ))}
            <tr><td colSpan={3} style={{ textAlign: 'right', fontWeight: 700 }}>Total</td><td style={{ fontWeight: 700 }}>{money(order.subtotal)}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="lf-actions" style={{ marginTop: 18 }}>
        {order.paymentStatus !== 'paid' && order.status !== 'cancelled' && (
          <button className="adm-chip-btn" onClick={onMarkPaid}>Mark Paid</button>
        )}
        {isOpen && <button className="lf-btn-back" onClick={onCancel}>Cancel Order</button>}
        {isOpen && next && <button className="lf-btn-next" onClick={onAdvance}>Mark as {STATUS_LABEL[next]}</button>}
      </div>
    </Modal>
  );
}
