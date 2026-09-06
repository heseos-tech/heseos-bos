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
import { IconQrCode, IconLink, IconLeads, IconConversions, IconSearch, IconPlus, IconDownload, IconTrash } from './icons';

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
  if (l.kind === 'qr_location') {
    const area = [l.locality, l.city, l.pincode].filter(Boolean).join(', ');
    return area ? `${l.label || '—'} — ${area}` : (l.label || '—');
  }
  return l.customerName || l.label || '—';
}

export default function GrowthPage() {
  const { data: links, loading, refresh } = useApiResource('/api/admin/attribution', { pollMs: 20000 });
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
          <button className="adm-btn-outline" onClick={() => setModal({ type: 'print-location-qr' })}><IconDownload size={15} /> Pre-Print Location QR Codes</button>
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
        <CreateLinkModal
          onClose={() => setModal(null)}
          onDone={(links) => {
            if (links.length === 1) {
              setModal({ type: 'view', link: { ...links[0], funnel: { visits: 0, leads: 0, converted: 0 } } });
            } else {
              setModal(null);
            }
            flash(links.length === 1 ? 'Link created' : `${links.length} location QR codes created`);
            refresh();
          }}
        />
      )}
      {modal?.type === 'view' && <LinkDetailModal link={modal.link} onClose={() => setModal(null)} onCopied={() => flash('Link copied')} />}
      {modal?.type === 'blank-qr' && <BlankQrModal onClose={() => setModal(null)} />}
      {modal?.type === 'print-location-qr' && <PrintLocationQrModal links={links} onClose={() => setModal(null)} />}
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
        {link.kind === 'qr_location' && <div><span className="adm-detail-label">City</span>{link.city || '—'}</div>}
        {link.kind === 'qr_location' && <div><span className="adm-detail-label">Locality</span>{link.locality || '—'}</div>}
        {link.kind === 'qr_location' && <div><span className="adm-detail-label">Pincode</span>{link.pincode || '—'}</div>}
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
const PINCODE_RE = /^\d{6}$/;
function emptyLocationRow() { return { label: '', city: '', locality: '', pincode: '' }; }

