// app/api/leads/[id]/route.js
// Every stage transition for a lead goes through here — contact-stage updates (pre-sales),
// demo scheduling, demo outcome (sales engineer), and assignment (admin). Each write appends
// a timestamped entry to `history` so the full lifecycle is always reconstructable.

import { dbGetById, dbPatch } from '@/lib/db';
import { getEmployee, getPartner } from '@/lib/auth';
import { pushHistory, CONTACT_LABEL, DEMO_OUTCOME_LABEL, DEMO_OUTCOME_KIND } from '@/lib/leadStage';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const { id } = await params;
  const lead = await dbGetById('leads', id);
  if (!lead) return Response.json({ error: 'Not found' }, { status: 404 });

  const employee = await getEmployee();
  if (employee) return Response.json(lead);

  const partner = await getPartner();
  if (partner && lead.partnerId === partner.id) return Response.json(lead);

  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}

export async function PATCH(request, { params }) {
  const { id } = await params;
  const employee = await getEmployee();
  if (!employee) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const lead = await dbGetById('leads', id);
  if (!lead) return Response.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();
  const actorLabel = `${employee.name || employee.email} (${employee.role})`;
  let patch = {};

  if (body.type === 'contact') {
    // Pre-sales / lead-nurturing outcomes that don't (yet) schedule a demo:
    // Call Not Picked, Not Interested, Follow-up Later.
    if (!CONTACT_LABEL[body.contactStage] || body.contactStage === 'qualified') {
      return Response.json({ error: 'Invalid contactStage' }, { status: 400 });
    }
    const now = new Date().toISOString();
    patch = {
      contactStage: body.contactStage,
      contactStageAt: now,
      contactStageBy: employee.id,
      contactNote: body.note || '',
      followUpAt: body.contactStage === 'follow_up' ? (body.followUpAt || null) : (lead.followUpAt || null),
      assignedTo: lead.assignedTo || employee.id,
    };
    patch.history = pushHistory(lead, { event: CONTACT_LABEL[body.contactStage], by: actorLabel, note: body.note || '' });

  } else if (body.type === 'scheduleDemo') {
    // Qualifies the lead AND books the visit in one step — address, date, time are required,
    // matching the "if demo scheduled it ask address date and time" flow.
    if (!body.demoAddress || !body.demoDate || !body.demoTime) {
      return Response.json({ error: 'demoAddress, demoDate and demoTime are required' }, { status: 400 });
    }
    const now = new Date().toISOString();
    patch = {
      contactStage: 'qualified',
      contactStageAt: now,
      contactStageBy: employee.id,
      demoScheduledAt: now,
      demoScheduledBy: employee.id,
      demoAddress: body.demoAddress,
      demoDate: body.demoDate,
      demoTime: body.demoTime,
      // Clear any earlier outcome — this is a (re)scheduling.
      demoOutcome: null,
      demoOutcomeAt: null,
      demoOutcomeBy: null,
      demoOutcomeNote: null,
      assignedTo: lead.assignedTo || employee.id,
      salesEngineerId: body.salesEngineerId || lead.salesEngineerId || null,
    };
    patch.history = pushHistory(lead, { event: `Demo Scheduled — ${body.demoDate} ${body.demoTime}`, by: actorLabel, note: body.demoAddress });

  } else if (body.type === 'demoOutcome') {
    // Sales engineer marks the final outcome of the visit.
    if (!DEMO_OUTCOME_LABEL[body.demoOutcome]) {
      return Response.json({ error: 'Invalid demoOutcome' }, { status: 400 });
    }
    if (!lead.demoScheduledAt) {
      return Response.json({ error: 'No demo scheduled for this lead yet' }, { status: 400 });
    }
    const now = new Date().toISOString();
    patch = {
      demoOutcome: body.demoOutcome,
      demoOutcomeAt: now,
      demoOutcomeBy: employee.id,
      demoOutcomeNote: body.note || '',
    };
    if (body.demoOutcome === 'converted') patch.convertedAt = now;
    if (DEMO_OUTCOME_KIND[body.demoOutcome] === 'dead') patch.rejectedAt = now;
    // Reschedule outcomes may come with a fresh date/time/address right away.
    if (DEMO_OUTCOME_KIND[body.demoOutcome] === 'reschedule' && body.demoDate && body.demoTime) {
      patch.demoDate = body.demoDate;
      patch.demoTime = body.demoTime;
      if (body.demoAddress) patch.demoAddress = body.demoAddress;
      patch.demoScheduledAt = now;
      patch.demoOutcome = null; // back to awaiting-visit state with the new slot
      patch.demoOutcomeAt = null;
      patch.demoOutcomeBy = null;
    }
    patch.history = pushHistory(lead, { event: DEMO_OUTCOME_LABEL[body.demoOutcome], by: actorLabel, note: body.note || '' });

  } else if (body.type === 'assign') {
    patch = {
      assignedTo: body.assignedTo !== undefined ? body.assignedTo : lead.assignedTo,
      salesEngineerId: body.salesEngineerId !== undefined ? body.salesEngineerId : lead.salesEngineerId,
    };
    patch.history = pushHistory(lead, { event: 'Reassigned', by: actorLabel, note: JSON.stringify({ assignedTo: patch.assignedTo, salesEngineerId: patch.salesEngineerId }) });

  } else {
    return Response.json({ error: 'Unknown update type' }, { status: 400 });
  }

  const updated = await dbPatch('leads', id, patch);
  return Response.json(updated);
}
