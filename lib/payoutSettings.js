// Server-side storage for the lead-conversion payout config — one singleton row in the existing
// generic `settings` table (see lib/db.js's ALLOWED list; no new table needed), holding the
// shared period plus each category's own enabled flag and tier ladder (see lib/payout.js's
// PAYOUT_CATEGORIES). Read by app/api/payout-settings/route.js (any logged-in partner/employee,
// read-only) and written only through that same route's PUT, gated to admins. lib/payout.js does
// the actual math; this file is only responsible for getting the config in and out of the
// database.

import { dbGetById, dbInsert } from '@/lib/db';
import { DEFAULT_PAYOUT_CONFIG, normalizeConfig } from '@/lib/payout';

const SETTINGS_ID = 'payout';

export async function getPayoutConfig() {
  const row = await dbGetById('settings', SETTINGS_ID);
  if (!row) return { ...DEFAULT_PAYOUT_CONFIG };
  return normalizeConfig(row);
}

export async function savePayoutConfig({ period, categories }, updatedBy) {
  const clean = normalizeConfig({ period, categories });
  const row = { id: SETTINGS_ID, ...clean, updatedAt: new Date().toISOString(), updatedBy: updatedBy || null };
  await dbInsert('settings', SETTINGS_ID, row);
  return clean;
}
