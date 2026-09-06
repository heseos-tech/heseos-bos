// Partner self-service referral link — GET auto-provisions it on first visit (see
// lib/attribution.js's getOrCreatePartnerLink) so a partner never has to ask an admin for their
// link, matching the rest of this platform's self-service pattern. Returns the link with its
// live funnel and a shareable URL: a direct https://wa.me/<number>?text=...(ref:<code>) link
// straight into Heseos Buddy whenever WhatsApp is connected and verified (buildWaLink,
// lib/attribution.js) — no intermediate page, so tapping opens WhatsApp immediately instead of
// bouncing through our own domain first. Falls back to the tracked https://<domain>/go/<code>
// redirector (which shows a friendly "not connected yet" message) only when WhatsApp isn't
// connected — that page is what actually resolves once it is, so this fallback is never a dead
// end. Losing the tracked /go/ hop for the normal case only drops the raw click count — leads
// and conversions still attribute correctly either way, since that's carried by the (ref:<code>)
// tag in the message text itself, not by hitting our server.
//
// A partner's QR code is no longer self-generated here — partners are handed a pre-printed QR
// code at onboarding instead (see lib/attribution.js), so this route only covers the referral
// link half of what used to be "Share & Earn".
import { getPartner } from '@/lib/auth';
import { getOrCreatePartnerLink, funnelFor, getHeseosBotTenant, buildWaLink } from '@/lib/attribution';

export const dynamic = 'force-dynamic';

function baseUrl() {
  const raw = process.env.PUBLIC_BASE_URL || '';
  return raw ? raw.replace(/\/$/, '') : '';
}

export async function GET() {
  const partner = await getPartner();
  if (!partner) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const label = partner.businessName || partner.name || partner.id;
  const [referral, tenant] = await Promise.all([
    getOrCreatePartnerLink(partner.id, 'referral_partner', label),
    getHeseosBotTenant(),
  ]);
  const referralFunnel = await funnelFor(referral.id);

  const base = baseUrl();
  const fallback = (code) => (base ? `${base}/go/${code}` : null);
  const linkUrl = (code) => (tenant ? buildWaLink(tenant, code) : null) || fallback(code);

  return Response.json({
    baseUrl: base,
    referral: { ...referral, url: linkUrl(referral.id), funnel: referralFunnel },
  });
}
