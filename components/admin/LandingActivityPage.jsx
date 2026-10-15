'use client';
// Admin -> Landing Activity: what happens after a customer taps "Know More" on WhatsApp — did they
// open the page, how far did they read, what did they tap, did they start / submit the form.
// Data comes from public/hs-track.js (visits) + lib/botFlowEngine.js (cards sent) via
// lib/landingActivity.js. Same layout recipe as Orders / Call Requests: stat cards, tab filters,
// funnels, tables, detail modal.
import { useState } from 'react';
import { StatCard, Funnel, Modal, Pagination } from './ui';
import { IconReports, IconLeads, IconConversions, IconPhone } from './icons';
import { useApiResource } from '@/lib/useApiResource';

const PAGE_TABS = [
  { key: 'all', label: 'All pages' },
  { key: 'door_lock', label: 'Door Lock' },
  { key: 'smart_home', label: 'Smart Home' },
];
const RANGE_TABS = [
  { key: 1, label: '24 hours' },
  { key: 7, label: '7 days' },
  { key: 30, label: '30 days' },
  { key: 90, label: '90 days' },
];
const PAGE_LABEL = { door_lock: 'Door Lock', smart_home: 'Smart Home' };
const STATUS = {
  submitted: { label: 'Submitted', cls: ' active' },
  form_started: { label: 'Started form', cls: ' pending' },
  browsed: { label: 'Browsed', cls: ' pending' },
  opened: { label: 'Just opened', cls: '' },
};
const PAGE_SIZE = 10;

function dur(sec) {
  const s = Math.round(Number(sec) || 0);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
}
function when(iso) {
  return iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
}
function waLink(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  return d ? `https://wa.me/${d.length === 10 ? `91${d}` : d}` : '#';
}