// One row per location — every location QR needs a label (what it's called on the table/print
// sheet) plus city, locality and pincode (so a placement can be reported on by area, not just by
// its own name). "Add another location" lets admin create a whole batch (e.g. every standee
// going out this week) in one save instead of reopening this modal per location.
function CreateLinkModal({ onClose, onDone }) {
  const [rows, setRows] = useState([emptyLocationRow()]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function updateRow(i, field, value) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  }
  function addRow() { setRows((rs) => [...rs, emptyLocationRow()]); }
  function removeRow(i) { setRows((rs) => rs.filter((_, idx) => idx !== i)); }

  const canSave = rows.length > 0 && rows.every((r) => r.label.trim() && r.city.trim() && r.locality.trim() && PINCODE_RE.test(r.pincode.trim()));

  async function submit() {
    setError(''); setSaving(true);
    try {
      const res = await fetch('/api/admin/attribution', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'qr_location', locations: rows.map((r) => ({ label: r.label.trim(), city: r.city.trim(), locality: r.locality.trim(), pincode: r.pincode.trim() })) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      onDone(data);
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  return (
    <Modal title="Create Location QR Codes" sub="For a billboard, standee or shop window — tracked by placement, not by partner. Every scan routes into WhatsApp and the resulting chat becomes an attributed lead. Partner QR codes are pre-printed in bulk instead — see “Pre-Print Partner QR Codes”." onClose={onClose} wide>
      <div className="adm-qrloc-col-headers"><span>Location label</span><span>City</span><span>Locality</span><span>Pincode</span></div>
      <div className="adm-qrloc-rows">
        {rows.map((r, i) => (
          <div className="adm-qrloc-row" key={i}>
            <input
              className="lf-input adm-qrloc-label-input"
              value={r.label}
              onChange={(e) => updateRow(i, 'label', e.target.value)}
              placeholder='e.g. "Koramangala Billboard"'
            />
            <input
              className="lf-input adm-qrloc-city-input"
              value={r.city}
              onChange={(e) => updateRow(i, 'city', e.target.value)}
              placeholder="Bengaluru"
            />
            <input
              className="lf-input adm-qrloc-locality-input"
              value={r.locality}
              onChange={(e) => updateRow(i, 'locality', e.target.value)}
              placeholder="Koramangala 4th Block"
            />
            <input
              className="lf-input adm-qrloc-pincode-input"
              value={r.pincode}
              onChange={(e) => updateRow(i, 'pincode', e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
              placeholder="560034"
              inputMode="numeric"
              maxLength={6}
            />
            <button
              type="button"
              className="adm-tier-remove"
              aria-label="Remove location"
              onClick={() => removeRow(i)}
              disabled={rows.length === 1}
              style={rows.length === 1 ? { visibility: 'hidden' } : undefined}
            >
              <IconTrash size={13} />
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="adm-payout-add-tier" onClick={addRow}>+ Add another location</button>

      {error && <div className="lf-error">{error}</div>}
      <div className="lf-actions">
        <button className="lf-btn-back" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="lf-btn-next" onClick={submit} disabled={saving || !canSave}>
          {saving ? 'Creating…' : rows.length > 1 ? `Create ${rows.length} QR Codes` : 'Create'}
        </button>
      </div>
    </Modal>
  );
}

// Pre-printed (blank/unclaimed) partner QR codes — admin generates a batch here, prints the
// sheet, and hands one sticker per partner at onboarding. The partner links it to their account
// from the Partner App's Profile → QR Code screen (app/api/partner/attribution/qr) by typing in
// the code printed on it — see lib/attribution.js's createBlankPartnerQrCodes/claimPartnerQrCode.
function BlankQrModal({ onClose }) {
  const { data: unclaimed, loading, refresh } = useApiResource('/api/admin/attribution/blank-qr', { pollMs: 20000 });
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

// Pre-printed LOCATION QR codes — every qr_location link already created via "Create Location
// QR" (billboards, standees, shop windows), laid out on one print sheet at a consistent
// physical size. Unlike BlankQrModal above (which generates fresh blank/unclaimed codes),
// nothing is created here — this only prints codes that already exist, each labelled with its
// location name so a batch of stickers can be told apart once they're off the sheet.
//
// QR_SIZE_OPTIONS are physical inches (square tiles) and SHEET_SIZES are physical mm — both
// render as real CSS `in`/`mm` units, so what you see on screen is a good approximation of what
// prints, and the flex-wrap flow container just lets the browser's own print pagination add
// further sheets once a page's worth of tiles is full — no manual per-page math needed.
const QR_SIZE_OPTIONS_IN = [1, 1.5, 2, 2.5, 3, 4];
const SHEET_SIZES_MM = {
  a4: { label: 'A4 (210 × 297 mm)', w: 210, h: 297 },
  a5: { label: 'A5 (148 × 210 mm)', w: 148, h: 210 },
  letter: { label: 'Letter (8.5 × 11 in)', w: 215.9, h: 279.4 },
  legal: { label: 'Legal (8.5 × 14 in)', w: 215.9, h: 355.6 },
};
const PRINT_MARGIN_MM = 10;
const MM_PER_IN = 25.4;

function PrintLocationQrModal({ links, onClose }) {
  const [qrSizeIn, setQrSizeIn] = useState(2);
  const [sheetKey, setSheetKey] = useState('a4');

  const locations = useMemo(() => links.filter((l) => l.kind === 'qr_location'), [links]);
  const sheet = SHEET_SIZES_MM[sheetKey];

  // Rough "how many fit per sheet" hint — the browser's own print layout is the real source of
  // truth (see the CSS comment above), this is just so the admin can sanity-check a size choice
  // before printing 40 sheets by mistake.
  const perSheet = useMemo(() => {
    const printableWIn = (sheet.w - PRINT_MARGIN_MM * 2) / MM_PER_IN;
    const printableHIn = (sheet.h - PRINT_MARGIN_MM * 2) / MM_PER_IN;
    const cols = Math.max(1, Math.floor(printableWIn / qrSizeIn));
    const rows = Math.max(1, Math.floor(printableHIn / qrSizeIn));
    return cols * rows;
  }, [sheet, qrSizeIn]);

  return (
    <Modal
      title="Pre-Print Location QR Codes"
      sub="Every location QR code you've created so far, printed at one consistent size with its location name underneath."
      onClose={onClose}
      wide
    >
      <div className="adm-qr-print-noprint">
        <div className="lf-field-row">
          <div className="lf-field">
            <label className="lf-label">QR code size</label>
            <select className="lf-input" value={qrSizeIn} onChange={(e) => setQrSizeIn(Number(e.target.value))}>
              {QR_SIZE_OPTIONS_IN.map((s) => <option key={s} value={s}>{s}&quot; × {s}&quot;</option>)}
            </select>
          </div>
          <div className="lf-field">
            <label className="lf-label">Sheet size</label>
            <select className="lf-input" value={sheetKey} onChange={(e) => setSheetKey(e.target.value)}>
              {Object.entries(SHEET_SIZES_MM).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        </div>
        <div className="lf-actions" style={{ marginBottom: 18 }}>
          <button className="adm-btn-primary" onClick={() => window.print()} disabled={!locations.length}>Print This Sheet</button>
        </div>
        <div className="adm-meta-hint">
          {locations.length === 0
            ? 'No location QR codes yet — use "Create Location QR" first.'
            : `${locations.length} location QR code${locations.length === 1 ? '' : 's'} · about ${perSheet} per ${sheet.label.split(' (')[0]} sheet at this size · ${Math.ceil(locations.length / perSheet)} sheet${Math.ceil(locations.length / perSheet) === 1 ? '' : 's'} total`}
        </div>
      </div>

      {/* Sets the actual paper size/margins for the print job itself — independent of whatever
          default the browser's print dialog would otherwise use. */}
      <style>{`@page { size: ${sheet.w}mm ${sheet.h}mm; margin: ${PRINT_MARGIN_MM}mm; }`}</style>

      <div className="adm-qr-print-sheet">
        {locations.length === 0 ? (
          <div className="adm-empty">No location QR codes yet.</div>
        ) : (
          <div className="adm-qr-print-flow">
            {locations.map((l) => {
              const shareUrl = l.url || `${typeof window !== 'undefined' ? window.location.origin : ''}/go/${l.id}`;
              // Request enough source pixels for a crisp print at ~300dpi at the chosen size,
              // capped at the QR API's max — CSS then scales the image down to the exact
              // physical tile size, never up.
              const px = Math.min(1000, Math.round(qrSizeIn * 300));
              const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=${px}x${px}&data=${encodeURIComponent(shareUrl)}`;
              const area = [l.locality, l.city].filter(Boolean).join(', ');
              return (
                <div className="adm-qr-print-tile" style={{ width: `${qrSizeIn}in` }} key={l.id}>
                  <img src={qrImg} alt={l.label || l.id} />
                  <div className="adm-qr-print-tile-name">{l.label || l.id}</div>
                  {area && <div className="adm-qr-print-tile-area">{area}</div>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
