// Partner-facing QR codes — the "on the spot" configuration step from onboarding. A partner is
// handed a pre-printed QR sticker (see app/api/admin/attribution/blank-qr and
// lib/attribution.js's createBlankPartnerQrCodes) and types the code printed on it here to link
// it to their account; scans of that code are credited to them from that point on exactly like
// a lead they punched themselves (app/api/leads/route.js's partner-scoped GET), same as the
// referral link in app/api/partner/attribution/route.js.
//
// GET  — every qr_partner code this partner has already claimed, with live funnel stats.
// POST — claim a code by its printed value (body: { code }).
import { getPartner } from '@/lib/auth';
import { claimPartnerQrCode, funnelForAll, getHeseosBotTenant, trackedLinkUrl } from '@/lib/attribution';
import { dbWhere } from '@/lib/db';
import { notifyHeseosPartnerQrClaimed } from '@/lib/heseosNotify';

export const dynamic = 'force-dynamic';

function baseUrl() {
  const raw = process.env.PUBLIC_BASE_URL || '';
  return raw ? raw.replace(/\/$/, '') : '';
}

// Always the tracked /go/<code> redirector (trackedLinkUrl) so every scan of a partner's
// printed sticker is logged before the near-instant redirect into WhatsApp — see
// app/api/admin/attribution/route.js for the full rationale.
function linkUrlFor(tenant, code) {
  return trackedLinkUrl(tenant, code);
}

async function withUrlsAndFunnels(links, tenant) {
  const funnels = await funnelForAll(links.map((l) => l.id));
  return links.map((l) => ({
    ...l,
    url: linkUrlFor(tenant, l.id),
    funnel: funnels.get(l.id) || { visits: 0, leads: 0, converted: 0 },
  }));
}

export async function GET() {
  const partner = await getPartner();
  if (!partner) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const [links, tenant] = await Promise.all([
    dbWhere('attribution_links', 'partnerId', partner.id),
    getHeseosBotTenant(),
  ]);
  const qrLinks = links.filter((l) => l.kind === 'qr_partner' && l.active !== false);
  qrLinks.sort((a, b) => (b.claimedAt || b.createdAt || '').localeCompare(a.claimedAt || a.createdAt || ''));
  return Response.json({ baseUrl: baseUrl(), codes: await withUrlsAndFunnels(qrLinks, tenant) });
}

export async function POST(request) {
  const partner = await getPartner();
  if (!partner) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  try {
    const link = await claimPartnerQrCode(body.code, partner);
    const tenant = await getHeseosBotTenant();
    const [withData] = await withUrlsAndFunnels([link], tenant);

    // Same first-touch condition claimPartnerQrCode itself uses to decide whether to record
    // partner.onboardedByEmployeeId — `partner` here is still the PRE-claim record (fetched at
    // the top of this request), so `!partner.onboardedByEmployeeId` correctly reflects whether
    // this claim is the one that just set it. Fire-and-forget: never let a WhatsApp hiccup fail
    // a claim that already succeeded (see notifyHeseosPartnerQrClaimed's own header comment).
    if (link.employeeId && !partner.onboardedByEmployeeId) {
      notifyHeseosPartnerQrClaimed(partner, link.employeeId).catch((err) => {
        console.error('notifyHeseosPartnerQrClaimed error:', err);
      });
    }

    return Response.json(withData);
  } catch (e) {
    const status = { NOT_FOUND: 404, ALREADY_CLAIMED: 409, INACTIVE: 410, INVALID: 400 }[e.code] || 400;
    return Response.json({ error: e.message }, { status });
  }
}
