// Admin — pre-printed (blank/unclaimed) partner QR codes. See lib/attribution.js's
// createBlankPartnerQrCodes/claimPartnerQrCode for the model: admin generates a batch of qr_
// partner codes with no partnerId yet, prints them (one sticker per code), and a partner claims
// one from their Profile → QR Code screen (app/api/partner/attribution/qr) by typing in the
// code printed on it. This is what replaced the old "admin creates one QR code for an already-
// chosen partner" flow in app/api/admin/attribution/route.js — that route still exists for
// qr_location (a billboard/standee has no partner to hand a code to), but partner QR codes now
// only ever start out blank.
//
// GET  — every qr_partner code nobody has claimed yet, so admin can see what's left from a
//        previous batch before printing another one.
// POST — generate a new batch of N blank codes.
import { getEmployee } from '@/lib/auth';
import { createBlankPartnerQrCodes, listUnclaimedPartnerQrCodes, funnelForAll, getHeseosBotTenant, trackedLinkUrl } from '@/lib/attribution';

export const dynamic = 'force-dynamic';

// Always the tracked /go/<code> redirector — see app/api/admin/attribution/route.js for why.
function linkUrlFor(tenant, code) {
  return trackedLinkUrl(tenant, code) || null;
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
  const employee = await getEmployee();
  if (!employee) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const [unclaimed, tenant] = await Promise.all([listUnclaimedPartnerQrCodes(), getHeseosBotTenant()]);
  unclaimed.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return Response.json(await withUrlsAndFunnels(unclaimed, tenant));
}

export async function POST(request) {
  const employee = await getEmployee();
  if (!employee) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const count = Math.floor(Number(body.count) || 0);
  if (!count || count < 1) return Response.json({ error: 'count must be at least 1' }, { status: 400 });
  if (count > 200) return Response.json({ error: 'Generate at most 200 at a time — run it again for a bigger batch' }, { status: 400 });

  const batchLabel = String(body.batchLabel || '').trim();
  const employeeId = String(body.employeeId || '').trim() || null;
  const created = await createBlankPartnerQrCodes(count, { createdBy: `employee:${employee.id}`, batchLabel, employeeId });
  const tenant = await getHeseosBotTenant();
  return Response.json(await withUrlsAndFunnels(created, tenant), { status: 201 });
}
