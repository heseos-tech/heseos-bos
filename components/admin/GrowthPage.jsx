'use client';
// Admin — QR Codes & Referral Links ("Growth" tab). See lib/attribution.js for the model:
// four kinds of attribution link (qr_partner, qr_location, referral_partner,
// referral_customer), all sharing one entry point (app/go/[code]) and one funnel
// (scans/clicks → leads → converted, computed from the same canonical lead stage everywhere
// else in the app — lib/leadStage.js's stageOf).
import { useMemo, useState } from 'react';
import { useApiResource } from '@/lib/useApiResource';
import { ATTR_KIND_LABEL } from '@/lib/attributionConstants';
import { StatCard, Modal } from './ui';
import { IconQrCode, IconLink, IconLeads, IconConversions, IconSearch, IconPlus } from './icons';

const KIND_FILTERS = [
  { v: 'all', l: 'All' },
  { v: 'qr_partner', l: 'QR — Partner' },
  { v: 'qr_location', l: 'QR — Location' },
  { v: 'referral_partner', l: 'Referral — Partner' },
  { v: 'referral_customer', l: 'Referral — Customer' },
];

function isQr(kind) { return kind === 'qr_partner' || kind === 'qr_location'; }

function ownerLabel(l) {
  if (l.kind === 'qr_partner' || l.kind === 'referral_partner') return l.partnerName || l.label || l.partnerId || '—';
  if (l.kind === 'qr_location') return l.label || '—';
  return l.customerName || l.label || '—';
}

