'use client';
// Landing Activity -> "Investors" tab: who got through the NDA gate on /investors and what they did
// with the proposal — read time, how far they scrolled, and time on each slide. Kept apart from the
// customer landing pages (Door Lock / Smart Home); data comes from lib/landingActivity.js's
// buildInvestorReport. Layout reuses the same admin building blocks as the rest of the page.
import { useState } from 'react';
import { StatCard, Funnel, Modal, Pagination } from './ui';
import { IconReports, IconLeads, IconConversions, IconPhone } from './icons';

const PAGE_SIZE = 10;

function dur(sec) {
  const s = Math.round(Number(sec) || 0);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
  return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m`;
}
function when(iso) {
  return iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
}
function waLink(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  return d ? `https://wa.me/${d.length === 10 ? `91${d}` : d}` : '#';
}

export default function InvestorActivityPanel({ r, loading }) {
  const [pageNo, setPageNo] = useState(1);
  const [modal, setModal] = useState(null);
  const sum = r?.summary || { gateVisits: 0, unlocked: 0, readers: 0, views: 0, avgReadSeconds: 0, finished: 0 };
  const people = r?.people || [];
  const pageCount = Math.max(1, Math.ceil(people.length / PAGE_SIZE));
  const rows = people.slice((Math.min(pageNo, pageCount) - 1) * PAGE_SIZE, Math.min(pageNo, pageCount) * PAGE_SIZE);
  const unlockRate = sum.gateVisits ? Math.round((sum.unlocked / sum.gateVisits) * 100) : 0;

  return (
    <>
      <div className="adm-stat-row">
        <StatCard label="Opened the gate page" value={sum.gateVisits} Icon={IconReports} tone="orange" />
        <StatCard label="Accepted NDA & unlocked" value={`${sum.unlocked}${sum.gateVisits ? ` (${unlockRate}%)` : ''}`} Icon={IconConversions} tone="green" />
        <StatCard label="Read the proposal" value={`${sum.readers} ${sum.readers === 1 ? 'person' : 'people'} · ${sum.views} ${sum.views === 1 ? 'open' : 'opens'}`} Icon={IconPhone} tone="purple" />
        <StatCard label="Avg time reading" value={dur(sum.avgReadSeconds)} Icon={IconLeads} tone="teal" />
      </div>

      <div className="adm-grid-2">
        <div className="adm-card">
          <div className="adm-card-title">Access journey</div>
          <div className="adm-card-sub">From landing on /investors to the proposal opening</div>
          {loading ? <div className="adm-empty">Loading…</div> : <Funnel rows={r?.funnel || []} />}
        </div>
        <div className="adm-card">
          <div className="adm-card-title">Slides readers reached</div>
          <div className="adm-card-sub">Share of readers who spent time on each slide, and the average time they gave it{sum.finished ? ` · ${sum.finished} scrolled to the end` : ''}</div>
          {(r?.slides || []).length === 0 ? <div className="adm-empty">No reading recorded yet.</div> : (
            <div className="adm-table-scroll">
              <table className="adm-table">
                <thead><tr><th>Slide</th><th>Readers</th><th>Avg time</th></tr></thead>
                <tbody>
                  {r.slides.map((s) => (
                    <tr key={s.id}><td>{s.label}</td><td>{s.count} ({s.pct}%)</td><td>{dur(s.avgSeconds)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="adm-card">
        <div className="adm-card-title">People who accepted the NDA</div>
        <div className="adm-card-sub">Newest activity first — tap a row for their reading detail</div>
        <div className="adm-table-scroll">
          <table className="adm-table">
            <thead><tr><th>Investor</th><th>NDA accepted</th><th>Last opened</th><th>Opens</th><th>Read time</th><th>Scrolled</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={6} className="adm-empty">Loading…</td></tr> : rows.length === 0 ? <tr><td colSpan={6} className="adm-empty">Nobody has unlocked the proposal in this period.</td></tr> : rows.map((p) => (
                <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => setModal(p)}>
                  <td><div className="adm-lead-name">{p.name}</div><div className="adm-lead-sub">{p.phone}</div></td>
                  <td>{when(p.acceptedAt)}</td>
                  <td>{when(p.lastOpenedAt)}</td>
                  <td>{p.views}</td>
                  <td>{p.views ? dur(p.readSeconds) : '—'}</td>
                  <td>{p.views ? `${p.maxScroll}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={Math.min(pageNo, pageCount)} pageCount={pageCount} total={people.length} pageSize={PAGE_SIZE} onPage={setPageNo} />
      </div>

      {modal && <PersonModal p={modal} slides={r?.slides || []} onClose={() => setModal(null)} />}
    </>
  );
}

function PersonModal({ p, slides, onClose }) {
  const labels = Object.fromEntries(slides.map((s) => [s.id, s.label]));
  const order = slides.map((s) => s.id);
  const timeline = Object.entries(p.slides || {}).sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
  return (
    <Modal title={p.name} sub={`NDA v${p.ndaVersion} accepted ${when(p.acceptedAt)}`} onClose={onClose}>
      <div className="adm-detail-grid">
        <div><span className="adm-detail-label">Phone</span>{p.phone}</div>
        <div><span className="adm-detail-label">Times opened</span>{p.views}</div>
        <div><span className="adm-detail-label">Total read time</span>{p.views ? dur(p.readSeconds) : '—'}</div>
        <div><span className="adm-detail-label">Scrolled</span>{p.views ? `${p.maxScroll}%` : '—'}</div>
        <div><span className="adm-detail-label">Last opened</span>{when(p.lastOpenedAt)}</div>
      </div>
      <div style={{ marginTop: 16 }}>
        <span className="adm-detail-label">Time on each slide</span>
        {timeline.length === 0 ? <div className="adm-lead-sub" style={{ marginTop: 5 }}>No reading recorded yet.</div> : timeline.map(([id, sec]) => (
          <div key={id} className="adm-lead-sub" style={{ marginTop: 5 }}><strong style={{ minWidth: 70, display: 'inline-block' }}>{dur(sec)}</strong> {labels[id] || id}</div>
        ))}
      </div>
      {p.sessions.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <span className="adm-detail-label">Each time they opened it</span>
          {p.sessions.map((s, i) => (
            <div key={i} className="adm-lead-sub" style={{ marginTop: 5 }}>{when(s.at)} · {dur(s.seconds)} · scrolled {s.maxScroll}% · {s.device}</div>
          ))}
        </div>
      )}
      <div className="lf-actions" style={{ marginTop: 18 }}>
        <a className="adm-btn-outline" href={waLink(p.phone)} target="_blank" rel="noreferrer">WhatsApp {p.phone}</a>
      </div>
    </Modal>
  );
}
