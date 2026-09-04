// app/api/leads/route.js
// Central lead intake — the Partner App (source: 'partner_app'), the Team App (source:
// 'employee_app' — an employee punching in a lead they sourced themselves, e.g. a walk-in or
// cold call, credited to them the same way a partner's leads are credited to that partner) and
// Admin's own manual "Add Lead" button (source: 'manual_entry') POST here directly;
// WhatsApp-sourced and Meta/Google Ads leads are created straight into the `leads` table by
// their own webhooks instead (see lib/waInbound.js and app/api/leads/meta-webhook,
// google-ads-webhook), so `leads` still stays the single source of truth either way. Mirrors
// MARG's app/api/enquiry/route.js.

import { dbInsert, dbList, dbWhere } from '@/lib/db';
import { istDateStr } from '@/lib/date';
import { getEmployee, getPartner } from '@/lib/auth';
import { pushHistory } from '@/lib/leadStage';
import { autoAssignByCity } from '@/lib/leadAssign';
import { LEAD_SOURCES } from '@/lib/formOptions';
import { findFirstLeadByPhone, describeLeadOrigin } from '@/lib/leadOrigin';
import { notifyHeseosLeadAdded } from '@/lib/heseosNotify';

export const dynamic = 'force-dynamic';

// GET — employees see the full pipeline; partners see only leads they submitted.
export async function GET() {
  const employee = await getEmployee();
  if (employee) {
    const leads = await dbList('leads');
    return Response.json(leads);
  }
  const partner = await getPartner();
  if (partner) {
    const leads = await dbWhere('leads', 'partnerId', partner.id);
    return Response.json(leads);
  }
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}

export async function POST(request) {
  try {
    const body = await request.json();

    const { name, phone, city } = body;
    if (!name || !phone || !city) {
      return Response.json({ error: 'Missing required fields (name, phone, city)' }, { status: 400 });
    }

    // A lead submitted from the partner app is attributed to whichever partner is logged in —
    // never trust a client-supplied partnerId for that channel. Same idea for the Team App:
    // addedByEmployeeId is only ever set from the employee's own session, never from the
    // request body — see components/admin/LeadsPage.jsx's attributionInfo() for where this
    // shows up as an "Employee" tag in the admin Leads table.
    let source = body.source || 'manual_entry';
    let partnerId = null;
    let addedByEmployeeId = null;
    // Who to tell the CUSTOMER added them (see notifyHeseosLeadAdded below) — captured here,
    // independent of the first-touch-attribution nulling further down, because the customer
    // should still be told who punched them in even on a submission that doesn't earn payout
    // credit (the two are unrelated: one's about who gets paid, the other's about who the
    // customer should expect a follow-up from).
    let addedByLabel = null;
    if (source === 'partner_app') {
      const partner = await getPartner();
      if (!partner) return Response.json({ error: 'Partner login required' }, { status: 401 });
      partnerId = partner.id;
      addedByLabel = `${partner.name || partner.businessName || 'Our partner'}, Heseos Partner`;
    } else if (source === 'employee_app') {
      const employee = await getEmployee();
      if (!employee) return Response.json({ error: 'Employee login required' }, { status: 401 });
      addedByEmployeeId = employee.id;
      addedByLabel = `${employee.name || 'Our team member'}, Heseos Team Member`;
    } else if (!LEAD_SOURCES[source]) {
      source = 'manual_entry';
    }

    // First-touch attribution — "our system only considers who gave the lead first." A partner
    // or employee can still punch this in as its own enquiry (the duplicate-check warning in
    // the wizard explicitly allows that — app/api/leads/lookup), but if this phone number
    // already has an earlier lead from ANY channel, payout credit stays with whoever brought it
    // in first: this new lead is created for pipeline visibility only, with no partnerId/
    // addedByEmployeeId of its own, so lib/payout.js never counts the same customer's converted
    // sale toward two different referrers.
    const existingLeads = await dbList('leads');
    const firstLead = findFirstLeadByPhone(phone, existingLeads);
    let duplicateNote = null;
    // Preserved for the history entry below even after partnerId/addedByEmployeeId get nulled,
    // so the audit trail still shows WHO actually punched this in — they just don't get payout
    // credit for it.
    const submittedBy = partnerId ? `partner:${partnerId}` : addedByEmployeeId ? `employee:${addedByEmployeeId}` : source;
    if (firstLead && (partnerId || addedByEmployeeId)) {
      const [origPartners, origEmployees, origLinks] = await Promise.all([dbList('partners'), dbList('employees'), dbList('attribution_links')]);
      duplicateNote = `Not credited to ${partnerId ? 'this partner' : 'this employee'} — ${describeLeadOrigin(firstLead, { partners: origPartners, employees: origEmployees, leads: existingLeads, links: origLinks })}, so payout credit stays with the original referrer.`;
      partnerId = null;
      addedByEmployeeId = null;
    }

    const now = new Date().toISOString();
    const id = `L${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 90 + 10)}`;

    // City-based auto-assignment — see lib/leadAssign.js. Leaves both null (unassigned) when
    // no active employee's location matches, same as before this existed.
    const { assignedTo, salesEngineerId } = await autoAssignByCity(city);

    const lead = {
      id,
      createdAt: now,
      date: istDateStr(),
      status: 'new',

      name: String(name).trim(),
      phone: String(phone).trim(),
      email: body.email || '',
      city: String(city).trim(),
      postcode: body.postcode || '',

      productInterest: Array.isArray(body.productInterest) ? body.productInterest : [],
      propertyType: body.propertyType || '',
      budget: body.budget || '',
      timeline: body.timeline || '',
      persona: body.persona || '',
      altPhone: body.altPhone || '',
      configuration: body.configuration || '',
      referralSource: body.referralSource || '',
      notes: body.notes || '',

      source,
      partnerId,
      addedByEmployeeId,

      contactStage: null,
      demoOutcome: null,
      assignedTo,
      salesEngineerId,

      history: [],
    };
    lead.history = pushHistory(lead, { event: 'Lead Submitted', by: submittedBy, note: LEAD_SOURCES[source] });
    if (duplicateNote) {
      lead.history = pushHistory(lead, { event: 'Not credited — first-touch attribution', by: 'system', note: duplicateNote });
    }
    if (assignedTo) {
      lead.history = pushHistory(lead, { event: 'Auto-assigned by city', by: 'system', note: `${city} · pre-sales matched` });
    }

    await dbInsert('leads', id, lead);

    // Tell the customer who just added them — never lets a WhatsApp hiccup fail the actual
    // lead-creation request (see notifyHeseosLeadAdded's own header comment).
    if (addedByLabel) {
      await notifyHeseosLeadAdded(lead, addedByLabel).catch((err) => {
        console.error('notifyHeseosLeadAdded error:', err);
      });
    }

    return Response.json({ success: true, id: lead.id });
  } catch (err) {
    console.error('Lead capture error:', err);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
