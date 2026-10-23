'use client';
// The "Courier shipment (Velocity)" block on an order — AWB, courier, status, tracking + label links, and the
// Create / Retry / Refresh / Cancel buttons. Shared by Admin -> Orders and the Operations panels (desktop and
// the Team app). `onAction(action)` is 'create' | 'sync' | 'cancel' and should resolve when the call is done;
// the parent is responsible for sending it to PATCH /api/admin/orders/<id> as { shipping: action }.
import { useState } from 'react';
import { velocityStatusLabel } from '@/lib/velocityStatusLabels';

export function canCreateShipment(order) {
  const sh = order?.shipping;
  return !!order && ['confirmed', 'packed', 'shipped'].includes(order.status) && (!sh?.shipmentId || sh.status === 'cancelled');
}

function CompactShipping({ order, sh, onAction }) {
  const [busy, setBusy] = useState(false);
  async function run(a) { setBusy(true); try { await onAction(a); } finally { setBusy(false); } }
  const line = { fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 8 };
  if (sh?.status === 'cancelled') {
    return (
      <div style={line}>
        <span>🚚 Shipment cancelled</span>
        <button type="button" className="hp-btn hp-btn-outline hp-btn-sm" disabled={busy} onClick={() => run('create')}>{busy ? 'Sending…' : 'Send again'}</button>
      </div>
    );
  }
  if (sh?.awb) {
    return (
      <div style={line}>
        <span>🚚 {sh.courier || 'Courier'} · {sh.awb} · {velocityStatusLabel(sh.status)}</span>
        {sh.trackingUrl && <a href={sh.trackingUrl} target="_blank" rel="noopener noreferrer">Track</a>}
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
  if (sh?.shipmentId) return <div style={line}><span>🚚 Waiting for a courier in Velocity</span></div>;
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
        <div>{sh?.shipmentId ? 'Sent to Velocity — Operations pick the courier there. The courier and tracking appear here once it is assigned.' : 'Not sent to Velocity yet. It is sent automatically when the order is marked Packed.'}</div>
      )}
      {sh?.cancelError && <div style={{ color: '#c0392b', fontWeight: 600 }}>⚠ Cancel failed: {sh.cancelError}</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
        {canShip && <button type="button" className={btn} disabled={busy} onClick={() => run('create')}>{busy ? 'Working…' : sh?.status === 'cancelled' ? 'Send to Velocity again' : sh?.error ? 'Retry' : 'Send to Velocity'}</button>}
        {sh?.awb && <button type="button" className={btn} disabled={busy} onClick={() => run('sync')}>Refresh tracking</button>}
        {canCancel && <button type="button" className={btn} disabled={busy} onClick={() => run('cancel')}>Cancel shipment</button>}
      </div>
    </div>
  );
}
