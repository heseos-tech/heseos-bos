// Shared lead-conversion payout config — one tiered commission ladder + a monthly/quarterly
// period, applying identically to partners, employees, and (once that flow exists) customer
// referrers. See lib/payout.js for the calculation rules and lib/payoutSettings.js for storage.
//
// GET  — any logged-in partner or employee can read it (read-only; needed so the Partner App's
//        Rewards screen, the Team App's Home screen, and Admin's Partners table can each compute
//        their own real payout numbers client-side from the same shared ladder).
// PUT  — admin only. Replaces the whole config (period + full tier list) — same "read, edit,
//        save the whole thing" pattern as every other Settings card on this page.

import { getEmployee, getPartner } from '@/lib/auth';
import { getPayoutConfig, savePayoutConfig } from '@/lib/payoutSettings';

export const dynamic = 'force-dynamic';

export async function GET() {
  const employee = await getEmployee();
  const partner = employee ? null : await getPartner();
  if (!employee && !partner) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const config = await getPayoutConfig();
  return Response.json(config);
}

export async function PUT(request) {
  const employee = await getEmployee();
  if (!employee || employee.role !== 'admin') return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const period = body.period === 'quarterly' ? 'quarterly' : 'monthly';
  const tiers = Array.isArray(body.tiers) ? body.tiers : [];

  for (const t of tiers) {
    if (t && t.upTo !== '' && t.upTo != null && !(Number(t.upTo) > 0)) {
      return Response.json({ error: 'Each tier\'s "Up to" value must be a positive number, or left blank for the open-ended top tier.' }, { status: 400 });
    }
    if (!(Number(t?.rate) >= 0)) {
      return Response.json({ error: 'Each tier needs a payout percentage of 0 or more.' }, { status: 400 });
    }
  }

  const saved = await savePayoutConfig({ period, tiers }, employee.id);
  return Response.json(saved);
}
