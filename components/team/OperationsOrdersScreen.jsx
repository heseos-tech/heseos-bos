'use client';
// Team app -> Orders (Operations). Every order from Confirmed onward, split into the stages
// operations works through: pack -> dispatch -> deliver -> install. Operations phones the
// customer, agrees an installation date and records it here (the customer then gets a WhatsApp
// confirmation — see notifyHeseosInstallationScheduled in lib/heseosNotify.js).
//
// Talks to the same endpoints as Admin -> Orders (/api/admin/orders, /api/admin/orders/[id]),
// which any logged-in employee may use; cancelling is the one thing the API reserves for admins.
import { useMemo, useState } from 'react';
import { ScreenHeader } from '@/components/partner/ui';
import Portal from '@/components/shared/Portal';
import { IconSearch, IconPhone, IconWhatsApp, IconOrders, IconX, IconDownload } from '@/components/admin/icons';
import { IconNote, IconCalendar } from '@/components/partner/icons';
import { useApiResource, invalidate } from '@/lib/useApiResource';

const ORDERS_URL = '/api/admin/orders';

// Plain local copies of lib/heseosOrders.js constants (server file — see OrdersPage.jsx).
const INSTALL_SLOTS = ['Morning (9 am – 12 pm)', 'Afternoon (12 – 4 pm)', 'Evening (4 – 7 pm)'];
const STAGES = [
  { key: 'confirmed', tab: 'To pack', label: 'Confirmed', next: 'packed', action: 'Mark Packed' },
  { key: 'packed', tab: 'Packed', label: 'Packed', next: 'shipped', action: 'Mark Dispatched' },
  { key: 'shipped', tab: 'Dispatched', label: 'Dispatched', next: 'delivered', action: 'Mark Delivered' },
  { key: 'delivered', tab: 'To install', label: 'Delivered', next: 'installed', action: 'Mark Installed' },
  { key: 'installed', tab: 'Installed', label: 'Installed', next: null, action: null },
];
// Cancel only until the goods are with the customer (same rule as Admin -> Orders).
const CANCELLABLE = new Set(['confirmed', 'packed', 'shipped']);
const STAGE = Object.fromEntries(STAGES.map((s) => [s.key, s]));
const BADGE_COLOR = {
  confirmed: ['#7fc4ff', 'var(--hp-info-dim)'],
  packed: ['var(--hp-warn)', 'var(--hp-warn-dim)'],
  shipped: ['#4fd1ff', 'var(--hp-info-dim)'],
  delivered: ['var(--hp-orange)', 'var(--hp-orange-dim)'],
  installed: ['var(--hp-success)', 'var(--hp-success-dim)'],
};

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const digits = (p) => String(p || '').replace(/\D/g, '');
function telHref(p) { const d = digits(p); return `tel:${d.length === 10 ? '+91' : '+'}${d}`; }
function waHref(p) { const d = digits(p); return `https://wa.me/${d.length === 10 ? `91${d}` : d}`; }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fmtDate(ymd) {
  if (!ymd) return '';
  return new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}
function dueTag(ymd) {
  const t = todayStr();
  if (ymd < t) return 'overdue';
  if (ymd === t) return 'today';
  return '';
}

