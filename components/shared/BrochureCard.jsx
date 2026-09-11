'use client';
// Shared "Heseos Brochure" card — share the product brochure PDF on WhatsApp, or download a
// copy. Used identically on the Partner App's Dashboard (components/partner/DashboardScreen.jsx)
// and the Team App's Home (components/team/HomeScreen.jsx), same "hp-card with two inline
// actions" pattern as ReferAndEarnScreen's LinkCard (Copy + Share) — this one doesn't need its
// own full screen since there's nothing to browse, just two actions.
//
// The PDF itself lives at public/brochure/heseos-brochure.pdf, so it's a plain static asset —
// no API route, no auth, same as any other file under /public.
//
// Share is text+link only (window.location.origin + the PDF path), same wa.me pattern as
// CatalogueScreen's product share — deliberately NOT fetching the PDF into a Blob/File to
// attach via the Web Share API: this is a ~20MB file, and on a real mobile connection that
// fetch could take a long time (or stall entirely behind a slow/flaky network, or the PWA's own
// service worker, public/sw.js, intercepting the request) — which is exactly what showed up as
// the Share button sticking on "Preparing…" for partners/employees in the field. A link opens
// instantly and the recipient can view or download the actual PDF from it either way.
import { IconWhatsApp, IconDownload, IconQuotation } from '@/components/admin/icons';

const BROCHURE_PATH = '/brochure/heseos-brochure.pdf';
const BROCHURE_NAME = 'Heseos-Brochure.pdf';

export default function BrochureCard() {
  async function share() {
    const url = `${window.location.origin}${BROCHURE_PATH}`;
    const text = `Check out the Heseos product brochure: ${url}`;
    // navigator.share (no files — just title/text/url) opens the native share sheet where
    // supported, same as ReferAndEarnScreen's referral-link share; falls back to a plain wa.me
    // link everywhere else (desktop browsers, unsupported mobile browsers).
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'Heseos Brochure', text, url });
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return; // user cancelled the native share sheet
        // anything else — fall through to the wa.me link below
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
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
        <button type="button" className="hp-btn hp-btn-primary hp-btn-sm" onClick={share}>
          <IconWhatsApp size={14} /> Share
        </button>
        <a className="hp-btn hp-btn-outline hp-btn-sm" href={BROCHURE_PATH} download={BROCHURE_NAME}>
          <IconDownload size={14} /> Download
        </a>
      </div>
    </div>
  );
}
