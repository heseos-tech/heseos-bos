// Partner self-service QR code + referral link — GET auto-provisions both on first visit (see
// lib/attribution.js's getOrCreatePartnerLink) so a partner never has to ask an admin for their
// code, matching the rest of this platform's self-service pattern. Returns both links with
// their live funnel and the base URL to build a shareable https://<domain>/go/<code> from.

import { getPartner } from '@/lib/auth';
import { getOrCreatePartnerLink, funnelFor } from '@/lib/attribution';

export const dynamic = 'force-dynamic';

function baseUrl() {
  const raw = process.env.PUBLIC_BASE_URL || '';
  return raw ? raw.replace(/\/$/, '') : '';
}

export async function GET() {
  const partner = await getPartner();
  if (!partner) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const label = partner.businessName || partner.name || partner.id;
  const [qr, referral] = await Promise.all([
    getOrCreatePartnerLink(partner.id, 'qr_partner', label),
    getOrCreatePartnerLink(partner.id, 'referral_partner', label),
  ]);
  const [qrFunnel, referralFunnel] = await Promise.all([funnelFor(qr.id), funnelFor(referral.id)]);

  const base = baseUrl();
  return Response.json({
    baseUrl: base,
    qr: { ...qr, url: base ? `${base}/go/${qr.id}` : null, funnel: qrFunnel },
    referral: { ...referral, url: base ? `${base}/go/${referral.id}` : null, funnel: referralFunnel },
  });
}