export default function GrowthPage() {
  const { data: links, loading, refresh } = useApiResource('/api/admin/attribution');
  const [kind, setKind] = useState('all');
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(null);
  const [notice, setNotice] = useState('');

  function flash(msg) { setNotice(msg); setTimeout(() => setNotice(''), 2500); }

  const filtered = useMemo(() => links.filter((l) => {
    if (kind !== 'all' && l.kind !== kind) return false;
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      if (!(`${l.id} ${ownerLabel(l)} ${l.customerPhone || ''}`.toLowerCase().includes(s))) return false;
    }
    return true;
  }), [links, kind, q]);

  const totals = useMemo(() => links.reduce((a, l) => ({
    visits: a.visits + (l.funnel?.visits || 0),
    leads: a.leads + (l.funnel?.leads || 0),
    converted: a.converted + (l.funnel?.converted || 0),
  }), { visits: 0, leads: 0, converted: 0 }), [links]);

  async function toggleActive(l) {
    await fetch('/api/admin/attribution', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: l.id, active: l.active === false }) });
    refresh();
  }

  return (
    <>
      <div className="adm-page-head">
        <div><h1 className="adm-h1">QR Codes &amp; Referral Links</h1><p className="adm-page-sub">Partner QR codes, billboard/standee QR codes, and referral links — every scan and click, and every lead and conversion it drives</p></div>
        <div className="adm-page-head-actions">
          <button className="adm-btn-primary" onClick={() => setModal({ type: 'create' })}><IconPlus size={15} /> Create QR Code</button>
        </div>
      </div>

      {notice && <div className="adm-notice">{notice}</div>}

      <div className="adm-stat-row">
        <StatCard label="Total Links" value={links.length} Icon={IconQrCode} tone="orange" />
        <StatCard label="Scans / Clicks" value={totals.visits} Icon={IconLink} tone="purple" />
        <StatCard label="Leads Generated" value={totals.leads} Icon={IconLeads} tone="teal" />
        <StatCard label="Converted" value={totals.converted} Icon={IconConversions} tone="green" />
      </div>

      <div className="adm-card">
        <div className="adm-toolbar">
          <div className="adm-search adm-search--inline"><IconSearch size={16} /><input placeholder="Search by code, partner, location or customer…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            {KIND_FILTERS.map((k) => <option key={k.v} value={k.v}>{k.l}</option>)}
          </select>
        </div>

        <div className="adm-table-scroll">
          <table className="adm-table">
            <thead><tr><th>Code</th><th>Kind</th><th>Owner / Label</th><th>Scans / Clicks</th><th>Leads</th><th>Converted</th><th>Conv. Rate</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={9} className="adm-empty">Loading…</td></tr> : filtered.length === 0 ? <tr><td colSpan={9} className="adm-empty">No links match these filters.</td></tr> : filtered.map((l) => {
                const f = l.funnel || { visits: 0, leads: 0, converted: 0 };
                const rate = f.visits ? Math.round((f.converted / f.visits) * 1000) / 10 : 0;
                return (
                  <tr key={l.id}>
                    <td><code>{l.id}</code></td>
                    <td>{ATTR_KIND_LABEL[l.kind] || l.kind}</td>
                    <td>{ownerLabel(l)}</td>
                    <td>{f.visits}</td>
                    <td>{f.leads}</td>
                    <td>{f.converted}</td>
                    <td>{rate}%</td>
                    <td><span className={`adm-status-pill${l.active !== false ? ' active' : ''}`}>{l.active !== false ? 'Active' : 'Inactive'}</span></td>
                    <td className="adm-row-actions">
                      <div className="adm-row-actions-inner">
                        <button className="adm-icon-btn" onClick={() => setModal({ type: 'view', link: l })}>{isQr(l.kind) ? <IconQrCode size={16} /> : <IconLink size={16} />}</button>
                        <button className="adm-chip-btn" onClick={() => toggleActive(l)}>{l.active !== false ? 'Deactivate' : 'Activate'}</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modal?.type === 'create' && (
        <CreateLinkModal onClose={() => setModal(null)} onDone={(link) => { setModal({ type: 'view', link: { ...link, funnel: { visits: 0, leads: 0, converted: 0 } } }); flash('Link created'); refresh(); }} />
      )}
      {modal?.type === 'view' && <LinkDetailModal link={modal.link} onClose={() => setModal(null)} onCopied={() => flash('Link copied')} />}
    </>
  );
}

function LinkDetailModal({ link, onClose, onCopied }) {
  // The admin list (GET /api/admin/attribution) doesn't carry PUBLIC_BASE_URL, so build the
  // shareable URL straight from window.location — always correct for whichever domain the
  // admin is actually using, and link.url (set right after creation) is used when present.
  const shareUrl = link.url || (typeof window !== 'undefined' ? `${window.location.origin}/go/${link.id}` : `/go/${link.id}`);
  const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(shareUrl)}`;

  function copy() {
    navigator.clipboard?.writeText(shareUrl).then(() => onCopied && onCopied());
  }

  return (
    <Modal title={ATTR_KIND_LABEL[link.kind] || link.kind} sub={link.id} onClose={onClose}>
      {isQr(link.kind) && (
        <div style={{ textAlign: 'center', marginBottom: 14 }}>
          <img src={qrImg} alt="QR code" width={200} height={200} style={{ borderRadius: 8, background: '#fff', padding: 8 }} />
          <div style={{ marginTop: 8 }}>
            <a className="adm-btn-outline" href={qrImg} target="_blank" rel="noreferrer">Open Full-Size QR ↗</a>
          </div>
        </div>
      )}
      <div className="lf-field">
        <label className="lf-label">Shareable link</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="lf-input" readOnly value={shareUrl} onFocus={(e) => e.target.select()} />
          <button className="adm-btn-outline" onClick={copy}>Copy</button>
        </div>
      </div>
      <div className="adm-detail-grid">
        <div><span className="adm-detail-label">Scans / Clicks</span>{link.funnel?.visits ?? '—'}</div>
        <div><span className="adm-detail-label">Leads</span>{link.funnel?.leads ?? '—'}</div>
        <div><span className="adm-detail-label">Converted</span>{link.funnel?.converted ?? '—'}</div>
      </div>
    </Modal>
  );
}

// Referral links (partner and customer) are deliberately NOT creatable from here — partners
// self-provision their own from the Partner App's "Share & Earn" page (app/api/partner/
// attribution), and customer referral links will eventually be self-requested from the
// WhatsApp bot once those flows exist. Only QR codes go through admin, since those need
// printing/placing physically — qr_partner because a partner may want Heseos to print one for
// them, qr_location because there's no partner/customer to self-serve it in the first place.
const KIND_OPTIONS = [
  { v: 'qr_location', l: 'QR — Location', hint: 'A billboard, standee or shop window — tracked by placement' },
  { v: 'qr_partner', l: 'QR — Partner', hint: "A partner's QR code — they already have one in their own app; use this only to print/hand one out yourself" },
];

function CreateLinkModal({ onClose, onDone }) {
  const { data: partners } = useApiResource('/api/admin/partners');

  const [kind, setKind] = useState('qr_location');
  const [label, setLabel] = useState('');
  const [partnerId, setPartnerId] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const canSave = (
    (kind === 'qr_location' && label.trim()) ||
    (kind === 'qr_partner' && partnerId)
  );

  async function submit() {
    setError(''); setSaving(true);
    try {
      const res = await fetch('/api/admin/attribution', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, label, partnerId: partnerId || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      onDone(data);
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  return (
    <Modal title="Create a QR code" sub="Every scan routes into WhatsApp and the resulting chat becomes an attributed lead. Referral links are self-service — see the Partner App (and, soon, the WhatsApp bot for customers)." onClose={onClose}>
      <div className="lf-field">
        <label className="lf-label">Type</label>
        <div className="lf-pills">
          {KIND_OPTIONS.map((k) => (
            <button key={k.v} type="button" className={`lf-pill${kind === k.v ? ' active' : ''}`} onClick={() => setKind(k.v)}>{k.l}</button>
          ))}
        </div>
        <div className="adm-meta-hint" style={{ marginTop: 6 }}>{KIND_OPTIONS.find((k) => k.v === kind)?.hint}</div>
      </div>

      {kind === 'qr_location' && (
        <div className="lf-field"><label className="lf-label">Location label</label><input className="lf-input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder='e.g. "Koramangala Billboard" or "HSR Standee 2"' /></div>
      )}

      {kind === 'qr_partner' && (
        <div className="lf-field">
          <label className="lf-label">Partner</label>
          <select className="lf-input" value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
            <option value="">Select partner…</option>
            {partners.map((p) => <option key={p.id} value={p.id}>{p.businessName || p.name}</option>)}
          </select>
        </div>
      )}

      {error && <div className="lf-error">{error}</div>}
      <div className="lf-actions">
        <button className="lf-btn-back" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="lf-btn-next" onClick={submit} disabled={saving || !canSave}>{saving ? 'Creating…' : 'Create'}</button>
      </div>
    </Modal>
  );
}
