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
import { IconQrCode, IconLink, IconLeads, IconConversions, IconSearch, IconPlus, IconDownload } from './icons';

// Kind (the table's own column) only ever shows "QR Code" or "Referral Link" — which of the
// four underlying kinds it is (qr_partner, qr_location, referral_partner, referral_customer)
// shows instead as a Partner/Location/Customer tag next to the owner's name in the next
// column, since that's the distinction admins actually care about at a glance.
const KIND_FILTERS = [
  { v: 'all', l: 'All' },
  { v: 'qr', l: 'QR Code' },
  { v: 'referral', l: 'Referral Link' },
];

function isQr(kind) { return kind === 'qr_partner' || kind === 'qr_location'; }

// Partner / Location / Customer — whose link this is, shown as a small tag beside the name.
function ownerTypeLabel(l) {
  if (l.kind === 'qr_partner' || l.kind === 'referral_partner') return 'Partner';
  if (l.kind === 'qr_location') return 'Location';
  return 'Customer';
}

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
    if (kind !== 'all' && isQr(l.kind) !== (kind === 'qr')) return false;
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
          <button className="adm-btn-outline" onClick={() => setModal({ type: 'blank-qr' })}><IconDownload size={15} /> Pre-Print Partner QR Codes</button>
          <button className="adm-btn-primary" onClick={() => setModal({ type: 'create' })}><IconPlus size={15} /> Create Location QR</button>
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
            <thead><tr><th>Code</th><th>Kind</th><th>Partner / Location</th><th>Scans / Clicks</th><th>Leads</th><th>Converted</th><th>Conv. Rate</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={9} className="adm-empty">Loading…</td></tr> : filtered.length === 0 ? <tr><td colSpan={9} className="adm-empty">No links match these filters.</td></tr> : filtered.map((l) => {
                const f = l.funnel || { visits: 0, leads: 0, converted: 0 };
                const rate = f.visits ? Math.round((f.converted / f.visits) * 1000) / 10 : 0;
                return (
                  <tr key={l.id}>
                    <td><code>{l.id}</code></td>
                    <td>{isQr(l.kind) ? 'QR Code' : 'Referral Link'}</td>
                    <td>
                      <div className="adm-lead-name">{ownerLabel(l)}</div>
                      <div className="adm-lead-sub">{ownerTypeLabel(l)}</div>
                    </td>
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
      {modal?.type === 'blank-qr' && <BlankQrModal onClose={() => setModal(null)} />}
    </>
  );
}

function LinkDetailModal({ link, onClose, onCopied }) {
  // GET/POST /api/admin/attribution now always compute link.url server-side: a direct
  // https://wa.me/... link straight into Heseos Buddy when WhatsApp is connected & verified
  // (no bouncing through our own domain first), or null when it isn't. The window.location
  // fallback below only ever fires in that "not connected yet" case, landing on our own
  // /go/<code> page — which shows a friendly explanation instead of a broken wa.me link, and
  // resolves correctly on its own the moment WhatsApp gets connected.
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
// self-provision their own from the Partner App's Profile → Referral Link screen (app/api/
// partner/attribution), and customer referral links will eventually be self-requested from the
// WhatsApp bot once those flows exist. qr_location is the only kind still created here, because
// there's no partner/customer to self-serve it in the first place. qr_partner is NOT creatable
// here any more — see "Pre-Print Partner QR Codes" below; a partner code always starts out blank and is
// claimed by the partner themselves, never pre-assigned by admin, so it can be handed out
// before anyone's decided which shop gets which sticker.
function CreateLinkModal({ onClose, onDone }) {
  const [label, setLabel] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const canSave = label.trim().length > 0;

  async function submit() {
    setError(''); setSaving(true);
    try {
      const res = await fetch('/api/admin/attribution', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'qr_location', label }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      onDone(data);
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  return (
    <Modal title="Create a Location QR Code" sub="For a billboard, standee or shop window — tracked by placement, not by partner. Every scan routes into WhatsApp and the resulting chat becomes an attributed lead. Partner QR codes are pre-printed in bulk instead — see “Pre-Print Partner QR Codes”." onClose={onClose}>
      <div className="lf-field"><label className="lf-label">Location label</label><input className="lf-input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder='e.g. "Koramangala Billboard" or "HSR Standee 2"' /></div>

      {error && <div className="lf-error">{error}</div>}
      <div className="lf-actions">
        <button className="lf-btn-back" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="lf-btn-next" onClick={submit} disabled={saving || !canSave}>{saving ? 'Creating…' : 'Create'}</button>
      </div>
    </Modal>
  );
}

// Pre-printed (blank/unclaimed) partner QR codes — admin generates a batch here, prints the
// sheet, and hands one sticker per partner at onboarding. The partner links it to their account
// from the Partner App's Profile → QR Code screen (app/api/partner/attribution/qr) by typing in
// the code printed on it — see lib/attribution.js's createBlankPartnerQrCodes/claimPartnerQrCode.
function BlankQrModal({ onClose }) {
  const { data: unclaimed, loading, refresh } = useApiResource('/api/admin/attribution/blank-qr');
  const [count, setCount] = useState(10);
  const [batchLabel, setBatchLabel] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  async function generate() {
    setError(''); setGenerating(true);
    try {
      const res = await fetch('/api/admin/attribution/blank-qr', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count, batchLabel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setBatchLabel('');
      refresh();
    } catch (e) { setError(e.message); } finally { setGenerating(false); }
  }

  return (
    <Modal
      title="Pre-Print Partner QR Codes"
      sub="Generate a batch of blank partner QR codes to print and hand out — each partner links their own sticker from the Partner App."
      onClose={onClose}
      wide
    >
      <div className="adm-qr-print-noprint">
        <div className="lf-field-row">
          <div className="lf-field">
            <label className="lf-label">How many</label>
            <input className="lf-input" type="number" min={1} max={200} value={count} onChange={(e) => setCount(e.target.value)} />
          </div>
          <div className="lf-field">
            <label className="lf-label">Batch label (optional)</label>
            <input className="lf-input" value={batchLabel} onChange={(e) => setBatchLabel(e.target.value)} placeholder='e.g. "Sep 2026 onboarding run"' />
          </div>
        </div>
        {error && <div className="lf-error">{error}</div>}
        <div className="lf-actions" style={{ marginBottom: 18 }}>
          <button className="adm-btn-primary" onClick={generate} disabled={generating}>{generating ? 'Generating…' : 'Generate Batch'}</button>
          <button className="adm-btn-outline" onClick={() => window.print()} disabled={!unclaimed.length}>Print This Sheet</button>
        </div>
        <div className="adm-meta-hint">
          {loading ? 'Loading unclaimed codes…' : `${unclaimed.length} code${unclaimed.length === 1 ? '' : 's'} generated and not yet claimed by a partner.`}
        </div>
      </div>

      <div className="adm-qr-print-sheet">
        {unclaimed.length === 0 && !loading ? (
          <div className="adm-empty">No unclaimed codes yet — generate a batch above.</div>
        ) : (
          <div className="adm-qr-grid">
            {unclaimed.map((l) => {
              const shareUrl = l.url || `${typeof window !== 'undefined' ? window.location.origin : ''}/go/${l.id}`;
              const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(shareUrl)}`;
              return (
                <div className="adm-qr-tile" key={l.id}>
                  <img src={qrImg} alt={l.id} width={140} height={140} />
                  <div className="adm-qr-tile-code">{l.id}</div>
                  {l.batchLabel && <div className="adm-qr-tile-batch">{l.batchLabel}</div>}
                  {(l.funnel?.visits || 0) > 0 && (
                    <div className="adm-qr-tile-scanned">Scanned {l.funnel.visits}× already — unclaimed</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
