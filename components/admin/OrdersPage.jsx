'use client';
// Admin -> Orders: fulfillment queue for orders placed on the door-lock landing page (see
// lib/heseosDoorLock.js/lib/heseosOrders.js — a customer messages on WhatsApp, gets the page link,
// and orders there). Deliberately
// modeled on GrowthPage.jsx's tab-row pattern (status as tabs with live counts, not a dropdown)
// and LeadsPage.jsx's pagination — same "read first, match the house style" approach used
// everywhere else on this admin, not a bespoke layout.
import { useMemo, useState } from 'react';
import { StatCard, Modal, Pagination } from './ui';
import { IconSearch, IconOrders, IconLeads, IconConversions, IconDownload } from './icons';
import { useApiResource, invalidate } from '@/lib/useApiResource';
import ShippingSection from './ShippingSection';
import OrderEditForm, { canEditOrder, submitOrderEdit } from './OrderEditForm';

const ORDERS_URL = '/api/admin/orders';
const PAGE_SIZE = 10;

// Mirrors lib/heseosOrders.js's ORDER_STATUSES/ORDER_FORWARD_STATUSES — kept as a plain local
// copy rather than importing that server-only file into a 'use client' component (same reason
// every other admin page re-states its own small label maps instead of importing lib/*.js
// modules that pull in dbGetById/dbPatch).
const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'placed', label: 'Placed' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'packed', label: 'Packed' },
  { key: 'shipped', label: 'Dispatched' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'installed', label: 'Installation Done' },
  { key: 'cancelled', label: 'Cancelled' },
];
const FORWARD_STATUSES = ['placed', 'confirmed', 'packed', 'shipped', 'delivered', 'installed'];
// A cancel only makes sense until the goods are with the customer.
const CANCELLABLE = new Set(['placed', 'confirmed', 'packed', 'shipped']);
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
  const { data: partners } = useApiResource('/api/admin/partners', { pollMs: 60000 });
  const [status, setStatus] = useState('placed');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null); // { type: 'view', order }
  const [notice, setNotice] = useState('');

  function flash(msg) { setNotice(msg); setTimeout(() => setNotice(''), 4000); }
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
    flash(`Order marked ${STATUS_LABEL[next]}${updated.whatsappSent ? ' — customer notified on WhatsApp' : ' — WhatsApp message could not be sent'}`);
  }

  async function cancel(order) {
    if (!window.confirm(`Cancel order ${order.id}? This can't be undone.`)) return;
    const updated = await patchOrder(order.id, { status: 'cancelled' });
    setModal({ type: 'view', order: updated });
    flash(`Order cancelled${updated.whatsappSent ? ' — customer notified on WhatsApp' : ' — WhatsApp message could not be sent'}`);
  }

  // Velocity courier shipment: 'create' (also the retry), 'sync' (refresh tracking), 'cancel'.
  async function shippingAction(order, action) {
    if (action === 'cancel' && !window.confirm(`Cancel the courier shipment for ${order.id}? This only works before the courier has picked it up.`)) return;
    const updated = await patchOrder(order.id, { shipping: action });
    setModal({ type: 'view', order: updated });
    if (updated.shippingError) flash(`Velocity: ${updated.shippingError}`);
    else flash((action === 'create' || action === 'resend') ? 'Sent to Velocity — pick the courier there' : action === 'sync' ? 'Tracking refreshed' : 'Cancellation requested');
  }

  // Edit customer details / address / items. -> '' on success, else the error text for the form.
  async function saveEdit(order, payload) {
    const r = await submitOrderEdit(order.id, payload);
    if (!r.ok) return r.error;
    load();
    setModal({ type: 'view', order: r.order });
    flash(r.order.shippingStale ? 'Order updated — the courier still has the old details: cancel in Velocity, then send again' : 'Order updated');
    return '';
  }

  async function markPaid(order) {
    const updated = await patchOrder(order.id, { markPaid: true });
    setModal({ type: 'view', order: updated });
    flash('Marked as paid');
  }

  return (
    <>
      <div className="adm-page-head">
        <div><h1 className="adm-h1">Orders</h1><p className="adm-page-sub">Orders placed on the door-lock landing page — pack, dispatch, deliver and mark installation done from here — the customer is updated on WhatsApp at each step</p></div>
      </div>

      {notice && <div className="adm-notice">{notice}</div>}

      <div className="adm-stat-row">
        <StatCard label="Total Orders" value={orders.length} Icon={IconOrders} tone="orange" />
        <StatCard label="Placed" value={counts.placed || 0} Icon={IconLeads} tone="purple" />
        <StatCard label="Pending Payment" value={pendingPaymentCount} Icon={IconOrders} tone="teal" />
        <StatCard label="Delivered" value={(counts.delivered || 0) + (counts.installed || 0)} Icon={IconConversions} tone="green" />
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
                  <td><span className={`adm-status-pill${o.status === 'delivered' || o.status === 'installed' ? ' active' : o.status === 'cancelled' ? '' : ' pending'}`}>{STATUS_LABEL[o.status] || o.status}</span></td>
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
          installer={partners.find((p) => p.id === modal.order.installPartnerId)}
          onClose={() => setModal(null)}
          onAdvance={() => advance(modal.order)}
          onShipping={(a) => shippingAction(modal.order, a)}
          onEdit={(p) => saveEdit(modal.order, p)}
          onCancel={() => cancel(modal.order)}
          onMarkPaid={() => markPaid(modal.order)}
        />
      )}
    </>
  );
}

