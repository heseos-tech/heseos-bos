'use client';
// components/admin/ConversionsPage.jsx — Admin -> Conversions: a focused view of every
// converted deal — install status, invoicing, warranty — layered on top of the leads already
// visible with the Converted filter on the Leads table. Tracking fields (installStatus/
// installDate/invoiceNumber/invoiceAmount/invoiceStatus/warrantyMonths/conversionNote) live on
// the lead itself (lib/leadStage.js) and are written through app/api/leads/[id]/route.js's
// admin-only 'conversionUpdate' PATCH type — no new table, no new registration needed.
import { useMemo, useState } from 'react';
import { fmtDate } from '@/lib/date';
import {
  INSTALL_STATUSES, INSTALL_STATUS_COLOR,
  INVOICE_STATUSES, INVOICE_STATUS_COLOR,
  warrantyStatus, warrantyExpiry, WARRANTY_STATUS_LABEL, WARRANTY_STATUS_COLOR,
} from '@/lib/leadStage';
import { StatCard, Modal } from './ui';
import { IconConversions, IconSearch, IconClock, IconQuotation, IconEye } from './icons';
import { useApiResource, invalidate } from '@/lib/useApiResource';

function currency(n) { return `₹${Number(n || 0).toLocaleString('en-IN')}`; }

