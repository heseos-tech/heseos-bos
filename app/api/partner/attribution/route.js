// Partner self-service referral link — GET auto-provisions it on first visit (see
// lib/attribution.js's getOrCreatePartnerLink) so a partner never has to ask an admin for their
// link, matching the rest of this platform's self-service pattern. Returns the link with its
// live funnel and a shareable URL: always the tracked https://<domain>/go/<code> redirector
// (trackedLinkUrl, lib/attribution.js), which logs the scan/click (recordVisit) and then
// redirects into WhatsApp in one near-instant hop — so every tap/scan counts toward the funnel,
// not just the ones that go on to become a completed lead. Falls back to a direct
// https://wa.me/<number>?text=...(ref:<code>) link only when PUBLIC_BASE_URL isn't configured.
//
// A partner's QR code is no longer self-generated here — partners are handed a pre-printed QR
// code at onboarding instead (see lib/attribution.js), so this route only covers the referral
// link half of what used to be "Share & Earn".
import { getPartner } from '@/lib/auth';
import { getOrCreatePartnerLink, funnelFor, getHeseosBotTenant, trackedLinkUrl, resolvePublicBaseUrl } from '@/lib/attribution';

export const dynamic = 'force-dynamic';

export async function GET() {
  const partner = await getPartner();
  if (!partner) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const label = partner.shopName || partner.businessName || partner.name || partner.id;
  const [referral, tenant] = await Promise.all([
    getOrCreatePartnerLink(partner.id, 'referral_partner', label),
    getHeseosBotTenant(),
  ]);
  const referralFunnel = await funnelFor(referral.id);

  const base = resolvePublicBaseUrl();

  return Response.json({
    baseUrl: base,
    referral: { ...referral, url: trackedLinkUrl(tenant, referral.id), funnel: referralFunnel },
  });
}