export default function OperationsOrdersScreen() {
  const { data: orders, loading, refresh } = useApiResource(ORDERS_URL, { pollMs: 20000 });
  const [tab, setTab] = useState('confirmed');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState('');
  const [toast, setToast] = useState('');
  const [sheet, setSheet] = useState(null); // { type: 'schedule' | 'notes', order }

  function flash(msg) { setToast(msg); setTimeout(() => setToast(''), 3500); }

  const pipeline = useMemo(() => orders.filter((o) => STAGE[o.status]), [orders]);
  const counts = useMemo(() => {
    const c = {};
    for (const s of STAGES) c[s.key] = 0;
    for (const o of pipeline) c[o.status] += 1;
    return c;
  }, [pipeline]);
  const needDate = useMemo(() => pipeline.filter((o) => o.status !== 'installed' && !o.installDate).length, [pipeline]);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = pipeline.filter((o) => {
      if (s) return `${o.id} ${o.customerName || ''} ${o.phone || ''} ${o.city || ''} ${o.pincode || ''}`.toLowerCase().includes(s);
      return o.status === tab;
    });
    const t = (x) => new Date(x || 0).getTime();
    if (tab === 'installed' && !s) return list.sort((a, b) => t(b.updatedAt) - t(a.updatedAt));
    // Work queues run oldest-first; the install queue puts orders still missing a date at the top,
    // then the soonest dates.
    return list.sort((a, b) => {
      if (a.installDate && b.installDate && a.installDate !== b.installDate) return a.installDate < b.installDate ? -1 : 1;
      if (!!a.installDate !== !!b.installDate && (tab === 'delivered' || s)) return a.installDate ? 1 : -1;
      return t(a.createdAt) - t(b.createdAt);
    });
  }, [pipeline, tab, q]);

  async function patch(order, body) {
    setBusy(order.id);
    try {
      const res = await fetch(`${ORDERS_URL}/${order.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      await invalidate(ORDERS_URL);
      refresh();
      if (!res.ok) { flash(data.error || 'Could not save — try again'); return null; }
      return data;
    } catch {
      flash('Network problem — try again');
      return null;
    } finally {
      setBusy('');
    }
  }

  async function advance(order) {
    const st = STAGE[order.status];
    if (!st?.next) return;
    if (!window.confirm(`${st.action} for ${order.customerName || order.id}? The customer gets a WhatsApp update.`)) return;
    const r = await patch(order, { status: st.next });
    if (r) flash(`${STAGE[st.next].label}${r.whatsappSent ? ' — customer notified on WhatsApp' : ' — WhatsApp message not sent'}`);
  }

  async function markPaid(order) {
    if (!window.confirm(`Payment of ${money(order.subtotal)} received for ${order.id}?`)) return;
    if (await patch(order, { markPaid: true })) flash('Payment marked as received');
  }

  async function cancel(order) {
    if (!window.confirm(`Cancel order ${order.id}? This can't be undone, and the customer is told on WhatsApp.`)) return;
    const r = await patch(order, { status: 'cancelled' });
    if (r) flash(`Order cancelled${r.whatsappSent ? ' — customer notified on WhatsApp' : ' — WhatsApp message not sent'}`);
  }

  async function saveSchedule(order, date, slot) {
    const r = await patch(order, { installation: { date, slot } });
    if (!r) return false;
    flash(date ? `Installation set for ${fmtDate(date)}${r.whatsappSent ? ' — customer notified on WhatsApp' : ' — saved (WhatsApp message not sent)'}` : 'Installation date cleared');
    return true;
  }

  async function saveNotes(order, notes) {
    if (!(await patch(order, { notes }))) return false;
    flash('Note saved');
    return true;
  }

  return (
    <>
      <ScreenHeader title="Orders" backHref="/team/home" />

      <div className="hp-search-wrap">
        <div className="hp-input-wrap">
          <span className="hp-input-icon"><IconSearch size={16} /></span>
          <input className="hp-input" placeholder="Search order, customer, phone or city…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {needDate > 0 && (
        <div className="ops-banner">
          <IconCalendar size={16} />
          <span>{needDate} order{needDate === 1 ? '' : 's'} still need an installation date</span>
        </div>
      )}

      <div className="hp-tabs">
        {STAGES.map((s) => (
          <button key={s.key} type="button" className={`hp-tab${tab === s.key && !q.trim() ? ' active' : ''}`} onClick={() => { setTab(s.key); setQ(''); }}>
            {s.tab} <span className="ops-count">{counts[s.key]}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="hp-empty"><div className="hp-empty-sub">Loading…</div></div>
      ) : rows.length === 0 ? (
        <div className="hp-empty">
          <div className="hp-empty-icon"><IconOrders size={24} /></div>
          <div className="hp-empty-title">{q.trim() ? 'No orders match' : 'Nothing here'}</div>
          <div className="hp-empty-sub">{q.trim() ? 'Try a different name, number or order ID.' : 'Orders show up here as they move through the pipeline.'}</div>
        </div>
      ) : (
        <div className="ops-list">
          {rows.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              busy={busy === o.id}
              onAdvance={() => advance(o)}
              onPaid={() => markPaid(o)}
              onSchedule={() => setSheet({ type: 'schedule', order: o })}
              onNotes={() => setSheet({ type: 'notes', order: o })}
              onCancel={() => cancel(o)}
            />
          ))}
        </div>
      )}

      {sheet?.type === 'schedule' && (
        <ScheduleSheet
          order={orders.find((x) => x.id === sheet.order.id) || sheet.order}
          onClose={() => setSheet(null)}
          onSave={async (date, slot) => { if (await saveSchedule(sheet.order, date, slot)) setSheet(null); }}
        />
      )}
      {sheet?.type === 'notes' && (
        <NotesSheet
          order={orders.find((x) => x.id === sheet.order.id) || sheet.order}
          onClose={() => setSheet(null)}
          onSave={async (notes) => { if (await saveNotes(sheet.order, notes)) setSheet(null); }}
        />
      )}

      {toast && <div className="hp-toast">{toast}</div>}
    </>
  );
}

