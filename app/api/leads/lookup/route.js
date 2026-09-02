// GET /api/leads/lookup?phone=... — app/api/leads/lookup/route.js
//
// Duplicate-lead check for the Partner App's and Team App's "Add Lead" wizards. Before a
// partner or employee submits a new lead, the wizard calls this with the phone number they've
// typed so far; if that number is already in the system, we warn them WHO already brought it in
// (see lib/leadOrigin.js's describeLeadOrigin) so they don't duplicate a lead someone else — or
// the customer themselves — already reached us through.
//
// Gated to any logged-in partner OR employee (same as app/api/leads GET), since both apps use
// this. Deliberately returns only { exists, origin, createdAt } — never the matching lead's id,
// name, phone, or any other field — so this can't be used to pull another partner's or
// customer's private details out of the system; it only ever discloses the ORIGIN sentence,
// which is exactly what the user needs to avoid duplicating work.
//
// Matching is last-10-digits, digits-only (lib/leadOrigin.js's normalizePhone) — see that file's
// header comment for why partner/employee-entered numbers and WhatsApp MSISDNs need this to
// line up. When more than one existing lead matches, the most recently created one wins (most
// likely to be the freshest / most relevant "someone already has this" signal).

import { dbList } from '@/lib/db';
import { getEmployee, getPartner } from '@/lib/auth';
import { describeLeadOrigin, normalizePhone } from '@/lib/leadOrigin';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const employee = await getEmployee();
  const partner = await getPartner();
  if (!employee && !partner) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const phone = normalizePhone(searchParams.get('phone'));
  if (phone.length !== 10) return Response.json({ exists: false });

  const [leads, partners, employees, links] = await Promise.all([
    dbList('leads'), dbList('partners'), dbList('employees'), dbList('attribution_links'),
  ]);

  const matches = leads
    .filter((l) => normalizePhone(l.phone) === phone)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (!matches.length) return Response.json({ exists: false });

  const lead = matches[0];
  return Response.json({
    exists: true,
    origin: describeLeadOrigin(lead, { partners, employees, leads, links }),
    createdAt: lead.createdAt,
  });
}
