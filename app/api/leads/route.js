// app/api/leads/route.js
// Central lead intake — the Partner App (source: 'partner_app') and Admin's own manual "Add
// Lead" button (source: 'manual_entry') POST here directly; WhatsApp-sourced and Meta/Google
// Ads leads are created straight into the `leads` table by their own webhooks instead (see
// lib/waInbound.js and app/api/leads/meta-webhook, google-ads-webhook), so `leads` still stays
// the single source of truth either way. Mirrors MARG's app/api/enquiry/route.js.

import { dbInsert, dbList, dbWhere } from '@/lib/db';
import { istDateStr } from '@/lib/date';
import { getEmployee, getPartner } from '@/lib/auth';
import { pushHistory } from '@/lib/leadStage';
import { autoAssignByCity } from '@/lib/leadAssign';
import { LEAD_SOURCES } from '@/lib/formOptions';

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
    // never trust a client-supplied partnerId for that channel.
    let source = body.source || 'manual_entry';
    let partnerId = null;
    if (source === 'partner_app') {
      const partner = await getPartner();
      if (!partner) return Response.json({ error: 'Partner login required' }, { status: 401 });
      partnerId = partner.id;
    } else if (!LEAD_SOURCES[source]) {
      source = 'manual_entry';
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

      contactStage: null,
      demoOutcome: null,
      assignedTo,
      salesEngineerId,

      history: [],
    };
    lead.history = pushHistory(lead, { event: 'Lead Submitted', by: partnerId ? `partner:${partnerId}` : source, note: LEAD_SOURCES[source] });
    if (assignedTo) {
      lead.history = pushHistory(lead, { event: 'Auto-assigned by city', by: 'system', note: `${city} · pre-sales matched` });
    }

    await dbInsert('leads', id, lead);

    return Response.json({ success: true, id: lead.id });
  } catch (err) {
    console.error('Lead capture error:', err);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
