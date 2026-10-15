'use client';
// Admin -> Marketing Studio: upload posters for partners to share (same idea as MARG's Marketing
// Studio). Every poster needs a blank band along the bottom — the Partner app writes
// "Heseos Partner : <partner name>" into it, then the partner shares the finished image together
// with their own referral link. Hide/Delete and share/download counters live on the grid.
import { useCallback, useEffect, useRef, useState } from 'react';
import { StatCard } from './ui';
import { IconImage, IconDownload, IconEye, IconTrash, IconUpload } from './icons';
import { CREATIVE_CAT_KEYS, catLabel, BAND_MIN, BAND_MAX, BAND_DEFAULT, TEXT_LIGHT, TEXT_DARK } from '@/lib/marketing';
import { drawBranded, loadImage, fileToJpegDataUrl } from '@/lib/marketingCompose';

const URL_ = '/api/marketing';
const MAX_UPLOAD_MB = 15;
const FULL_MAX_CHARS = 3_300_000; // keep under the server's limit with headroom

const EMPTY = { full: '', thumb: '', title: '', category: CREATIVE_CAT_KEYS[0], bandPct: BAND_DEFAULT, textColor: TEXT_LIGHT, accent: true };

// Re-encode until the data URL fits what the server accepts.
async function packFull(file) {
  let dim = 1920;
  let q = 0.88;
  for (let i = 0; i < 6; i++) {
    const out = await fileToJpegDataUrl(file, dim, q);
    if (out.length <= FULL_MAX_CHARS) return out;
    q -= 0.08;
    if (q < 0.6) { q = 0.8; dim = Math.round(dim * 0.8); }
  }
  throw new Error('Image is too large — try a smaller file');
}

