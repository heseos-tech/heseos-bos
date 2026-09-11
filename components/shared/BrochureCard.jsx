'use client';
// Shared "Heseos Brochure" card — share the product brochure PDF on WhatsApp, or download a
// copy. Used identically on the Partner App's Dashboard (components/partner/DashboardScreen.jsx)
// and the Team App's Home (components/team/HomeScreen.jsx), same "hp-card with two inline
// actions" pattern as ReferAndEarnScreen's LinkCard (Copy + Share) — this one doesn't need its
// own full screen since there's nothing to browse, just two actions.
//
// The PDF itself lives at public/brochure/heseos-brochure.pdf, so it's a plain static asset —
// no API route, no auth, same as any other file under /public.
import { useState } from 'react';
import { IconWhatsApp, IconDownload, IconQuotation } from '@/components/admin/icons';

const BROCHURE_PATH = '/brochure/heseos-brochure.pdf';
const BROCHURE_NAME = 'Heseos-Brochure.pdf';

export default function BrochureCard() {
  const [sharing, setSharing] = useState(false);

  async function share() {
    if (sharing) return;
    setSharing(true);
    try {
      const url = `${window.location.origin}${BROCHURE_PATH}`;
      // Prefer attaching the actual PDF via the native share sheet — WhatsApp then shows it as
      // a real file the recipient can open right in the chat, not just a link they have to tap.
      // Falls back to a plain wa.me text+link share wherever file sharing isn't supported
      // (desktop browsers, older mobile browsers) — same wa.me pattern as CatalogueScreen's
      // product share and lib/attribution.js's buildWaLink.
      if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
        try {
          const res = await fetch(BROCHURE_PATH);
          const blob = await res.blob();
          const file = new File([blob], BROCHURE_NAME, { type: 'application/pdf' });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: 'Heseos Brochure', text: 'Heseos — smart home, office & hospitality automation' });
            return;
          }
        } catch (err) {
          if (err?.name === 'AbortError') return; // user cancelled the native share sheet
          // anything else (fetch failure, no file-share support) — fall through to the link below
        }
      }
      const text = `Check out the Heseos product brochure: ${url}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="hp-card">
      <div className="hp-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <IconQuotation size={17} /> Heseos Brochure
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--hp-text-soft)', lineHeight: 1.5, marginBottom: 12 }}>
        Share the product brochure with a customer on WhatsApp, or keep a copy for yourself.
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="hp-btn hp-btn-primary" style={{ flex: 1 }} onClick={share} disabled={sharing}>
          <IconWhatsApp size={16} /> {sharing ? 'Preparing…' : 'Share'}
        </button>
        <a className="hp-btn hp-btn-outline" style={{ flex: 1 }} href={BROCHURE_PATH} download={BROCHURE_NAME}>
          <IconDownload size={16} /> Download
        </a>
      </div>
    </div>
  );
}
