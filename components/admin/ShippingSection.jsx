'use client';
// The "Courier shipment (Velocity)" block on an order — AWB, courier, status, tracking + label links, and the
// Create / Retry / Refresh / Cancel buttons. Shared by Admin -> Orders and the Operations panels (desktop and
// the Team app). `onAction(action)` is 'create' | 'resend' | 'sync' | 'cancel' and should resolve when the call is done;
// the parent is responsible for sending it to PATCH /api/admin/orders/<id> as { shipping: action }.
import { useState } from 'react';
import { velocityStatusLabel, velocityBeforePickup, velocityShipmentEnded } from '@/lib/velocityStatusLabels';

const RESEND_WARNING = 'Only do this if you have ALREADY cancelled this shipment in the Velocity panel — otherwise Velocity will end up with two shipments for one order.\n\nSend it to Velocity again?';

// Sent to Velocity, courier has not collected it yet (and it is not already marked cancelled, which has its own button).
export function canResendShipment(order) {
  const sh = order?.shipping;
  return canCreateShipment(order) && !!sh?.shipmentId && !velocityShipmentEnded(sh.status) && velocityBeforePickup(sh.status);
}

export function canCreateShipment(order) {
  const sh = order?.shipping;
  return !!order && ['confirmed', 'packed', 'shipped'].includes(order.status) && (!sh?.shipmentId || velocityShipmentEnded(sh.status));
}

function CompactShipping({ order, sh, onAction }) {
  const [busy, setBusy] = useState(false);
  async function run(a) { setBusy(true); try { await onAction(a); } finally { setBusy(false); } }
  const line = { fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 8 };
  if (velocityShipmentEnded(sh?.status)) {
    return (
      <div style={line}>
        <span>🚚 {sh.status === 'rejected' ? 'Rejected by Velocity' : 'Shipment cancelled'}</span>
        <button type="button" className="hp-btn hp-btn-outline hp-btn-sm" disabled={busy} onClick={() => run('create')}>{busy ? 'Sending…' : 'Send again'}</button>
      </div>
    );
  }
  const stale = sh?.stale && !velocityShipmentEnded(sh.status) ? <div className="adm-lead-sub" style={{ color: '#9a4a00', fontWeight: 600, width: '100%' }}>⚠ Order edited after it went to Velocity — cancel it in Velocity and send again.</div> : null;
  const resend = canResendShipment(order) ? (
    <button type="button" className="hp-btn hp-btn-outline hp-btn-sm" disabled={busy} onClick={() => { if (window.confirm(RESEND_WARNING)) run('resend'); }}>{busy ? 'Sending…' : 'Cancelled in Velocity? Send again'}</button>
  ) : null;
  if (sh?.awb) {
    return (
      <div style={line}>
        <span>🚚 {sh.courier || 'Courier'} · {sh.awb} · {velocityStatusLabel(sh.status)}</span>
        {sh.trackingUrl && <a href={sh.trackingUrl} target="_blank" rel="noopener noreferrer">Track</a>}
        {resend}
        {stale}
      </div>
    );
  }
  if (order.status === 'cancelled') return null;
  if (sh?.error) {
    return (
      <div style={line}>
        <span style={{ color: '#c0392b', fontWeight: 600 }}>⚠ Courier not booked</span>
        <button type="button" className="hp-btn hp-btn-outline hp-btn-sm" disabled={busy} onClick={() => run('create')}>{busy ? 'Trying…' : 'Retry'}</button>
      </div>
    );
  }
  if (sh?.shipmentId) return <div style={line}><span>🚚 Waiting for a courier in Velocity</span>{resend}{stale}</div>;
  if (order.status === 'packed') {
    return (
      <div style={line}>
        <span>🚚 Not sent to Velocity yet</span>
        <button type="button" className="hp-btn hp-btn-outline hp-btn-sm" disabled={busy} onClick={() => run('create')}>{busy ? 'Sending…' : 'Send'}</button>
      </div>
    );
  }
  return null;
}

export default function ShippingSection({ order, onAction, compact = false }) {
  const [busy, setBusy] = useState(false);
  const sh = order.shipping || null;
  const canShip = canCreateShipment(order);
  if (!sh && !canShip) return null;
  // Team-app (phone) version: one quiet line, no detail. Everything else lives on the desktop panels.
  if (compact) return <CompactShipping order={order} sh={sh} onAction={onAction} />;
  async function run(a) { setBusy(true); try { await onAction(a); } finally { setBusy(false); } }
  const canCancel = sh?.awb && !['delivered', 'installed'].includes(order.status) && !['cancelled', 'cancel_requested'].includes(sh.status);
  const btn = 'adm-chip-btn';
  return (
    <div className="adm-detail-notes" style={{ marginTop: 10 }}>
      <span className="adm-detail-label">Courier shipment (Velocity)</span>
      {sh?.awb ? (
        <div style={{ lineHeight: 1.7 }}>
          <div><strong>{sh.courier || 'Courier'}</strong> · AWB {sh.awb}</div>
          <div>Status: {velocityStatusLabel(sh.status)}</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {sh.trackingUrl && <a href={sh.trackingUrl} target="_blank" rel="noopener noreferrer">Track shipment</a>}
            {sh.labelUrl && <a href={sh.labelUrl} target="_blank" rel="noopener noreferrer">Download shipping label</a>}
          </div>
        </div>
      ) : sh?.error ? (
        <div style={{ color: '#c0392b', fontWeight: 600 }}>⚠ {sh.error}</div>
      ) : (
        <div>{velocityShipmentEnded(sh?.status) ? `${sh.status === 'rejected' ? 'Velocity rejected this shipment' : 'This shipment was cancelled in Velocity'} — use “Send to Velocity again” to book it afresh.` : sh?.shipmentId ? 'Sent to Velocity — Operations pick the courier there. The courier and tracking appear here once it is assigned.' : 'Not sent to Velocity yet. It is sent automatically when the order is marked Packed.'}</div>
      )}
      {sh?.stale && !velocityShipmentEnded(sh.status) && <div style={{ color: '#9a4a00', fontWeight: 600, marginTop: 4 }}>⚠ This order was edited after it was sent to Velocity, so the courier has the old details (items, amount to collect, address). Cancel it in the Velocity panel, then use “Cancelled in Velocity? Send again”.</div>}
      {sh?.cancelError && <div style={{ color: '#c0392b', fontWeight: 600 }}>⚠ Cancel failed: {sh.cancelError}</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
        {canShip && <button type="button" className={btn} disabled={busy} onClick={() => run('create')}>{busy ? 'Working…' : velocityShipmentEnded(sh?.status) ? 'Send to Velocity again' : sh?.error ? 'Retry' : 'Send to Velocity'}</button>}
        {sh?.awb && <button type="button" className={btn} disabled={busy} onClick={() => run('sync')}>Refresh tracking</button>}
        {canCancel && <button type="button" className={btn} disabled={busy} onClick={() => run('cancel')}>Cancel shipment</button>}
        {canResendShipment(order) && <button type="button" className={btn} disabled={busy} onClick={() => { if (window.confirm(RESEND_WARNING)) run('resend'); }}>Cancelled in Velocity? Send again</button>}
      </div>
    </div>
  );
}
