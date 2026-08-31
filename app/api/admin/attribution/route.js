// Admin backend for QR codes & referral links — see lib/attribution.js for the model.
// GET  — every attribution link + its funnel (scans/leads/converted), for the Growth tab table.
// POST — create a new link. Admin can create any kind, but qr_partner/referral_partner are
//        normally self-provisioned by the partner themselves (see app/api/partner/attribution) —
//        this exists so an admin can also hand a partner a link/QR before they've logged in.
// PATCH — toggle a link active/inactive (never delete: history — visits/leads — must stay
//         attributable even after a placement comes down or a promo ends).

import { dbGetById, dbList, dbPatch } from '@/lib/db';
import { getEmployee } from '@/lib/auth';
import { createAttributionLink, funnelForAll, ATTR_KINDS } from '@/lib/attribution';

export const dynamic = 'force-dynamic';

export async function GET() {
  const employee = await getEmployee();
  if (!employee) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const [links, partners] = await Promise.all([dbList('attribution_links'), dbList('partners')]);
  const funnels = await funnelForAll(links.map((l) => l.id));
  const partnerName = Object.fromEntries(partners.map((p) => [p.id, p.businessName || p.name || p.id]));

  const out = links.map((l) => ({
    ...l,
    partnerName: l.partnerId ? (partnerName[l.partnerId] || l.partnerId) : null,
    funnel: funnels.get(l.id) || { visits: 0, leads: 0, converted: 0 },
  }));
  return Response.json(out);
}

export async function POST(request) {
  const employee = await getEmployee();
  if (!employee) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { kind, label, partnerId, customerLeadId, customerName, customerPhone } = body;
  if (!ATTR_KINDS.includes(kind)) return Response.json({ error: 'Invalid kind' }, { status: 400 });

  if ((kind === 'qr_partner' || kind === 'referral_partner') && !partnerId) {
    return Response.json({ error: 'partnerId is required for a partner link' }, { status: 400 });
  }
  if (kind === 'qr_location' && !String(label || '').trim()) {
    return Response.json({ error: 'A location label is required (e.g. "Koramangala Billboard")' }, { status: 400 });
  }
  if (kind === 'referral_customer' && !String(customerName || '').trim() && !customerLeadId) {
    return Response.json({ error: 'Pick a customer or enter their name for a customer referral link' }, { status: 400 });
  }

  let resolvedPartnerId = partnerId || null;
  let resolvedLabel = label || '';
  if ((kind === 'qr_partner' || kind === 'referral_partner') && resolvedPartnerId) {
    const partner = await dbGetById('partners', resolvedPartnerId);
    if (!partner) return Response.json({ error: 'Partner not found' }, { status: 404 });
    if (!resolvedLabel) resolvedLabel = partner.businessName || partner.name || partner.id;
  }

  let resolvedCustomerName = customerName || '';
  let resolvedCustomerPhone = customerPhone || '';
  if (kind === 'referral_customer' && customerLeadId) {
    const lead = await dbGetById('leads', customerLeadId);
    if (lead) {
      resolvedCustomerName = resolvedCustomerName || lead.name || '';
      resolvedCustomerPhone = resolvedCustomerPhone || lead.phone || '';
    }
  }

  const link = await createAttributionLink({
    kind,
    label: resolvedLabel,
    partnerId: resolvedPartnerId,
    customerLeadId: customerLeadId || null,
    customerName: resolvedCustomerName,
    customerPhone: resolvedCustomerPhone,
    createdBy: `employee:${employee.id}`,
  });
  return Response.json(link, { status: 201 });
}

export async function PATCH(request) {
  const employee = await getEmployee();
  if (!employee) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { id, active } = body;
  if (!id) return Response.json({ error: 'id is required' }, { status: 400 });

  const patch = {};
  if (active !== undefined) patch.active = !!active;
  if (Object.keys(patch).length === 0) return Response.json({ error: 'Nothing to update' }, { status: 400 });

  const updated = await dbPatch('attribution_links', id, patch);
  if (!updated) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json(updated);
}