export default function LandingActivityPage() {
  const [page, setPage] = useState('all');
  const [days, setDays] = useState(7);
  const url = `/api/admin/landing-activity?days=${days}&page=${page}`;
  const { data, loading } = useApiResource(url, { pollMs: 30000 });
  const [pageNo, setPageNo] = useState(1);
  const [modal, setModal] = useState(null);

  const r = Array.isArray(data) ? null : data;
  const sum = r?.summary || { visits: 0, submitted: 0, avgSeconds: 0, avgScroll: 0, cardsSent: 0, cardsOpened: 0, bounced: 0 };
  const recent = r?.recent || [];
  const pageCount = Math.max(1, Math.ceil(recent.length / PAGE_SIZE));
  const rows = recent.slice((pageNo - 1) * PAGE_SIZE, pageNo * PAGE_SIZE);
  const conv = sum.visits ? Math.round((sum.submitted / sum.visits) * 100) : 0;
  const openRate = sum.cardsSent ? Math.round((sum.cardsOpened / sum.cardsSent) * 100) : 0;

  return (
    <>
      <div className="adm-page-head">
        <div><h1 className="adm-h1">Landing Activity</h1><p className="adm-page-sub">What customers do after tapping “Know More” on WhatsApp — who opened the page, how far they read, what they tapped, and whether they filled the form</p></div>
      </div>

      <div className="adm-card" style={{ marginBottom: 18 }}>
        <div className="adm-tabs" style={{ marginBottom: 8 }}>
          {PAGE_TABS.map((t) => (
            <button key={t.key} type="button" className={`adm-tab${page === t.key ? ' active' : ''}`} onClick={() => { setPage(t.key); setPageNo(1); }}>{t.label}</button>
          ))}
        </div>
        <div className="adm-tabs">
          {RANGE_TABS.map((t) => (
            <button key={t.key} type="button" className={`adm-tab${days === t.key ? ' active' : ''}`} onClick={() => { setDays(t.key); setPageNo(1); }}>{t.label}</button>
          ))}
        </div>
      </div>

      <div className="adm-stat-row">
        <StatCard label="Page visits" value={sum.visits} Icon={IconReports} tone="orange" />
        <StatCard label="WhatsApp cards opened" value={`${sum.cardsOpened} / ${sum.cardsSent}${sum.cardsSent ? ` (${openRate}%)` : ''}`} Icon={IconPhone} tone="purple" />
        <StatCard label="Avg time on page" value={dur(sum.avgSeconds)} Icon={IconLeads} tone="teal" />
        <StatCard label="Submitted" value={`${sum.submitted}${sum.visits ? ` (${conv}%)` : ''}`} Icon={IconConversions} tone="green" />
      </div>

      <div className="adm-grid-2">
        <div className="adm-card">
          <div className="adm-card-title">WhatsApp journey</div>
          <div className="adm-card-sub">People who were sent the “Know More” card → what they did next</div>
          {loading ? <div className="adm-empty">Loading…</div> : <Funnel rows={r?.waFunnel || []} />}
        </div>
        <div className="adm-card">
          <div className="adm-card-title">All page visits</div>
          <div className="adm-card-sub">Every visit, whatever the source. {sum.bounced ? `${sum.bounced} left within seconds without doing anything.` : ''}</div>
          {loading ? <div className="adm-empty">Loading…</div> : <Funnel rows={r?.allFunnel || []} />}
          {r && (
            <div className="adm-lead-sub" style={{ marginTop: 14, lineHeight: 1.8 }}>
              Source — WhatsApp {r.bySource?.WhatsApp || 0} · QR / referral {r.bySource?.['QR / Referral'] || 0} · Direct / other {r.bySource?.['Direct / other'] || 0}<br />
              Device — mobile {r.byDevice?.mobile || 0} · tablet {r.byDevice?.tablet || 0} · desktop {r.byDevice?.desktop || 0}
            </div>
          )}
        </div>
      </div>

      <div className="adm-grid-2">
        <div className="adm-card">
          <div className="adm-card-title">How far visitors got</div>
          <div className="adm-card-sub">{page === 'all' ? 'Pick Door Lock or Smart Home above to see which sections people reach' : 'Share of visitors who scrolled each section into view'}</div>
          {page !== 'all' && <Funnel rows={(r?.sections || []).map((s) => ({ key: s.id, label: s.label, count: s.count, pct: s.pct }))} />}
        </div>
        <div className="adm-card">
          <div className="adm-card-title">Buttons tapped</div>
          <div className="adm-card-sub">Which buttons visitors press, and where on the page</div>
          <div className="adm-table-scroll">
            <table className="adm-table">
              <thead><tr><th>Button</th><th>Where</th><th>People</th><th>Taps</th></tr></thead>
              <tbody>
                {(r?.clicks || []).length === 0 ? <tr><td colSpan={4} className="adm-empty">No taps recorded yet.</td></tr> : r.clicks.map((c) => (
                  <tr key={`${c.label}${c.loc}`}><td>{c.label}</td><td>{c.loc}</td><td>{c.people}</td><td>{c.taps}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="adm-card" style={{ marginBottom: 18 }}>
        <div className="adm-card-title">Sent a card but haven’t opened the page</div>
        <div className="adm-card-sub">Customers who got the WhatsApp link over 15 minutes ago and never opened it — a good list to nudge or call</div>
        <div className="adm-table-scroll">
          <table className="adm-table">
            <thead><tr><th>Phone</th><th>Page</th><th>Card sent</th><th></th></tr></thead>
            <tbody>
              {(r?.notOpened || []).length === 0 ? <tr><td colSpan={4} className="adm-empty">Nobody waiting — every card sent has been opened.</td></tr> : r.notOpened.map((c) => (
                <tr key={`${c.phone}${c.page}`}>
                  <td>{c.phone}</td><td>{PAGE_LABEL[c.page] || c.page}</td><td>{when(c.sentAt)}</td>
                  <td className="adm-row-actions"><a className="adm-chip-btn" href={waLink(c.phone)} target="_blank" rel="noreferrer">WhatsApp</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="adm-card">
        <div className="adm-card-title">Recent visits</div>
        <div className="adm-card-sub">Newest first — tap a row to see exactly what that visitor did</div>
        <div className="adm-table-scroll">
          <table className="adm-table">
            <thead><tr><th>When</th><th>Page</th><th>Visitor</th><th>Source</th><th>Scrolled</th><th>Time</th><th>Taps</th><th>Result</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={8} className="adm-empty">Loading…</td></tr> : rows.length === 0 ? <tr><td colSpan={8} className="adm-empty">No visits yet in this period.</td></tr> : rows.map((v) => (
                <tr key={v.id} style={{ cursor: 'pointer' }} onClick={() => setModal(v)}>
                  <td>{when(v.at)}</td>
                  <td>{PAGE_LABEL[v.page] || v.page}</td>
                  <td>{v.name ? <><div className="adm-lead-name">{v.name}</div><div className="adm-lead-sub">{v.phone}</div></> : (v.phone || <span className="adm-lead-sub">Anonymous</span>)}</td>
                  <td>{v.source}</td>
                  <td>{v.maxScroll}%</td>
                  <td>{dur(v.activeSeconds)}</td>
                  <td>{(v.clicks || []).length}</td>
                  <td><span className={`adm-status-pill${STATUS[v.status]?.cls || ''}`}>{STATUS[v.status]?.label || v.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={pageNo} pageCount={pageCount} total={recent.length} pageSize={PAGE_SIZE} onPage={setPageNo} />
      </div>

      {modal && <VisitModal v={modal} onClose={() => setModal(null)} />}
    </>
  );
}

function VisitModal({ v, onClose }) {
  // One merged, time-ordered story of the visit (seconds since the page opened).
  const events = [{ t: 0, text: `Opened the ${PAGE_LABEL[v.page] || ''} page` }];
  for (const [id, t] of v.sections || []) if (id !== 'hero') events.push({ t, text: `Scrolled to “${id}” section` });
  for (const [label, loc, t] of v.clicks || []) events.push({ t, text: `Tapped “${label}” (${loc})` });
  if (v.formStartSecs != null) events.push({ t: v.formStartSecs, text: `Started the form${(v.fields || []).length ? ` — touched: ${v.fields.join(', ')}` : ''}` });
  if (v.errors) events.push({ t: v.formStartSecs ?? 0, text: `Saw ${v.errors} form error${v.errors > 1 ? 's' : ''}` });
  if (v.submittedSecs != null) events.push({ t: v.submittedSecs, text: `Submitted${v.refId ? ` (${v.refId})` : ''}` });
  events.sort((a, b) => a.t - b.t);
  return (
    <Modal title={v.name || v.phone || 'Anonymous visitor'} sub={`${PAGE_LABEL[v.page] || v.page} page · ${when(v.at)}`} onClose={onClose}>
      <div className="adm-detail-grid">
        <div><span className="adm-detail-label">Source</span>{v.source}{v.ref ? ` (${v.ref})` : ''}</div>
        <div><span className="adm-detail-label">Device</span>{v.device}</div>
        <div><span className="adm-detail-label">Scrolled</span>{v.maxScroll}%</div>
        <div><span className="adm-detail-label">Time on page</span>{dur(v.activeSeconds)}</div>
        <div><span className="adm-detail-label">Result</span>{STATUS[v.status]?.label || v.status}</div>
        <div><span className="adm-detail-label">Came from</span>{v.utm?.source || v.referrer || (v.via === 'wa' ? 'WhatsApp link' : '—')}</div>
      </div>
      <div style={{ marginTop: 16 }}>
        <span className="adm-detail-label">What they did</span>
        {events.map((e, i) => (
          <div key={i} className="adm-lead-sub" style={{ marginTop: 5 }}><strong style={{ minWidth: 48, display: 'inline-block' }}>{dur(e.t)}</strong> {e.text}</div>
        ))}
      </div>
      {v.phone && (
        <div className="lf-actions" style={{ marginTop: 18 }}>
          <a className="adm-btn-outline" href={waLink(v.phone)} target="_blank" rel="noreferrer">WhatsApp {v.phone}</a>
        </div>
      )}
    </Modal>
  );
}