function OrderCard({ order: o, busy, onAdvance, onPaid, onSchedule, onNotes, onCancel }) {
  const st = STAGE[o.status];
  const [color, bg] = BADGE_COLOR[o.status] || BADGE_COLOR.confirmed;
  const paid = o.paymentStatus === 'paid';
  const done = o.status === 'installed';
  const items = (o.items || []).map((i) => `${i.name}${i.qty > 1 ? ` × ${i.qty}` : ''}`).join(', ');
  const due = o.installDate && !done ? dueTag(o.installDate) : '';
  return (
    <div className="ops-card">
      <div className="ops-card-top">
        <div>
          <div className="ops-id">{o.id}</div>
          <div className="ops-name">{o.customerName || 'Customer'}</div>
        </div>
        <span className="hp-badge" style={{ color, background: bg }}><span className="hp-badge-dot" />{st.label}</span>
      </div>

      <div className="ops-contact">
        <a className="ops-contact-btn" href={telHref(o.phone)}><IconPhone size={15} /> Call</a>
        <a className="ops-contact-btn" href={waHref(o.phone)} target="_blank" rel="noreferrer"><IconWhatsApp size={15} /> WhatsApp</a>
        <span className="ops-phone">{o.phone}</span>
      </div>

      {o.deliveryAddress && <div className="ops-line">{o.deliveryAddress}</div>}
      {items && <div className="ops-line ops-items">{items}</div>}

      <div className="ops-meta">
        <span className="ops-total">{money(o.subtotal)}</span>
        <span className={`ops-pay ${paid ? 'paid' : 'due'}`}>{paid ? 'Paid' : 'Payment pending'}</span>
      </div>

      {o.installDate ? (
        <div className={`ops-install ${due}`}>
          <IconCalendar size={14} />
          <span>
            {done ? 'Installed' : 'Install'}: {fmtDate(o.installDate)}{o.installSlot ? ` · ${o.installSlot}` : ''}
            {due === 'overdue' ? ' · overdue' : due === 'today' ? ' · today' : ''}
          </span>
        </div>
      ) : (!done && (
        <div className="ops-install none"><IconCalendar size={14} /><span>No installation date yet — call the customer</span></div>
      ))}

      {o.notes ? <div className="ops-note"><IconNote size={13} /> {o.notes}</div> : null}

      <div className="ops-actions">
        {st.next && (
          <button type="button" className="hp-btn hp-btn-primary hp-btn-sm" disabled={busy} onClick={onAdvance}>{busy ? 'Saving…' : st.action}</button>
        )}
        {!done && (
          <button type="button" className="hp-btn hp-btn-outline hp-btn-sm" disabled={busy} onClick={onSchedule}>{o.installDate ? 'Change date' : 'Set install date'}</button>
        )}
        {!paid && (
          <button type="button" className="hp-btn hp-btn-outline hp-btn-sm" disabled={busy} onClick={onPaid}>Payment received</button>
        )}
        <button type="button" className="hp-btn hp-btn-outline hp-btn-sm" disabled={busy} onClick={onNotes}>{o.notes ? 'Edit note' : 'Add note'}</button>
      </div>
      <div className="ops-actions">
        <a className="hp-btn hp-btn-outline hp-btn-sm" href={`/api/admin/orders/${o.id}/pdf?type=slip`} target="_blank" rel="noreferrer"><IconDownload size={14} /> Slip</a>
        <a className="hp-btn hp-btn-outline hp-btn-sm" href={`/api/admin/orders/${o.id}/pdf?type=invoice`} target="_blank" rel="noreferrer"><IconDownload size={14} /> Invoice</a>
        {CANCELLABLE.has(o.status) && (
          <button type="button" className="hp-btn hp-btn-outline hp-btn-sm" style={{ color: '#ff8484' }} disabled={busy} onClick={onCancel}>Cancel order</button>
        )}
      </div>
    </div>
  );
}