function OrderDetailModal({ order, installer, onClose, onAdvance, onCancel, onMarkPaid, onShipping, onEdit }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editErr, setEditErr] = useState('');
  if (editing) {
    return (
      <Modal title={`Edit order ${order.id}`} sub="Changes are saved in the order history" onClose={() => setEditing(false)}>
        <OrderEditForm
          order={order}
          saving={saving}
          error={editErr}
          onCancel={() => setEditing(false)}
          onSave={async (p) => { setSaving(true); setEditErr(''); const e = await onEdit(p); setSaving(false); if (e) setEditErr(e); else setEditing(false); }}
        />
      </Modal>
    );
  }
  const next = nextForwardStatus(order.status);
  const canCancel = CANCELLABLE.has(order.status);
  return (
    <Modal title={`Order ${order.id}`} sub={`Placed ${order.createdAt ? new Date(order.createdAt).toLocaleString('en-IN') : '—'}`} onClose={onClose}>
      <div className="adm-detail-grid">
        <div><span className="adm-detail-label">Customer</span>{order.customerName || '—'}</div>
        <div><span className="adm-detail-label">Phone</span>{order.phone}</div>
        <div><span className="adm-detail-label">Status</span>{STATUS_LABEL[order.status] || order.status}</div>
        <div><span className="adm-detail-label">Payment</span>{order.paymentStatus === 'paid' ? `Paid${order.paidAt ? ` (${new Date(order.paidAt).toLocaleDateString('en-IN')})` : ''}` : 'Pending (Cash/UPI on delivery)'}</div>
      </div>
      {order.installDate && (
        <div className="adm-detail-notes" style={{ marginTop: 4 }}>
          <span className="adm-detail-label">Installation</span>
          {new Date(`${order.installDate}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}
          {order.installSlot ? ` · ${order.installSlot}` : ''}
          {Number(order.installFee) > 0 ? ` · installer fee ${money(order.installFee)}` : ''}
          {order.installPartnerId ? ` · installer: ${installer?.name || 'assigned'}${installer?.phone ? ` (${installer.phone})` : ''}` : ''}
        </div>
      )}
      {order.notes ? (
        <div className="adm-detail-notes" style={{ marginTop: 4 }}>
          <span className="adm-detail-label">Team note</span>
          {order.notes}
        </div>
      ) : null}
      <div className="adm-detail-notes" style={{ marginTop: 4 }}>
        <span className="adm-detail-label">Delivery Address</span>
        {order.deliveryAddress}
      </div>

      <ShippingSection order={order} onAction={onShipping} />

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

      {/* Wraps onto two rows: the secondary actions on the first, the (longer-labelled) next-step
          button full-width underneath, so "Mark as Installation Done" never gets squashed. */}
      <div className="lf-actions" style={{ marginTop: 18, flexWrap: 'wrap' }}>
        <a className="adm-btn-outline" style={{ whiteSpace: 'nowrap' }} href={`/api/admin/orders/${order.id}/pdf?type=slip`}><IconDownload size={15} /> Generate Slip</a>
        <a className="adm-btn-outline" style={{ whiteSpace: 'nowrap' }} href={`/api/admin/orders/${order.id}/pdf?type=invoice`}><IconDownload size={15} /> Generate Invoice</a>
        {canEditOrder(order) && <button className="adm-chip-btn" style={{ whiteSpace: 'nowrap' }} onClick={() => setEditing(true)}>Edit Order</button>}
        {order.paymentStatus !== 'paid' && order.status !== 'cancelled' && (
          <button className="adm-chip-btn" style={{ whiteSpace: 'nowrap' }} onClick={onMarkPaid}>Mark Paid</button>
        )}
        {canCancel && <button className="lf-btn-back" style={{ whiteSpace: 'nowrap' }} onClick={onCancel}>Cancel Order</button>}
        {next && order.status !== 'cancelled' && (
          <button className="lf-btn-next" style={{ flex: '1 1 100%', whiteSpace: 'nowrap' }} onClick={onAdvance}>Mark as {STATUS_LABEL[next]}</button>
        )}
      </div>
      {next && order.status !== 'cancelled' && (
        <p className="adm-lead-sub" style={{ marginTop: 8 }}>The customer gets a WhatsApp update when you move this order forward.</p>
      )}
    </Modal>
  );
}
