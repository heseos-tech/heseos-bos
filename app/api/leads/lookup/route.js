// GET /api/leads/lookup?phone=... — app/api/leads/lookup/route.js
//
// Duplicate-lead check for the Partner App's and Team App's "Add Lead" wizards. Before a
// partner or employee submits a new lead, the wizard calls this with the phone number they've
// typed so far; if that number already has an OPEN (still-in-process) lead, we warn them WHO
// already brought it in (see lib/leadOrigin.js's describeLeadOrigin) — the Partner App wizard
// (components/partner/LeadWizard.jsx) treats this as a hard block (see app/api/leads's own
// server-side enforcement for the Partner App), the Team App wizard still just warns. A lead
// that's already CLOSED (Converted or Rejected — lib/leadStage.js's isLeadClosed) is done, one
// way or the other, so that number is free again: this deliberately reports `exists: false` for
// it, exactly as if no lead had ever existed, rather than surfacing a stale warning about a
// finished enquiry.
//
// Gated to any logged-in partner OR employee (same as app/api/leads GET), since both apps use
// this. Deliberately returns only { exists, origin, createdAt } — never the matching lead's id,
// name, phone, or any other field — so this can't be used to pull another partner's or
// customer's private details out of the system; it only ever discloses the ORIGIN sentence,
// which is exactly what the user needs to avoid duplicating work.
//
// Matching is last-10-digits, digits-only (lib/leadOrigin.js's normalizePhone) — see that file's
// header comment for why partner/employee-entered numbers and WhatsApp MSISDNs need this to
// line up. When more than one existing OPEN lead matches, the most recently created one wins
// (most likely to be the freshest / most relevant "someone already has this" signal).

import { dbList } from '@/lib/db';
import { getEmployee, getPartner } from '@/lib/auth';
import { describeLeadOrigin, normalizePhone } from '@/lib/leadOrigin';
import { isLeadClosed } from '@/lib/leadStage';

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
    .filter((l) => normalizePhone(l.phone) === phone && !isLeadClosed(l))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (!matches.length) return Response.json({ exists: false });

  const lead = matches[0];
  return Response.json({
    exists: true,
    origin: describeLeadOrigin(lead, { partners, employees, leads, links }),
    createdAt: lead.createdAt,
  });
}
