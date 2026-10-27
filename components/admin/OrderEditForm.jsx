'use client';
// "Edit order" form for Operations / Admin — customer name + phone, delivery address + pincode (city and
// state always come from the pincode, never typed), and the order lines (quantity, unit price, remove /
// add a line), with the order total recalculated live. Shared by the three order screens:
//   variant 'adm' — Admin -> Orders and the Operations desktop panel (lf-* / adm-* styles)
//   variant 'hp'  — the Team app bottom sheet (hp-* styles)
// The parent sends the result to PATCH /api/admin/orders/<id> as { edit: {...} }; the server
// (lib/heseosOrders.js editOrder) re-validates everything and re-looks-up the pincode.
import { useState } from 'react';
import { usePincodeLookup } from '@/components/partner/PincodeField';

// Delivered / installed / cancelled orders are closed — nothing left to correct.
export function canEditOrder(order) {
  return !!order && !['cancelled', 'delivered', 'installed'].includes(order.status);
}

// PATCH the edit; -> { ok, order, error }. Callers refresh their own order list afterwards.
export async function submitOrderEdit(orderId, payload) {
  try {
    const res = await fetch(`/api/admin/orders/${orderId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ edit: payload }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error || 'Could not save — try again' };
    return { ok: true, order: data };
  } catch {
    return { ok: false, error: 'Network problem — try again' };
  }
}

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const tenDigits = (p) => String(p || '').replace(/\D/g, '').slice(-10);

function Field({ hp, label, children, hint }) {
  return hp ? (
    <div className="hp-field"><label className="hp-field-label">{label}</label>{children}{hint ? <div className="hp-hint">{hint}</div> : null}</div>
  ) : (
    <div style={{ marginTop: 10 }}><span className="adm-detail-label">{label}</span><div style={{ marginTop: 4 }}>{children}</div>{hint ? <p className="adm-lead-sub" style={{ marginTop: 4 }}>{hint}</p> : null}</div>
  );
}

export default function OrderEditForm({ order, variant = 'adm', saving = false, error = '', onCancel, onSave }) {
  const hp = variant === 'hp';
  const paid = order.paymentStatus === 'paid';
  const sh = order.shipping;
  const liveShipment = !!(sh?.shipmentId && sh.status !== 'cancelled');

  const [name, setName] = useState(order.customerName || '');
  const [phone, setPhone] = useState(tenDigits(order.phone));
  const [address, setAddress] = useState(order.deliveryAddress || '');
  const [pincode, setPincode] = useState(order.pincode || '');
  const [items, setItems] = useState(() => (order.items || []).map((it, i) => ({
    key: `i${i}`, productId: it.productId || '', name: it.name || '', qty: String(it.qty ?? 1), price: String(it.price ?? 0), custom: false,
  })));
  const [localError, setLocalError] = useState('');
  const lookup = usePincodeLookup(pincode);
  const pincodeChanged = String(pincode) !== String(order.pincode || '');

  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const total = items.reduce((s, it) => s + Math.round(num(it.qty)) * num(it.price), 0);
  const setItem = (key, patch) => setItems((arr) => arr.map((it) => (it.key === key ? { ...it, ...patch } : it)));

  function submit() {
    setLocalError('');
    if (!name.trim()) return setLocalError('Enter the customer name');
    if (!/^[6-9]\d{9}$/.test(phone)) return setLocalError('Enter a valid 10-digit mobile number');
    if (!address.trim()) return setLocalError('Enter the delivery address');
    if (!/^\d{6}$/.test(pincode)) return setLocalError('Enter a valid 6-digit pincode');
    if (pincodeChanged && lookup.status !== 'ok') return setLocalError(lookup.status === 'loading' ? 'Checking the pincode — try again in a moment' : 'This pincode could not be matched to a city');
    if (!items.length) return setLocalError('An order needs at least one item');
    for (const it of items) {
      if (!it.name.trim()) return setLocalError('Give every added item a name');
      if (!(Math.round(num(it.qty)) >= 1)) return setLocalError('Quantity must be at least 1');
      if (!(num(it.price) >= 0) || it.price === '') return setLocalError('Enter a valid price for every item');
    }
    onSave({
      customerName: name.trim(),
      phone,
      deliveryAddress: address.trim(),
      pincode,
      ...(paid ? {} : { items: items.map((it) => ({ productId: it.productId, name: it.name.trim(), qty: Math.round(num(it.qty)), price: num(it.price) })) }),
    });
  }

  // ── tiny style switch between the desktop and Team-app design systems (plain functions, not components,
  //    so typing never remounts an input) ──
  const input = (props) => hp
    ? <div className="hp-input-wrap"><input className="hp-input" {...props} /></div>
    : <input className="lf-input" style={{ width: '100%', ...(props.style || {}) }} {...props} />;
  const cellInput = (props) => hp
    ? <div className="hp-input-wrap"><input className="hp-input" {...props} /></div>
    : <input className="lf-input" style={{ width: '100%' }} {...props} />;

  const err = localError || error;

  return (
    <div>
      {liveShipment && (
        <p className="adm-lead-sub hp-hint" style={{ color: '#9a4a00', fontWeight: 600, marginTop: 8 }}>
          This order is already in Velocity. Changes made here don’t reach Velocity — after saving, cancel the shipment in the Velocity panel and use “Cancelled in Velocity? Send again”.
        </p>
      )}
      {order.invoiceNo && (
        <p className="adm-lead-sub hp-hint" style={{ marginTop: 8 }}>Invoice no. {order.invoiceNo} was already generated — re-downloading it will show the updated details.</p>
      )}

      <Field hp={hp} label="Customer name">{input({ value: name, onChange: (e) => setName(e.target.value), maxLength: 80 })}</Field>
      <Field hp={hp} label="Mobile number" hint="Order updates on WhatsApp go to this number.">
        {input({ value: phone, onChange: (e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10)), inputMode: 'numeric', maxLength: 10 })}
      </Field>
      <Field hp={hp} label="Delivery address">
        {hp
          ? <div className="hp-textarea-wrap"><textarea className="hp-textarea" rows={3} maxLength={400} value={address} onChange={(e) => setAddress(e.target.value)} /></div>
          : <textarea className="lf-input" rows={3} maxLength={400} style={{ width: '100%', resize: 'vertical' }} value={address} onChange={(e) => setAddress(e.target.value)} />}
      </Field>
      <Field
        hp={hp}
        label="Pincode"
        hint={lookup.status === 'loading' ? 'Checking pincode…' : lookup.status === 'ok' ? `${[lookup.city, lookup.state].filter(Boolean).join(', ')}${pincodeChanged ? ' — city and state will update' : ''}` : lookup.status === 'error' ? lookup.message : 'City and state are filled in from the pincode.'}
      >
        {input({ value: pincode, onChange: (e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6)), inputMode: 'numeric', maxLength: 6 })}
      </Field>

      <div style={{ marginTop: 14 }}>
        <span className={hp ? 'hp-field-label' : 'adm-detail-label'}>Items</span>
        {paid && <p className="adm-lead-sub hp-hint" style={{ marginTop: 4 }}>Payment has been received, so items and prices are locked.</p>}
        {items.map((it) => (
          <div key={it.key} style={{ marginTop: 8, padding: 10, border: '1px solid var(--adm-border, rgba(128,128,128,.25))', borderRadius: 10 }}>
            {it.custom ? cellInput({ placeholder: 'Item name', value: it.name, onChange: (e) => setItem(it.key, { name: e.target.value }), maxLength: 120 }) : <div style={{ fontWeight: 600 }}>{it.name}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <div className="adm-lead-sub hp-hint">Qty</div>
                {cellInput({ type: 'number', min: 1, step: 1, inputMode: 'numeric', value: it.qty, disabled: paid, onChange: (e) => setItem(it.key, { qty: e.target.value }) })}
              </div>
              <div style={{ flex: 1.4 }}>
                <div className="adm-lead-sub hp-hint">Price each (₹)</div>
                {cellInput({ type: 'number', min: 0, step: '0.01', inputMode: 'decimal', value: it.price, disabled: paid, onChange: (e) => setItem(it.key, { price: e.target.value }) })}
              </div>
              <div style={{ flex: 1, textAlign: 'right', fontWeight: 700, paddingBottom: 10, whiteSpace: 'nowrap' }}>{money(Math.round(num(it.qty)) * num(it.price))}</div>
              {!paid && items.length > 1 && (
                <button type="button" className={hp ? 'hp-btn hp-btn-outline hp-btn-sm' : 'adm-chip-btn'} onClick={() => setItems((a) => a.filter((x) => x.key !== it.key))} aria-label="Remove item">✕</button>
              )}
            </div>
          </div>
        ))}
        {!paid && (
          <button type="button" className={hp ? 'hp-btn hp-btn-outline hp-btn-sm' : 'adm-chip-btn'} style={{ marginTop: 8 }}
            onClick={() => setItems((a) => [...a, { key: `n${Date.now()}`, productId: '', name: '', qty: '1', price: '0', custom: true }])}>+ Add item</button>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontWeight: 700 }}>
          <span>Order total</span>
          <span>{money(paid ? order.subtotal : total)}{!paid && Math.round(total * 100) !== Math.round(num(order.subtotal) * 100) ? <span className="adm-lead-sub hp-hint" style={{ fontWeight: 400 }}> (was {money(order.subtotal)})</span> : null}</span>
        </div>
      </div>

      {err && <p style={{ color: '#c0392b', fontWeight: 600, marginTop: 10 }}>{err}</p>}

      <div className={hp ? 'hp-sheet-actions' : 'lf-actions'} style={hp ? undefined : { marginTop: 16 }}>
        <button type="button" className={hp ? 'hp-btn hp-btn-outline' : 'lf-btn-back'} style={hp ? { flex: 1 } : undefined} disabled={saving} onClick={onCancel}>Cancel</button>
        <button type="button" className={hp ? 'hp-btn hp-btn-primary' : 'lf-btn-next'} style={hp ? { flex: 1.4 } : undefined} disabled={saving} onClick={submit}>{saving ? 'Saving…' : 'Save changes'}</button>
      </div>
    </div>
  );
}
