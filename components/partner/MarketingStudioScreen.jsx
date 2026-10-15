'use client';
// Partner -> Marketing Studio: posters uploaded by Heseos (Admin -> Marketing Studio) that the
// partner shares on WhatsApp / Status. Each poster has a blank band at the bottom; here we write
// "Heseos Partner : <partner name>" into it, then hand the finished image to the phone's share
// sheet together with the partner's own referral link (the same wa.me link as Profile -> Referral
// Link, so any lead it brings in is credited to them).
//
// WhatsApp has no API for posting a Status, so the share sheet is the way in: the partner picks
// WhatsApp -> My Status. A link inside the image itself can't be tapped, which is why the link also
// travels as the caption and is copied to the clipboard (paste it into the Status caption).
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScreenHeader } from './ui';
import { IconShare, IconDownload, IconCopy } from './icons';
import { CREATIVE_CATS } from '@/lib/marketing';
import { drawBranded, loadImage } from '@/lib/marketingCompose';
import { Capacitor, registerPlugin } from '@capacitor/core';

// Native sharing inside the Capacitor app (WhatsApp -> My Status with the image attached).
// registerPlugin only creates a bridge proxy — the native side comes from the @capacitor/share
// and @capacitor/filesystem packages (npm install + `npx cap sync`, then rebuild the app). In an
// app build without them, or in a normal browser, isNativeShareReady() is false and the screen
// falls back to the web share sheet / download.
const NativeShare = registerPlugin('Share');
const NativeFs = registerPlugin('Filesystem');
function isNativeShareReady() {
  try {
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Share') && Capacitor.isPluginAvailable('Filesystem');
  } catch { return false; }
}
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error('read'));
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.readAsDataURL(blob);
  });
}
// Writes the poster to the app cache and opens the native share sheet with it attached.
async function nativeShareImage(blob, name, text) {
  const { uri } = await NativeFs.writeFile({ path: name, data: await blobToBase64(blob), directory: 'CACHE' });
  await NativeShare.share({ title: 'Heseos', text, files: [uri], dialogTitle: 'Share poster' });
}

function captionFor(url) {
  return url
    ? `🏡 Make your home smart with HESEOS!\nMessage us on WhatsApp 👉 ${url}`
    : '🏡 Make your home smart with HESEOS!';
}

