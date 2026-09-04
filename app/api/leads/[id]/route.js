// app/api/leads/[id]/route.js
// Every stage transition for a lead goes through here — contact-stage updates (pre-sales),
// demo scheduling, demo outcome (sales engineer), and assignment (admin). Each write appends
// a timestamped entry to `history` so the full lifecycle is always reconstructable.

import { dbGetById, dbPatch, dbClaim } from '@/lib/db';
import { getEmployee, getPartner } from '@/lib/auth';
import { pushHistory, CONTACT_LABEL, DEMO_OUTCOME_LABEL, DEMO_OUTCOME_KIND, INSTALL_STATUS_LABEL, INVOICE_STATUS_LABEL } from '@/lib/leadStage';
import { notifyHeseosDemoClaimed } from '@/lib/heseosNotify';

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

  if (body.type === 'claim') {
    // First-come-first-served claim of an open demo: pre-sales schedules the demo (address,
    // date, time) and leaves salesEngineerId unset; every sales engineer in that city sees it
    // as "available", and whoever claims it first wins — everyone else stops seeing it. The
    // actual race is resolved by dbClaim's conditional write, not by anything checked here.
    if (employee.role !== 'sales_engineer' && employee.role !== 'admin') {
      return Response.json({ error: 'Only sales engineers can claim a lead' }, { status: 403 });
    }
    if (!lead.demoScheduledAt) {
      return Response.json({ error: 'No demo scheduled for this lead yet' }, { status: 400 });
    }
    if (lead.salesEngineerId) {
      return Response.json({ error: 'This lead has already been claimed' }, { status: 409 });
    }
    const claimPatch = { salesEngineerId: employee.id, salesEngineerClaimedAt: new Date().toISOString() };
    claimPatch.history = pushHistory(lead, { event: 'Claimed by sales engineer', by: actorLabel });
    const result = await dbClaim('leads', id, 'salesEngineerId', claimPatch);
    if (!result.ok) {
      return Response.json(
        { error: result.reason === 'already_claimed' ? 'Someone else already claimed this lead' : 'Lead not found' },
        { status: result.reason === 'already_claimed' ? 409 : 404 }
      );
    }
    // Tell the customer who's coming and reconfirm the demo details — never lets a WhatsApp
    // hiccup fail the actual claim (see notifyHeseosDemoClaimed's own header comment).
    await notifyHeseosDemoClaimed(result.data, employee).catch((err) => {
      console.error('notifyHeseosDemoClaimed error:', err);
    });
    return Response.json(result.data);
  }

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
    // Converting requires the final, negotiated price — the number the deal actually closed
    // at, which can (and usually does) differ from the original quotation after back-and-forth.
    if (body.demoOutcome === 'converted' && (body.finalPrice === undefined || body.finalPrice === null || body.finalPrice === '')) {
      return Response.json({ error: 'Final price is required to mark a lead as Converted' }, { status: 400 });
    }
    const now = new Date().toISOString();
    patch = {
      demoOutcome: body.demoOutcome,
      demoOutcomeAt: now,
      demoOutcomeBy: employee.id,
      demoOutcomeNote: body.note || '',
    };
    if (body.demoOutcome === 'converted') {
      patch.convertedAt = now;
      patch.finalPrice = Number(body.finalPrice) || null;
      patch.finalPriceAt = now;
      patch.finalPriceBy = employee.id;
    }
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
    const outcomeNote = body.demoOutcome === 'converted'
      ? `Final price ₹${patch.finalPrice}${body.note ? ' — ' + body.note : ''}`
      : (body.note || '');
    patch.history = pushHistory(lead, { event: DEMO_OUTCOME_LABEL[body.demoOutcome], by: actorLabel, note: outcomeNote });

  } else if (body.type === 'quotation') {
    // Admin/sales-engineer sends (or REVISES) a quotation. Every call appends a new entry to
    // quotationRevisions — as many times as the price gets negotiated — while
    // quotationSentAt/quotationSentBy/quotationAmount always mirror the LATEST revision, so
    // every existing table/column/funnel that already reads those three fields keeps working
    // unchanged and just shows the current number.
    //
    // `items` is optional — the Team App and the old simple Sales-Engineer modal still send
    // just { amount, note } and keep working exactly as before. When the quotation builder
    // sends structured line items instead, the server (never the client) computes subtotal/
    // discountTotal/amount from them, so a tampered client-sent total can't slip through.
    const now = new Date().toISOString();
    const prevRevisions = Array.isArray(lead.quotationRevisions) ? lead.quotationRevisions : [];
    const revisionNum = prevRevisions.length + 1;

    let amount;
    let items = null;
    let subtotal = null;
    let discountTotal = null;
    if (Array.isArray(body.items) && body.items.length > 0) {
      items = body.items.map((it) => {
        const price = Number(it.price) || 0;
        const qty = Number(it.qty) || 0;
        const discount = Math.max(0, Number(it.discount) || 0);
        const lineTotal = Math.max(0, price * qty - discount);
        return {
          productId: it.productId || null,
          sku: String(it.sku || ''),
          name: String(it.name || ''),
          price, qty, discount, lineTotal,
        };
      });
      subtotal = items.reduce((s, it) => s + it.price * it.qty, 0);
      const lineDiscounts = items.reduce((s, it) => s + it.discount, 0);
      const extraDiscount = body.extraDiscount != null && body.extraDiscount !== '' ? Math.max(0, Number(body.extraDiscount) || 0) : 0;
      discountTotal = lineDiscounts + extraDiscount;
      amount = Math.max(0, subtotal - discountTotal);
    } else {
      amount = body.amount != null && body.amount !== '' ? Number(body.amount) || null : (lead.quotationAmount || null);
    }

    const revisionEntry = { revision: revisionNum, amount, at: now, by: actorLabel, note: body.note || '' };
    if (items) { revisionEntry.items = items; revisionEntry.subtotal = subtotal; revisionEntry.discountTotal = discountTotal; }
    patch = {
      quotationSentAt: now,
      quotationSentBy: employee.id,
      quotationAmount: amount,
      quotationRevisions: [...prevRevisions, revisionEntry],
    };
    const quoteEvent = revisionNum === 1 ? 'Quotation Sent' : `Quotation Revised (v${revisionNum})`;
    const quoteNote = `${amount != null ? `₹${amount}` : ''}${body.note ? (amount != null ? ' — ' : '') + body.note : ''}`;
    patch.history = pushHistory(lead, { event: quoteEvent, by: actorLabel, note: quoteNote });

  } else if (body.type === 'conversionUpdate') {
    // Post-sale tracking for a CONVERTED deal — install status, invoice, warranty. Admin-only
    // (this is edited exclusively from Admin -> Conversions); every other PATCH type on this
    // route stays open to any employee per this file's existing trust model.
    if (employee.role !== 'admin') {
      return Response.json({ error: 'Only admins can update conversion tracking' }, { status: 403 });
    }
    if (lead.demoOutcome !== 'converted') {
      return Response.json({ error: 'This lead has not been converted yet' }, { status: 400 });
    }
    if (body.installStatus !== undefined && !INSTALL_STATUS_LABEL[body.installStatus]) {
      return Response.json({ error: 'Invalid installStatus' }, { status: 400 });
    }
    if (body.invoiceStatus !== undefined && !INVOICE_STATUS_LABEL[body.invoiceStatus]) {
      return Response.json({ error: 'Invalid invoiceStatus' }, { status: 400 });
    }
    if (body.installStatus !== undefined) patch.installStatus = body.installStatus;
    if (body.installDate !== undefined) patch.installDate = body.installDate || null;
    if (body.invoiceNumber !== undefined) patch.invoiceNumber = body.invoiceNumber || '';
    if (body.invoiceAmount !== undefined) patch.invoiceAmount = body.invoiceAmount != null && body.invoiceAmount !== '' ? (Number(body.invoiceAmount) || null) : null;
    if (body.invoiceStatus !== undefined) patch.invoiceStatus = body.invoiceStatus;
    if (body.warrantyMonths !== undefined) patch.warrantyMonths = body.warrantyMonths != null && body.warrantyMonths !== '' ? (Number(body.warrantyMonths) || null) : null;
    if (body.conversionNote !== undefined) patch.conversionNote = body.conversionNote || '';
    patch.history = pushHistory(lead, { event: 'Conversion tracking updated', by: actorLabel, note: body.note || '' });

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
