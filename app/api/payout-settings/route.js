// Lead-conversion payout config — a shared monthly/quarterly period plus three independent
// tiered commission ladders (one each for partner referrals, employee-added leads, and customer
// referrals — see lib/payout.js's PAYOUT_CATEGORIES), each with its own on/off switch. See
// lib/payout.js for the calculation rules and lib/payoutSettings.js for storage.
//
// GET  — any logged-in partner or employee can read it (read-only; needed so the Partner App's
//        Rewards screen, the Team App's Home screen, and Admin's Partners table can each compute
//        their own real payout numbers client-side from the same shared config).
// PUT  — admin only. Replaces the whole config (period + every category's enabled flag and
//        full tier list) — same "read, edit, save the whole thing" pattern as every other
//        Settings card on this page.

import { getEmployee, getPartner } from '@/lib/auth';
import { getPayoutConfig, savePayoutConfig } from '@/lib/payoutSettings';
import { PAYOUT_CATEGORIES } from '@/lib/payout';

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

  const categories = {};
  for (const key of PAYOUT_CATEGORIES) {
    const rawCat = (body.categories && body.categories[key]) || {};
    const tiers = Array.isArray(rawCat.tiers) ? rawCat.tiers : [];
    for (const t of tiers) {
      if (t && t.upTo !== '' && t.upTo != null && !(Number(t.upTo) > 0)) {
        return Response.json({ error: `Each tier's "to" value must be a positive number, or left blank for the open-ended top tier.` }, { status: 400 });
      }
      if (!(Number(t?.rate) >= 0)) {
        return Response.json({ error: 'Each tier needs a payout percentage of 0 or more.' }, { status: 400 });
      }
    }
    categories[key] = { enabled: rawCat.enabled !== false, tiers };
  }

  const saved = await savePayoutConfig({ period, categories }, employee.id);
  return Response.json(saved);
}
