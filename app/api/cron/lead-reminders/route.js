// app/api/cron/lead-reminders/route.js
// The one scheduled (non-human-triggered) sweep in this app — everything else in
// lib/heseosNotify.js fires off the back of a human action or an inbound webhook. This route
// exists for the one thing that instead depends on TIME PASSING with nobody doing anything:
//
//   A lead with a booked demo (demoScheduledAt set, no demoOutcome logged yet) gets a
//   courtesy reminder 24h and 2h before the visit (lib/heseosNotify.js's
//   notifyHeseosDemoReminder).
//
// It is idempotent by design — demoReminder24hSentAt/demoReminder2hSentAt (see
// lib/leadStage.js's own comment on these) are checked AND updated every time this runs, so
// calling this route twice in a row (or on overlapping schedules) never double-sends. That matters because there's no cron
// infrastructure built into this app or its host (Vercel) that can run more often than once a
// day on the Hobby plan — see this repo's README for which plan/schedule this project actually
// uses. The intended caller is an external scheduler hitting this route on a tighter cadence
// (hourly is plenty); a `.github/workflows/lead-reminders.yml` GitHub
// Actions workflow is included for exactly this, authenticating with the same CRON_SECRET env
// var checked below. If a Vercel Cron entry is ever added for this same route instead (or as a
// redundant daily safety net), no code change is needed — Vercel's own cron invocations already
// send `Authorization: Bearer $CRON_SECRET` automatically, matching the check here.
//
// Auth is a single shared secret (CRON_SECRET, see .env.example) rather than an employee/partner
// session — this route has no browser caller, and a session cookie isn't something a scheduled
// job can hold anyway.

import { dbList, dbPatch } from '@/lib/db';
import { notifyHeseosDemoReminder } from '@/lib/heseosNotify';

export const dynamic = 'force-dynamic';

const HOUR_MS = 60 * 60 * 1000;

// A lead's demoDate ("YYYY-MM-DD") + demoTime ("HH:MM", 24h) converge to this exact shape from
// BOTH paths that can set them — the WhatsApp bot's date_ddmmyyyy/time_12h validators
// (lib/botFlowEngine.js) and the dashboard's native <input type="date">/<input type="time">
// (components/employee/PresalesPanel.jsx) — so this one parse covers every lead regardless of
// which channel booked the demo. Heseos operates in IST (lib/date.js) — the visit time is
// whatever the customer/pre-sales agreed to in IST, so the instant is anchored there explicitly
// rather than trusting the server's own timezone. Returns null if either piece is missing or
// malformed, rather than guessing.
function demoInstant(lead) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(lead.demoDate || '') || !/^\d{2}:\d{2}$/.test(lead.demoTime || '')) return null;
  const d = new Date(`${lead.demoDate}T${lead.demoTime}:00+05:30`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('lead-reminders cron: CRON_SECRET is not set — refusing to run.');
    return Response.json({ error: 'Not configured' }, { status: 500 });
  }
  const auth = request.headers.get('authorization') || '';
  if (auth !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const leads = await dbList('leads');
  const summary = { checked: leads.length, demoReminders24hSent: 0, demoReminders2hSent: 0, errors: [] };

  for (const lead of leads) {
    try {
      // ── Demo-time reminders ─────────────────────────────────────────────────────
      if (lead.demoScheduledAt && !lead.demoOutcome) {
        const at = demoInstant(lead);
        // Skip a demo whose slot has already passed by more than an hour — the sales engineer
        // just hasn't logged an outcome yet, and there's nothing useful left to remind anyone
        // about. The lower bound is deliberately loose (not exactly 0) so an infrequent
        // scheduler doesn't miss a reminder that fell just past the visit time.
        if (at && (at.getTime() - Date.now()) / HOUR_MS > -1) {
          const hoursUntil = (at.getTime() - Date.now()) / HOUR_MS;
          if (hoursUntil <= 24 && !lead.demoReminder24hSentAt) {
            const res = await notifyHeseosDemoReminder(lead, 'h24');
            await dbPatch('leads', lead.id, { demoReminder24hSentAt: new Date().toISOString() });
            if (res.ok) summary.demoReminders24hSent += 1;
          }
          if (hoursUntil <= 2 && !lead.demoReminder2hSentAt) {
            const res = await notifyHeseosDemoReminder(lead, 'h2');
            await dbPatch('leads', lead.id, { demoReminder2hSentAt: new Date().toISOString() });
            if (res.ok) summary.demoReminders2hSent += 1;
          }
        }
      }
    } catch (err) {
      console.error(`lead-reminders cron: error processing lead ${lead.id}:`, err);
      summary.errors.push(lead.id);
    }
  }

  return Response.json(summary);
}