export default function ConversionsPage() {
  const { data: leads, loading: leadsLoading, refresh } = useApiResource('/api/leads');
  const { data: employees, loading: employeesLoading } = useApiResource('/api/admin/employees');
  const loading = leadsLoading || employeesLoading;
  const [q, setQ] = useState('');
  const [installFilter, setInstallFilter] = useState('all');
  const [invoiceFilter, setInvoiceFilter] = useState('all');
  const [modal, setModal] = useState(null); // lead being viewed/edited
  const [notice, setNotice] = useState('');

  function flash(msg) { setNotice(msg); setTimeout(() => setNotice(''), 3000); }
  function load() { invalidate('/api/leads'); refresh(); }
  function engineerName(id) { return employees.find((e) => e.id === id)?.name || '—'; }

  const converted = useMemo(() => leads.filter((l) => l.demoOutcome === 'converted'), [leads]);

  const totalRevenue = useMemo(() => converted.reduce((s, l) => s + (l.finalPrice || 0), 0), [converted]);
  const installPending = useMemo(() => converted.filter((l) => (l.installStatus || 'pending') !== 'completed').length, [converted]);
  const invoiceUnpaid = useMemo(() => converted.filter((l) => (l.invoiceStatus || 'not_sent') !== 'paid').length, [converted]);
  const warrantyExpiringSoon = useMemo(() => converted.filter((l) => warrantyStatus(l) === 'expiring_soon').length, [converted]);

  const filtered = useMemo(() => converted
    .filter((l) => {
      if (installFilter !== 'all' && (l.installStatus || 'pending') !== installFilter) return false;
      if (invoiceFilter !== 'all' && (l.invoiceStatus || 'not_sent') !== invoiceFilter) return false;
      if (q.trim()) {
        const s = q.trim().toLowerCase();
        if (!(`${l.name} ${l.phone} ${l.city}`.toLowerCase().includes(s))) return false;
      }
      return true;
    })
    .sort((a, b) => new Date(b.convertedAt || 0) - new Date(a.convertedAt || 0)),
  [converted, installFilter, invoiceFilter, q]);

  return (
    <>
      <div className="adm-page-head">
        <div><h1 className="adm-h1">Conversions</h1><p className="adm-page-sub">Install status, invoicing and warranty for every converted deal</p></div>
      </div>

      {notice && <div className="adm-notice">{notice}</div>}

      <div className="adm-stat-row">
        <StatCard label="Converted Deals" value={converted.length} Icon={IconConversions} tone="orange" />
        <StatCard label="Total Revenue" value={currency(totalRevenue)} Icon={IconQuotation} tone="green" />
        <StatCard label="Install Pending" value={installPending} Icon={IconClock} tone="purple" />
        <StatCard label="Invoice Unpaid" value={invoiceUnpaid} Icon={IconQuotation} tone="teal" />
        <StatCard label="Warranty Expiring Soon" value={warrantyExpiringSoon} Icon={IconClock} tone="blue" />
      </div>

      <div className="adm-card">
        <div className="adm-toolbar">
          <div className="adm-search adm-search--inline"><IconSearch size={16} /><input placeholder="Search by lead, phone or city…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <select value={installFilter} onChange={(e) => setInstallFilter(e.target.value)}>
            <option value="all">All Install Statuses</option>
            {INSTALL_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <select value={invoiceFilter} onChange={(e) => setInvoiceFilter(e.target.value)}>
            <option value="all">All Invoice Statuses</option>
            {INVOICE_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>

        <div className="adm-table-scroll">
          <table className="adm-table">
            <thead><tr><th>Lead</th><th>Sales Engineer</th><th>Final Price</th><th>Install</th><th>Invoice</th><th>Warranty</th><th></th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={7} className="adm-empty">Loading…</td></tr> : filtered.length === 0 ? (
                <tr><td colSpan={7} className="adm-empty">{converted.length === 0 ? 'No converted deals yet.' : 'No deals match these filters.'}</td></tr>
              ) : filtered.map((l) => {
                const installKey = l.installStatus || 'pending';
                const installMeta = INSTALL_STATUS_COLOR[installKey];
                const invoiceKey = l.invoiceStatus || 'not_sent';
                const invoiceMeta = INVOICE_STATUS_COLOR[invoiceKey];
                const wStatus = warrantyStatus(l);
                return (
                  <tr key={l.id}>
                    <td>
                      <div className="adm-lead-name">{l.name}</div>
                      <div className="adm-lead-sub">{l.phone} • {l.city}</div>
                    </td>
                    <td>{engineerName(l.salesEngineerId)}</td>
                    <td>{currency(l.finalPrice)}</td>
                    <td><span className="adm-badge" style={{ color: installMeta.c, background: installMeta.bg }}><span className="adm-badge-dot" style={{ background: installMeta.c }} />{INSTALL_STATUSES.find((s) => s.key === installKey)?.label}</span></td>
                    <td><span className="adm-badge" style={{ color: invoiceMeta.c, background: invoiceMeta.bg }}><span className="adm-badge-dot" style={{ background: invoiceMeta.c }} />{INVOICE_STATUSES.find((s) => s.key === invoiceKey)?.label}</span></td>
                    <td>
                      {wStatus ? (
                        <span className="adm-badge" style={{ color: WARRANTY_STATUS_COLOR[wStatus].c, background: WARRANTY_STATUS_COLOR[wStatus].bg }}>
                          <span className="adm-badge-dot" style={{ background: WARRANTY_STATUS_COLOR[wStatus].c }} />{WARRANTY_STATUS_LABEL[wStatus]}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="adm-row-actions">
                      <div className="adm-row-actions-inner">
                        <button className="adm-icon-btn" onClick={() => setModal(l)}><IconEye size={16} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <ConversionModal
          lead={modal}
          engineerName={engineerName(modal.salesEngineerId)}
          onClose={() => setModal(null)}
          onDone={() => { setModal(null); load(); flash('Conversion updated'); }}
        />
      )}
    </>
  );
}

function ConversionModal({ lead, engineerName, onClose, onDone }) {
  const [installStatus, setInstallStatus] = useState(lead.installStatus || 'pending');
  const [installDate, setInstallDate] = useState(lead.installDate ? String(lead.installDate).slice(0, 10) : '');
  const [invoiceNumber, setInvoiceNumber] = useState(lead.invoiceNumber || '');
  const [invoiceAmount, setInvoiceAmount] = useState(lead.invoiceAmount ?? '');
  const [invoiceStatus, setInvoiceStatus] = useState(lead.invoiceStatus || 'not_sent');
  const [warrantyMonths, setWarrantyMonths] = useState(lead.warrantyMonths ?? '');
  const [conversionNote, setConversionNote] = useState(lead.conversionNote || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const previewLead = { ...lead, installDate: installDate || null, warrantyMonths: warrantyMonths || null };
  const expiry = warrantyExpiry(previewLead);

  async function submit() {
    setError(''); setSaving(true);
    try {
      const body = {
        type: 'conversionUpdate',
        installStatus, installDate: installDate || null,
        invoiceNumber, invoiceAmount: invoiceAmount === '' ? null : invoiceAmount,
        invoiceStatus,
        warrantyMonths: warrantyMonths === '' ? null : warrantyMonths,
        conversionNote,
      };
      const res = await fetch(`/api/leads/${lead.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      onDone();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  return (
    <Modal title={lead.name} sub={`${lead.phone} • ${lead.city} • ${currency(lead.finalPrice)} • ${engineerName}`} onClose={onClose}>
      <div className="lf-field">
        <label className="lf-label">Install status</label>
        <select className="lf-input" value={installStatus} onChange={(e) => setInstallStatus(e.target.value)}>
          {INSTALL_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>
      <div className="lf-field"><label className="lf-label">Install date (optional)</label><input className="lf-input" type="date" value={installDate} onChange={(e) => setInstallDate(e.target.value)} /></div>

      <div style={{ display: 'flex', gap: 12 }}>
        <div className="lf-field" style={{ flex: 1 }}><label className="lf-label">Invoice number</label><input className="lf-input" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="e.g. INV-1042" /></div>
        <div className="lf-field" style={{ flex: 1 }}><label className="lf-label">Invoice amount (₹)</label><input className="lf-input" type="number" value={invoiceAmount} onChange={(e) => setInvoiceAmount(e.target.value)} placeholder={String(lead.finalPrice || '')} /></div>
      </div>
      <div className="lf-field">
        <label className="lf-label">Invoice status</label>
        <select className="lf-input" value={invoiceStatus} onChange={(e) => setInvoiceStatus(e.target.value)}>
          {INVOICE_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>

      <div className="lf-field">
        <label className="lf-label">Warranty (months from install date{installDate ? '' : ', or conversion date if no install date'})</label>
        <input className="lf-input" type="number" value={warrantyMonths} onChange={(e) => setWarrantyMonths(e.target.value)} placeholder="e.g. 12" />
        {expiry && <div className="adm-lead-sub" style={{ marginTop: 6 }}>Expires {fmtDate(expiry)}</div>}
      </div>

      <div className="lf-field"><label className="lf-label">Note (optional)</label><textarea className="lf-input" rows={2} value={conversionNote} onChange={(e) => setConversionNote(e.target.value)} /></div>

      {error && <div className="lf-error">{error}</div>}

      <div className="lf-actions">
        <button className="lf-btn-back" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="lf-btn-next" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
      </div>
    </Modal>
  );
}
