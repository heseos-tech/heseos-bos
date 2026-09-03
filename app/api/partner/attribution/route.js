// Partner self-service QR code + referral link — GET auto-provisions both on first visit (see
// lib/attribution.js's getOrCreatePartnerLink) so a partner never has to ask an admin for their
// code, matching the rest of this platform's self-service pattern. Returns both links with
// their live funnel and a shareable URL: a direct https://wa.me/<number>?text=...(ref:<code>)
// link straight into Heseos Buddy whenever WhatsApp is connected and verified (buildWaLink,
// lib/attribution.js) — no intermediate page, so scanning/tapping opens WhatsApp immediately
// instead of bouncing through our own domain first. Falls back to the tracked
// https://<domain>/go/<code> redirector (which shows a friendly "not connected yet" message)
// only when WhatsApp isn't connected — that page is what actually resolves once it is, so this
// fallback is never a dead end. Losing the tracked /go/ hop for the normal case only drops the
// raw scan/click count — leads and conversions still attribute correctly either way, since
// that's carried by the (ref:<code>) tag in the message text itself, not by hitting our server.
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
  const [qr, referral, tenant] = await Promise.all([
    getOrCreatePartnerLink(partner.id, 'qr_partner', label),
    getOrCreatePartnerLink(partner.id, 'referral_partner', label),
    getHeseosBotTenant(),
  ]);
  const [qrFunnel, referralFunnel] = await Promise.all([funnelFor(qr.id), funnelFor(referral.id)]);

  const base = baseUrl();
  const fallback = (code) => (base ? `${base}/go/${code}` : null);
  const linkUrl = (code) => (tenant ? buildWaLink(tenant, code) : null) || fallback(code);

  return Response.json({
    baseUrl: base,
    qr: { ...qr, url: linkUrl(qr.id), funnel: qrFunnel },
    referral: { ...referral, url: linkUrl(referral.id), funnel: referralFunnel },
  });
}
