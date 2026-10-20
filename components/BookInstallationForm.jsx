'use client';
// The "Book your installation" form (app/book-installation/[token]/page.jsx). The customer picks a
// date + a time window (and may add a note); Operations confirm it and arrange an installer.
import { useState } from 'react';

const fmt = (d) => {
  const [y, m, day] = String(d).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
};

export default function BookInstallationForm({ token, orderId, firstName, items, address, blocked, current, minDate, maxDate, slots }) {
  const [date, setDate] = useState(current?.date || '');
  const [slot, setSlot] = useState(current?.slot || '');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!date) { setError('Please pick a date.'); return; }
    if (!slot) { setError('Please choose a time window.'); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/install-booking/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, slot, note }),
      });
      const raw = await res.text();
      let data = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch { /* non-JSON error body */ }
      if (!res.ok) throw new Error(data.error || `Could not save your booking (${res.status})`);
      setDone({ date, slot });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const head = (
    <div style={{ padding: 'max(22px, env(safe-area-inset-top)) 20px 8px' }}>
      <img src="/brand/lockup-white.png" alt="Heseos" style={{ height: 30, width: 'auto', display: 'block', marginBottom: 18 }} />
    </div>
  );

  if (done) {
    return (
      <>
        {head}
        <div className="hp-card">
          <div className="hp-card-title" style={{ color: 'var(--hp-success)' }}>Request received ✓</div>
          <div style={{ fontSize: 15, lineHeight: 1.6, color: '#fff', fontWeight: 600 }}>{fmt(done.date)}</div>
          <div style={{ fontSize: 14, color: 'var(--hp-text-soft)', marginBottom: 14 }}>{done.slot}</div>
          <div style={{ fontSize: 13.5, color: 'var(--hp-text-soft)', lineHeight: 1.6 }}>
            Our team will confirm your installation on WhatsApp shortly. You can reopen this page from the same WhatsApp message to change the date until a technician has been assigned.
          </div>
        </div>
      </>
    );
  }

  if (blocked) {
    return (
      <>
        {head}
        <div className="hp-card">
          <div className="hp-card-title">Order {orderId}</div>
          <div style={{ fontSize: 14, color: 'var(--hp-text-soft)', lineHeight: 1.6 }}>{blocked}</div>
          {current?.date && (
            <div style={{ marginTop: 12, fontSize: 14, color: '#fff' }}>
              Installation: <strong>{fmt(current.date)}</strong>{current.slot ? ` · ${current.slot}` : ''}
            </div>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      {head}
      <div style={{ padding: '0 20px 6px' }}>
        <h1 className="hp-h2" style={{ marginBottom: 6 }}>Book your <span className="hp-accent-text">installation</span></h1>
        <p className="hp-sub" style={{ marginBottom: 16 }}>{firstName ? `Hi ${firstName}, your` : 'Your'} order {orderId} has been delivered. Pick a date and time for our technician to visit.</p>
      </div>

      <form onSubmit={submit}>
        <div className="hp-card">
          {items.length > 0 && (
            <div style={{ marginBottom: 14, fontSize: 13, color: 'var(--hp-text-soft)', lineHeight: 1.6 }}>
              {items.map((i, k) => <div key={k}>{i.qty} × {i.name}</div>)}
              {address && <div style={{ marginTop: 6, color: 'var(--hp-text-faint)' }}>{address}</div>}
            </div>
          )}

          <div className="hp-field">
            <label className="hp-field-label">Preferred date</label>
            <div className="hp-input-wrap">
              <input className="hp-input" type="date" min={minDate} max={maxDate} value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
          </div>

          <div className="hp-field-label" style={{ marginBottom: 8 }}>Time window</div>
          <div className="hp-pill-grid" style={{ marginBottom: 14 }}>
            {slots.map((s) => (
              <button key={s} type="button" className={`hp-pill${slot === s ? ' active' : ''}`} onClick={() => setSlot(s)}>{s}</button>
            ))}
          </div>

          <div className="hp-field">
            <label className="hp-field-label">Anything we should know? (optional)</label>
            <div className="hp-textarea-wrap">
              <textarea className="hp-textarea" maxLength={300} placeholder="e.g. Please call before arriving; flat is on the 4th floor" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>

          {error && <div className="hp-error">{error}</div>}
          <button type="submit" className="hp-btn hp-btn-primary hp-btn-block" disabled={loading}>{loading ? 'Saving…' : current?.date ? 'Update booking' : 'Book installation'}</button>
          <div style={{ fontSize: 12, color: 'var(--hp-text-faint)', marginTop: 12, lineHeight: 1.5 }}>
            Our team will confirm the exact time on WhatsApp. Please keep someone available at home on the day.
          </div>
        </div>
      </form>
    </>
  );
}
