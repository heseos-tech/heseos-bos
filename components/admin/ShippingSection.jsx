'use client';
// The "Courier shipment (Velocity)" block on an order — AWB, courier, status, tracking + label links, and the
// Create / Retry / Refresh / Cancel buttons. Shared by Admin -> Orders and the Operations panels (desktop and
// the Team app). `onAction(action)` is 'create' | 'sync' | 'cancel' and should resolve when the call is done;
// the parent is responsible for sending it to PATCH /api/admin/orders/<id> as { shipping: action }.
import { useState } from 'react';
import { velocityStatusLabel } from '@/lib/velocityStatusLabels';

export function canCreateShipment(order) {
  return !!order && ['confirmed', 'packed', 'shipped'].includes(order.status) && !order.shipping?.awb;
}

export default function ShippingSection({ order, onAction, compact = false }) {
  const [busy, setBusy] = useState(false);
  const sh = order.shipping || null;
  const canShip = canCreateShipment(order);
  if (!sh && !canShip) return null;
  async function run(a) { setBusy(true); try { await onAction(a); } finally { setBusy(false); } }
  const canCancel = sh?.awb && !['delivered', 'installed'].includes(order.status) && !['cancelled', 'cancel_requested'].includes(sh.status);
  const btn = compact ? 'hp-btn hp-btn-outline hp-btn-sm' : 'adm-chip-btn';
  return (
    <div className={compact ? 'ops-note' : 'adm-detail-notes'} style={{ marginTop: 10, display: 'block' }}>
      <span className={compact ? '' : 'adm-detail-label'} style={compact ? { display: 'block', fontWeight: 700, marginBottom: 4 } : undefined}>Courier shipment (Velocity)</span>
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
        <div>{sh?.shipmentId ? 'Order created in Velocity — waiting for a courier.' : 'Not sent to Velocity yet. It is sent automatically when the order is marked Packed.'}</div>
      )}
      {sh?.cancelError && <div style={{ color: '#c0392b', fontWeight: 600 }}>⚠ Cancel failed: {sh.cancelError}</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
        {canShip && <button type="button" className={btn} disabled={busy} onClick={() => run('create')}>{busy ? 'Working…' : sh?.error || sh?.shipmentId ? 'Retry shipment' : 'Create shipment'}</button>}
        {sh?.awb && <button type="button" className={btn} disabled={busy} onClick={() => run('sync')}>Refresh tracking</button>}
        {canCancel && <button type="button" className={btn} disabled={busy} onClick={() => run('cancel')}>Cancel shipment</button>}
      </div>
    </div>
  );
}
