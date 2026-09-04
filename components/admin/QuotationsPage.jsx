'use client';
// Admin -> Quotations: every lead that has (or could use) a quotation, with the shared
// line-item builder (components/shared/QuotationBuilder.jsx) to build or revise one. Access
// scope for this feature: Admin + Sales Engineers (see components/employee/SalesEngineerPanel.jsx
// for the sales-engineer side of the same builder).
import { useMemo, useState } from 'react';
import { fmtDate, fmtDateTime } from '@/lib/date';
import { stageOf } from '@/lib/leadStage';
import { StatCard, Pagination, Modal } from './ui';
import { IconSearch, IconQuotation, IconEye, IconDownload, IconWhatsApp } from './icons';
import { useApiResource, invalidate } from '@/lib/useApiResource';
import QuotationBuilderModal, { currency } from '@/components/shared/QuotationBuilder';

const PAGE_SIZE = 8;

export default function QuotationsPage() {
  const { data: leads, loading, refresh } = useApiResource('/api/leads');
  const { data: employees } = useApiResource('/api/admin/employees');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null); // { type: 'build'|'view', lead }
  const [notice, setNotice] = useState('');
  const [sending, setSending] = useState(false);

  function flash(msg) { setNotice(msg); setTimeout(() => setNotice(''), 3000); }
  function nameOf(id) { return employees.find((e) => e.id === id)?.name || '—'; }
  function load() { invalidate('/api/leads'); refresh(); }

  async function sendOnWhatsApp(leadId) {
    setSending(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/quotation-pdf/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not send the quotation');
      flash('Sent on WhatsApp');
    } catch (e) {
      flash(e.message);
    } finally {
      setSending(false);
    }
  }

  const quotedLeads = useMemo(() => leads.filter((l) => l.quotationSentAt), [leads]);
  const awaitingLeads = useMemo(() => leads.filter((l) => !l.quotationSentAt && stageOf(l) === 'Demo Scheduled'), [leads]);
  const totalQuotedValue = useMemo(() => quotedLeads.reduce((s, l) => s + (Number(l.quotationAmount) || 0), 0), [quotedLeads]);

  const filtered = useMemo(() => leads.filter((l) => {
    if (status === 'quoted' && !l.quotationSentAt) return false;
    if (status === 'not_quoted' && l.quotationSentAt) return false;
    if (status === 'awaiting_demo' && stageOf(l) !== 'Demo Scheduled') return false;
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      if (!(`${l.name} ${l.phone} ${l.city || ''}`.toLowerCase().includes(s))) return false;
    }
    return true;
  }), [leads, status, q]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <div className="adm-page-head">
        <div><h1 className="adm-h1">Quotations</h1><p className="adm-page-sub">Build line-item quotations from your product catalogue, or a one-off amount — every revision is tracked on the lead's timeline</p></div>
      </div>

      {notice && <div className="adm-notice">{notice}</div>}

      <div className="adm-stat-row">
        <StatCard label="Quotations Sent" value={quotedLeads.length} Icon={IconQuotation} tone="orange" />
        <StatCard label="Total Quoted Value" value={currency(totalQuotedValue)} Icon={IconQuotation} tone="green" />
        <StatCard label="Awaiting Quotation" value={awaitingLeads.length} Icon={IconQuotation} tone="purple" />
      </div>

      <div className="adm-card">
        <div className="adm-toolbar">
          <div className="adm-search adm-search--inline"><IconSearch size={16} /><input placeholder="Search by lead name, phone or city…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="all">All Leads</option>
            <option value="quoted">Quoted</option>
            <option value="not_quoted">Not Quoted</option>
            <option value="awaiting_demo">Awaiting Quotation (Demo Scheduled)</option>
          </select>
        </div>

        <div className="adm-table-scroll">
          <table className="adm-table">
            <thead><tr><th>Lead Details</th><th>Stage</th><th>Latest Quote</th><th>Revisions</th><th>Sent By</th><th>Sent On</th><th></th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={7} className="adm-empty">Loading…</td></tr> : pageRows.length === 0 ? <tr><td colSpan={7} className="adm-empty">No leads match these filters.</td></tr> : pageRows.map((l) => {
                const revisions = Array.isArray(l.quotationRevisions) ? l.quotationRevisions : [];
                return (
                  <tr key={l.id}>
                    <td>
                      <div className="adm-lead-name">{l.name}</div>
                      <div className="adm-lead-sub">{l.phone} {l.city ? `• ${l.city}` : ''}</div>
                    </td>
                    <td>{stageOf(l)}</td>
                    <td>{l.quotationAmount != null ? currency(l.quotationAmount) : '—'}</td>
                    <td>{revisions.length || '—'}</td>
                    <td>{l.quotationSentBy ? nameOf(l.quotationSentBy) : '—'}</td>
                    <td>{l.quotationSentAt ? fmtDate(l.quotationSentAt) : '—'}</td>
                    <td className="adm-row-actions">
                      <div className="adm-row-actions-inner">
                        {revisions.length > 0 && <button className="adm-icon-btn" onClick={() => setModal({ type: 'view', lead: l })}><IconEye size={16} /></button>}
                        <button className="adm-chip-btn" onClick={() => setModal({ type: 'build', lead: l })}>{revisions.length ? 'Revise' : 'Build Quotation'}</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageCount={pageCount} total={filtered.length} pageSize={PAGE_SIZE} onPage={setPage} />
      </div>

      {modal?.type === 'build' && (
        <QuotationBuilderModal
          lead={modal.lead}
          onClose={() => setModal(null)}
          onDone={() => { setModal(null); load(); flash('Quotation saved'); }}
        />
      )}
      {modal?.type === 'view' && (
        <Modal title={`Quotation history — ${modal.lead.name}`} sub={`${modal.lead.phone}`} onClose={() => setModal(null)}>
          <div className="timeline">
            {(modal.lead.quotationRevisions || []).slice().reverse().map((r) => (
              <div className="timeline-item" key={r.revision}>
                <div className="timeline-dot" />
                <div>
                  <div className="timeline-label">v{r.revision} · {r.amount != null ? currency(r.amount) : 'no amount'}</div>
                  <div className="timeline-meta">{fmtDateTime(r.at)} · {r.by}</div>
                  {r.items?.length > 0 && (
                    <div className="timeline-note">{r.items.map((it) => `${it.name} x${it.qty}`).join(', ')}</div>
                  )}
                  {r.note && <div className="timeline-note">{r.note}</div>}
                </div>
              </div>
            ))}
          </div>
          <div className="lf-actions">
            <a className="adm-btn-outline" href={`/api/leads/${modal.lead.id}/quotation-pdf`} target="_blank" rel="noopener noreferrer"><IconDownload size={15} /> Download PDF</a>
            <button className="adm-btn-primary" onClick={() => sendOnWhatsApp(modal.lead.id)} disabled={sending}><IconWhatsApp size={15} /> {sending ? 'Sending…' : 'Send on WhatsApp'}</button>
          </div>
        </Modal>
      )}
    </>
  );
}