export default function MarketingStudioScreen() {
  const [cat, setCat] = useState('all');
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(null);         // creative with .full
  const [loadingFull, setLoadingFull] = useState(false);
  const [partnerName, setPartnerName] = useState('');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState('');
  const [toast, setToast] = useState('');
  const canvasRef = useRef(null);

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2600); };

  useEffect(() => {
    fetch('/api/partner/profile').then((r) => (r.ok ? r.json() : null)).then((p) => { if (p) setPartnerName(p.name || p.businessName || ''); }).catch(() => {});
    fetch('/api/partner/attribution').then((r) => (r.ok ? r.json() : null)).then((d) => { if (d?.referral?.url) setLink(d.referral.url); }).catch(() => {});
  }, []);

  useEffect(() => {
    let alive = true;
    setList(null);
    fetch(`/api/marketing?category=${cat}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { creatives: [] }))
      .then((d) => { if (alive) setList(Array.isArray(d.creatives) ? d.creatives : []); })
      .catch(() => { if (alive) setList([]); });
    return () => { alive = false; };
  }, [cat]);

  async function openCreative(c) {
    setLoadingFull(true);
    try {
      const r = await fetch(`/api/marketing?id=${encodeURIComponent(c.id)}`, { cache: 'no-store' });
      const d = await r.json();
      if (r.ok && d.creative) setOpen(d.creative); else flash('Could not open that poster');
    } catch { flash('Could not open that poster'); }
    setLoadingFull(false);
  }

  // Write the partner's name into the band whenever a poster is open (or the name arrives late).
  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const img = await loadImage(open.full);
        if (document.fonts?.ready) await document.fonts.ready;
        if (cancelled || !canvasRef.current) return;
        drawBranded(canvasRef.current, img, open, partnerName || 'Your Name');
      } catch { flash('Could not draw the poster'); }
    })();
    return () => { cancelled = true; };
  }, [open, partnerName]);

  const toBlob = () => new Promise((res, rej) => canvasRef.current.toBlob((b) => (b ? res(b) : rej(new Error('export'))), 'image/jpeg', 0.92));
  const fileName = () => `Heseos-${String(open?.title || 'poster').replace(/[^\w]+/g, '-')}.jpg`;
  const track = (kind) => {
    if (open) fetch('/api/marketing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'track', id: open.id, kind }) }).catch(() => {});
  };

  async function copyLink() {
    if (!link) { flash('Your link is still being set up'); return false; }
    try { await navigator.clipboard.writeText(link); flash('Referral link copied'); return true; }
    catch { flash('Could not copy — open Profile → Referral Link'); return false; }
  }

  function saveFile(blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName();
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  async function download() {
    setBusy('download');
    try {
      const blob = await toBlob();
      if (isNativeShareReady()) {
        // A WebView can't save files by itself — the share sheet is where "Save Image" / Files live.
        await nativeShareImage(blob, fileName(), '');
      } else {
        saveFile(blob);
        flash('Poster saved');
      }
      track('download');
    } catch (e) {
      if (!e || !/cancel|dismiss/i.test(String(e.message || e))) flash('Could not save the poster');
    }
    setBusy('');
  }

  async function share() {
    setBusy('share');
    try {
      const blob = await toBlob();
      const file = new File([blob], fileName(), { type: 'image/jpeg' });
      const text = captionFor(link);
      if (isNativeShareReady()) {
        if (link) { try { await navigator.clipboard.writeText(link); } catch { /* optional */ } }
        await nativeShareImage(blob, fileName(), text);
        track('share');
      } else if (navigator.canShare && navigator.canShare({ files: [file] })) {
        // Copy first so the link is on the clipboard for the Status caption, whatever the app does with `text`.
        if (link) { try { await navigator.clipboard.writeText(link); } catch { /* optional */ } }
        await navigator.share({ files: [file], text });
        track('share');
      } else {
        // No file sharing here (e.g. desktop browser / older WebView): save it, then open WhatsApp with the caption.
        saveFile(blob);
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
        track('share');
        flash('Poster saved — attach it in WhatsApp');
      }
    } catch (e) {
      const cancelled = e && (e.name === 'AbortError' || /cancel|dismiss/i.test(String(e.message || e)));
      if (!cancelled) flash('Could not share — try Download instead');
    }
    setBusy('');
  }

  const back = useCallback(() => setOpen(null), []);

  return (
    <>
      <ScreenHeader title="Marketing Studio" backHref={open ? undefined : '/partner/home'} onBack={open ? back : undefined} />

      {!open ? (
        <>
          <div style={{ padding: '0 20px 14px', fontSize: 12.5, color: 'var(--hp-text-soft)', lineHeight: 1.5 }}>
            Ready-made posters with your name added automatically. Tap one, then share it on WhatsApp or your Status — your referral link goes with it.
          </div>
          <div className="hp-tabs">
            {CREATIVE_CATS.map((c) => (
              <button key={c.k} type="button" className={`hp-tab${cat === c.k ? ' active' : ''}`} onClick={() => setCat(c.k)}>{c.label}</button>
            ))}
          </div>

          {(list === null || loadingFull) && <div className="hp-empty"><div className="hp-empty-sub">Loading…</div></div>}
          {list && list.length === 0 && (
            <div className="hp-empty">
              <div className="hp-empty-title">No posters here yet</div>
              <div className="hp-empty-sub">New posters are added regularly — check back soon.</div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, padding: '0 20px 24px' }}>
            {(list || []).map((c) => (
              <button key={c.id} type="button" onClick={() => openCreative(c)} style={{ background: 'var(--hp-surface)', border: '1px solid var(--hp-border)', borderRadius: 'var(--hp-r)', padding: 0, overflow: 'hidden', cursor: 'pointer', textAlign: 'left' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.thumb} alt={c.title} style={{ width: '100%', display: 'block' }} />
                <div style={{ padding: '9px 11px' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title}</div>
                </div>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div style={{ padding: '0 20px 28px' }}>
          <div style={{ background: 'var(--hp-surface)', border: '1px solid var(--hp-border)', borderRadius: 'var(--hp-r-lg)', padding: 10, marginBottom: 14 }}>
            <canvas ref={canvasRef} style={{ width: '100%', display: 'block', borderRadius: 10 }} />
          </div>

          {!partnerName && <div style={{ fontSize: 12, color: 'var(--hp-warn)', marginBottom: 12 }}>Loading your name…</div>}

          <button type="button" className="hp-btn hp-btn-primary hp-btn-block" onClick={share} disabled={!!busy} style={{ marginBottom: 10 }}>
            <IconShare size={18} /> {busy === 'share' ? 'Preparing…' : 'Share on WhatsApp / Status'}
          </button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="hp-btn hp-btn-outline" onClick={download} disabled={!!busy} style={{ flex: 1 }}><IconDownload size={17} /> Download</button>
            <button type="button" className="hp-btn hp-btn-outline" onClick={copyLink} disabled={!!busy} style={{ flex: 1 }}><IconCopy size={17} /> Copy link</button>
          </div>

          <div style={{ fontSize: 11.5, color: 'var(--hp-text-faint)', textAlign: 'center', marginTop: 14, lineHeight: 1.55 }}>
            To post as your Status: share → WhatsApp → <b>My Status</b>. Your referral link is copied — paste it in the Status caption so people can tap it.
          </div>
        </div>
      )}

      {toast && <div className="hp-toast">{toast}</div>}
    </>
  );
}