function ScheduleSheet({ order, onClose, onSave }) {
  const [date, setDate] = useState(order.installDate || '');
  const [slot, setSlot] = useState(order.installSlot || '');
  const [saving, setSaving] = useState(false);
  const unchanged = date === (order.installDate || '') && slot === (order.installSlot || '');
  async function go(d, s) { setSaving(true); await onSave(d, s); setSaving(false); }
  return (
    <Portal>
      <div className="hp-sheet-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="hp-sheet">
          <div className="hp-sheet-handle" />
          <div className="hp-sheet-title">Installation date</div>
          <div className="hp-sheet-sub">{order.customerName || order.id} · {order.phone}</div>

          <div className="hp-field">
            <label className="hp-field-label">Date agreed with the customer</label>
            <div className="hp-input-wrap">
              <input className="hp-input" type="date" min={todayStr()} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div className="hp-field-label" style={{ marginBottom: 8 }}>Time window (optional)</div>
          <div className="hp-pill-grid">
            {INSTALL_SLOTS.map((s) => (
              <button key={s} type="button" className={`hp-pill${slot === s ? ' active' : ''}`} onClick={() => setSlot(slot === s ? '' : s)}>{s}</button>
            ))}
          </div>
          <div className="hp-hint" style={{ marginTop: 10 }}>The customer gets a WhatsApp message with this date as soon as you save.</div>

          <div className="hp-sheet-actions">
            {order.installDate && (
              <button type="button" className="hp-btn hp-btn-outline" disabled={saving} onClick={() => go('', '')} aria-label="Clear date"><IconX size={16} /></button>
            )}
            <button type="button" className="hp-btn hp-btn-outline" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
            <button type="button" className="hp-btn hp-btn-primary" style={{ flex: 1.4 }} disabled={saving || !date || unchanged} onClick={() => go(date, slot)}>{saving ? 'Saving…' : 'Save & notify'}</button>
          </div>
        </div>
      </div>
    </Portal>
  );
}

function NotesSheet({ order, onClose, onSave }) {
  const [text, setText] = useState(order.notes || '');
  const [saving, setSaving] = useState(false);
  return (
    <Portal>
      <div className="hp-sheet-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="hp-sheet">
          <div className="hp-sheet-handle" />
          <div className="hp-sheet-title">Order note</div>
          <div className="hp-sheet-sub">{order.customerName || order.id} · internal only, the customer never sees this</div>
          <div className="hp-field">
            <div className="hp-textarea-wrap">
              <textarea className="hp-textarea" rows={4} maxLength={1000} placeholder="e.g. Customer asked to call after 6 pm" value={text} onChange={(e) => setText(e.target.value)} />
            </div>
          </div>
          <div className="hp-sheet-actions">
            <button type="button" className="hp-btn hp-btn-outline" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
            <button type="button" className="hp-btn hp-btn-primary" style={{ flex: 1.4 }} disabled={saving} onClick={async () => { setSaving(true); await onSave(text.trim()); setSaving(false); }}>{saving ? 'Saving…' : 'Save note'}</button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
