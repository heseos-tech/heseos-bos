'use client';
// components/admin/PayoutsPage.jsx — Admin -> Payouts: a real ledger and settlement workflow
// for partner payouts, replacing the plain estimate shown elsewhere in the app. This is
// TRACKING ONLY — recording what was agreed and, once paid outside this system (bank transfer,
// UPI, cash — whatever was actually used), noting the reference and marking it settled. Nothing
// here executes a money transfer; see app/api/admin/payouts/route.js's header for why that
// boundary is deliberate.
import { useMemo, useState } from 'react';
import { fmtDate, fmtDateTime } from '@/lib/date';
import { payoutFor } from '@/lib/payout';
import { StatCard, Modal } from './ui';
import { IconPayouts, IconSearch, IconTrash } from './icons';
import { useApiResource, invalidate } from '@/lib/useApiResource';

function currency(n) { return `₹${Number(n || 0).toLocaleString('en-IN')}`; }

const STATUS_META = {
  pending: { label: 'Pending', c: '#6B7E96', bg: '#F1F5F9' },
  processing: { label: 'Processing', c: '#B7791F', bg: '#FEF3C7' },
  paid: { label: 'Paid', c: '#16A34A', bg: '#DCFCE7' },
};

export default function PayoutsPage() {
  const { data: payouts, loading: payoutsLoading, refresh: refreshPayouts } = useApiResource('/api/admin/payouts');
  const { data: partners, loading: partnersLoading } = useApiResource('/api/admin/partners');
  const { data: leads, loading: leadsLoading } = useApiResource('/api/leads');
  const { data: payoutConfig, loading: configLoading } = useApiResource('/api/payout-settings');
  const loading = payoutsLoading || partnersLoading || leadsLoading || configLoading;

  const [statusFilter, setStatusFilter] = useState('all');
  const [q, setQ] = useState('');
  const [recordFor, setRecordFor] = useState(null); // { partner, est }
  const [editing, setEditing] = useState(null); // payout record
  const [notice, setNotice] = useState('');

  function flash(msg) { setNotice(msg); setTimeout(() => setNotice(''), 3000); }
  function load() { invalidate('/api/admin/payouts'); refreshPayouts(); }
  function partnerOf(id) { return partners.find((p) => p.id === id) || null; }

  // Live estimate for THIS period, per partner — the same lib/payout.js engine every other
  // earnings number in the app already reads (Partner Rewards, Team Home, the Partners table).
  const estimates = useMemo(() => partners
    .map((p) => ({ partner: p, est: payoutFor(leads.filter((l) => l.partnerId === p.id), payoutConfig, 'partner') }))
    .filter((r) => r.est.hasTiers && r.est.totalValue > 0),
  [partners, leads, payoutConfig]);

  const totalPaid = useMemo(() => payouts.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount, 0), [payouts]);
  const pendingCount = useMemo(() => payouts.filter((p) => p.status !== 'paid').length, [payouts]);
  const pendingAmount = useMemo(() => payouts.filter((p) => p.status !== 'paid').reduce((s, p) => s + p.amount, 0), [payouts]);
  const thisPeriodEstimate = useMemo(() => estimates.reduce((s, r) => s + r.est.payout, 0), [estimates]);

  const filtered = useMemo(() => payouts
    .filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (q.trim()) {
        const partner = partnerOf(p.partnerId);
        const s = q.trim().toLowerCase();
        const hay = `${partner?.businessName || ''} ${partner?.name || ''} ${p.reference || ''}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
  [payouts, statusFilter, q, partners]);

  async function removePayout(p) {
    const res = await fetch(`/api/admin/payouts/${p.id}`, { method: 'DELETE' });
    if (res.ok) { load(); flash('Payout removed'); }
  }

  return (
    <>
      <div className="adm-page-head">
        <div><h1 className="adm-h1">Payouts</h1><p className="adm-page-sub">A real ledger and settlement workflow for partner payouts</p></div>
      </div>

      {notice && <div className="adm-notice">{notice}</div>}

      <div className="adm-stat-row">
        <StatCard label="Total Paid" value={currency(totalPaid)} Icon={IconPayouts} tone="green" />
        <StatCard label="Pending Settlement" value={`${pendingCount} · ${currency(pendingAmount)}`} Icon={IconPayouts} tone="orange" />
        <StatCard label="This Period Estimate" value={currency(thisPeriodEstimate)} Icon={IconPayouts} tone="purple" />
      </div>

      <div className="adm-card">
        <div className="adm-card-title-row">
          <div className="adm-card-title">This Period — Estimated Earnings</div>
        </div>
        <p className="adm-card-sub">Live estimate from Settings → Lead Conversion Payout — record one as a ledger entry once you&rsquo;re ready to settle it.</p>
        {loading ? <div className="adm-empty">Loading…</div> : estimates.length === 0 ? <div className="adm-empty">No partner has an estimated payout this period.</div> : (
          <div className="adm-table-scroll">
            <table className="adm-table">
              <thead><tr><th>Partner</th><th>Period</th><th>Converted</th><th>Sale Value</th><th>Rate</th><th>Estimated Payout</th><th></th></tr></thead>
              <tbody>
                {estimates.map(({ partner, est }) => (
                  <tr key={partner.id}>
                    <td><div className="adm-lead-name">{partner.businessName || partner.name}</div><div className="adm-lead-sub">{partner.city || ''}</div></td>
                    <td>{est.periodLabel}</td>
                    <td>{est.convertedCount}</td>
                    <td>{currency(est.totalValue)}</td>
                    <td>{est.rate}%</td>
                    <td>{currency(est.payout)}</td>
                    <td className="adm-row-actions">
                      <div className="adm-row-actions-inner">
                        <button className="adm-chip-btn" onClick={() => setRecordFor({ partner, est })}>Record Payout</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="adm-card">
        <div className="adm-toolbar">
          <div className="adm-search adm-search--inline"><IconSearch size={16} /><input placeholder="Search by partner or reference…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="paid">Paid</option>
          </select>
        </div>
        <div className="adm-table-scroll">
          <table className="adm-table">
            <thead><tr><th>Partner</th><th>Period</th><th>Amount</th><th>Status</th><th>Reference</th><th>Recorded</th><th></th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={7} className="adm-empty">Loading…</td></tr> : filtered.length === 0 ? (
                <tr><td colSpan={7} className="adm-empty">{payouts.length === 0 ? 'No payouts recorded yet.' : 'No payouts match these filters.'}</td></tr>
              ) : filtered.map((p) => {
                const partner = partnerOf(p.partnerId);
                const meta = STATUS_META[p.status] || STATUS_META.pending;
                return (
                  <tr key={p.id}>
                    <td><div className="adm-lead-name">{partner?.businessName || partner?.name || 'Unknown partner'}</div></td>
                    <td>{p.periodLabel || '—'}</td>
                    <td>{currency(p.amount)}</td>
                    <td><span className="adm-badge" style={{ color: meta.c, background: meta.bg }}><span className="adm-badge-dot" style={{ background: meta.c }} />{meta.label}</span></td>
                    <td>{p.reference || '—'}</td>
                    <td>{fmtDate(p.createdAt)}</td>
                    <td className="adm-row-actions">
                      <div className="adm-row-actions-inner">
                        <button className="adm-chip-btn" onClick={() => setEditing(p)}>{p.status === 'paid' ? 'View' : 'Settle'}</button>
                        {p.status !== 'paid' && <button className="adm-icon-btn" onClick={() => removePayout(p)}><IconTrash size={15} /></button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {recordFor && (
        <RecordPayoutModal
          partner={recordFor.partner}
          est={recordFor.est}
          onClose={() => setRecordFor(null)}
          onDone={() => { setRecordFor(null); load(); flash('Payout recorded'); }}
        />
      )}
      {editing && (
        <SettlePayoutModal
          payout={editing}
          partner={partnerOf(editing.partnerId)}
          onClose={() => setEditing(null)}
          onDone={() => { setEditing(null); load(); flash('Payout updated'); }}
        />
      )}
    </>
  );
}

function RecordPayoutModal({ partner, est, onClose, onDone }) {
  const [amount, setAmount] = useState(est.payout || '');
  const [method, setMethod] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setError('');
    if (!amount || Number(amount) <= 0) { setError('Enter a positive amount'); return; }
    setSaving(true);
    try {
      const body = { partnerId: partner.id, periodLabel: est.periodLabel, amount: Number(amount), method, note };
      const res = await fetch('/api/admin/payouts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record payout');
      onDone();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  return (
    <Modal title={`Record payout — ${partner.businessName || partner.name}`} sub={est.periodLabel} onClose={onClose}>
      <div className="lf-field"><label className="lf-label">Amount (₹)</label><input className="lf-input" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
      <div className="lf-field"><label className="lf-label">Method (optional)</label><input className="lf-input" value={method} onChange={(e) => setMethod(e.target.value)} placeholder="e.g. Bank Transfer, UPI, Cash" /></div>
      <div className="lf-field"><label className="lf-label">Note (optional)</label><textarea className="lf-input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>
      {error && <div className="lf-error">{error}</div>}
      <div className="lf-actions">
        <button className="lf-btn-back" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="lf-btn-next" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Record'}</button>
      </div>
    </Modal>
  );
}

function SettlePayoutModal({ payout, partner, onClose, onDone }) {
  const readOnly = payout.status === 'paid';
  const [status, setStatus] = useState(payout.status);
  const [method, setMethod] = useState(payout.method || '');
  const [reference, setReference] = useState(payout.reference || '');
  const [note, setNote] = useState(payout.note || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setError(''); setSaving(true);
    try {
      const body = { status, method, reference, note };
      const res = await fetch(`/api/admin/payouts/${payout.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update');
      onDone();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  return (
    <Modal title={partner?.businessName || partner?.name || 'Payout'} sub={`${payout.periodLabel || ''} • ${currency(payout.amount)}`} onClose={onClose}>
      <div className="lf-field">
        <label className="lf-label">Status</label>
        <select className="lf-input" value={status} onChange={(e) => setStatus(e.target.value)} disabled={readOnly}>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="paid">Paid</option>
        </select>
      </div>
      <div className="lf-field"><label className="lf-label">Method</label><input className="lf-input" value={method} onChange={(e) => setMethod(e.target.value)} disabled={readOnly} placeholder="e.g. Bank Transfer, UPI, Cash" /></div>
      <div className="lf-field"><label className="lf-label">Reference / UTR number</label><input className="lf-input" value={reference} onChange={(e) => setReference(e.target.value)} disabled={readOnly} placeholder="Reference from the actual transfer" /></div>
      <div className="lf-field"><label className="lf-label">Note</label><textarea className="lf-input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} disabled={readOnly} /></div>
      {payout.paidAt && <div className="adm-lead-sub" style={{ marginBottom: 12 }}>Marked paid {fmtDateTime(payout.paidAt)}</div>}
      {error && <div className="lf-error">{error}</div>}
      <div className="lf-actions">
        <button className="lf-btn-back" onClick={onClose}>{readOnly ? 'Close' : 'Cancel'}</button>
        {!readOnly && <button className="lf-btn-next" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>}
      </div>
    </Modal>
  );
}