export default function MarketingStudioPage() {
  const [rows, setRows] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const fileRef = useRef(null);
  const canvasRef = useRef(null);
  const imgRef = useRef(null);

  const load = useCallback(() => {
    fetch(`${URL_}?admin=1`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { creatives: [] }))
      .then((d) => setRows(Array.isArray(d.creatives) ? d.creatives : []))
      .catch(() => setRows([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  function flash(msg) { setNotice(msg); setTimeout(() => setNotice(''), 3000); }
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  // Live preview: the poster with a sample partner name in the band.
  useEffect(() => {
    if (!form.full || !canvasRef.current) return undefined;
    let cancelled = false;
    (async () => {
      try {
        if (!imgRef.current || imgRef.current.src !== form.full) imgRef.current = await loadImage(form.full);
        if (cancelled || !canvasRef.current) return;
        if (document.fonts?.ready) await document.fonts.ready;
        drawBranded(canvasRef.current, imgRef.current, form, 'Rahul Sharma');
      } catch { /* preview only */ }
    })();
    return () => { cancelled = true; };
  }, [form]);

  async function onPick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { setError('Please choose a JPG or PNG image.'); return; }
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) { setError(`That file is over ${MAX_UPLOAD_MB} MB — please use a smaller one.`); return; }
    try {
      setBusy(true);
      const [full, thumb] = await Promise.all([packFull(file), fileToJpegDataUrl(file, 420, 0.72)]);
      imgRef.current = null;
      set({ full, thumb, title: form.title || file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').slice(0, 80) });
    } catch (err) {
      setError(err.message || 'Could not process that image');
    } finally { setBusy(false); }
  }

  async function publish() {
    setError('');
    if (!form.full) { setError('Upload an image first.'); return; }
    if (!form.title.trim()) { setError('Give the creative a title.'); return; }
    setBusy(true);
    try {
      const res = await fetch(URL_, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Could not publish');
      setForm({ ...EMPTY, category: form.category });
      imgRef.current = null;
      load();
      flash('Creative published — partners can see it now');
    } catch (err) { setError(err.message); }
    setBusy(false);
  }

  async function act(id, action) {
    if (action === 'delete' && !window.confirm('Delete this creative permanently?')) return;
    await fetch(URL_, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, id }) });
    load();
  }

  const list = rows || [];
  const totalShares = list.reduce((a, c) => a + (c.shares || 0), 0);
  const totalDownloads = list.reduce((a, c) => a + (c.downloads || 0), 0);

  return (
    <>
      <div className="adm-page-head">
        <div>
          <h1 className="adm-h1">Marketing Studio</h1>
          <p className="adm-page-sub">Upload creatives for partners to share. Leave a blank band at the bottom of each image — each partner&rsquo;s name (&ldquo;Heseos Partner : name&rdquo;) is placed there automatically, and their referral link goes out with it.</p>
        </div>
      </div>

      {notice && <div className="adm-notice">{notice}</div>}

      <div className="adm-stat-row">
        <StatCard label="Creatives" value={list.length} Icon={IconImage} tone="orange" />
        <StatCard label="Total Shares" value={totalShares} Icon={IconUpload} tone="green" />
        <StatCard label="Total Downloads" value={totalDownloads} Icon={IconDownload} tone="purple" />
      </div>

      <div className="mk-layout">
        <div className="adm-card mk-form">
          <div className="adm-card-title">New creative</div>
          <div className="adm-card-sub">JPG or PNG. Story size (1080 × 1920) works best.</div>

          <div className="lf-field">
            <label className="lf-label">Image</label>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onPick} hidden />
            <button type="button" className="adm-btn-outline" onClick={() => fileRef.current?.click()} disabled={busy}><IconUpload size={15} /> {form.full ? 'Choose a different image' : 'Choose image'}</button>
          </div>

          {form.full && (
            <div className="mk-preview">
              <canvas ref={canvasRef} />
              <div className="mk-preview-note">Preview with a sample partner name</div>
            </div>
          )}

          <div className="lf-field-row">
            <div className="lf-field">
              <label className="lf-label">Category</label>
              <select className="lf-input" value={form.category} onChange={(e) => set({ category: e.target.value })}>
                {CREATIVE_CAT_KEYS.map((k) => <option key={k} value={k}>{catLabel(k)}</option>)}
              </select>
            </div>
            <div className="lf-field">
              <label className="lf-label">Title</label>
              <input className="lf-input" value={form.title} maxLength={80} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Diwali Door Lock Offer" />
            </div>
          </div>

          <div className="lf-field" style={{ marginTop: 16 }}>
            <label className="lf-label">Band height — {form.bandPct}% of the image</label>
            <input type="range" min={BAND_MIN} max={BAND_MAX} step="0.5" value={form.bandPct} onChange={(e) => set({ bandPct: Number(e.target.value) })} style={{ width: '100%' }} />
          </div>

          <div className="lf-field">
            <label className="lf-label">Text colour</label>
            <div className="mk-seg">
              <button type="button" className={form.textColor === TEXT_LIGHT ? 'on' : ''} onClick={() => set({ textColor: TEXT_LIGHT })}>White</button>
              <button type="button" className={form.textColor === TEXT_DARK ? 'on' : ''} onClick={() => set({ textColor: TEXT_DARK })}>Dark</button>
            </div>
          </div>

          <label className="mk-check">
            <input type="checkbox" checked={form.accent} onChange={(e) => set({ accent: e.target.checked })} />
            Show the partner&rsquo;s name in Heseos orange
          </label>

          {error && <div className="lf-error" style={{ marginTop: 12 }}>{error}</div>}
          <button type="button" className="adm-btn-primary mk-publish" onClick={publish} disabled={busy || !form.full}>{busy ? 'Working…' : 'Publish creative'}</button>
        </div>

        <div className="mk-published">
          <div className="adm-card-title" style={{ marginBottom: 12 }}>Published</div>
          {rows === null && <div className="adm-empty">Loading…</div>}
          {rows && list.length === 0 && <div className="adm-card"><div className="adm-empty">No creatives yet — upload your first one.</div></div>}
          <div className="mk-grid">
            {list.map((c) => (
              <div key={c.id} className={`mk-card${c.active === false ? ' hidden' : ''}`}>
                <div className="mk-thumb">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.thumb} alt={c.title} />
                  {c.active === false && <span className="mk-hidden-tag">Hidden</span>}
                </div>
                <div className="mk-meta">
                  <div className="mk-title" title={c.title}>{c.title}</div>
                  <div className="mk-cat">{catLabel(c.category)}</div>
                  <div className="mk-counts"><span><IconUpload size={12} /> {c.shares || 0}</span><span><IconDownload size={12} /> {c.downloads || 0}</span></div>
                  <div className="mk-actions">
                    <button type="button" className="adm-chip-btn" onClick={() => act(c.id, 'toggle')}><IconEye size={12} /> {c.active === false ? 'Show' : 'Hide'}</button>
                    <button type="button" className="adm-chip-btn mk-del" onClick={() => act(c.id, 'delete')}><IconTrash size={12} /> Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
