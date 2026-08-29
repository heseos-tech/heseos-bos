// The admin-controlled list of operating cities — populated from Admin -> Settings. Feeds the
// City dropdowns on Add Partner / Add Sales Engineer / Add Pre-sales, so partners and sales
// engineers can only be assigned to a city the business actually operates in (matching one of
// these is also what makes city-based lead auto-assignment (lib/leadAssign.js) work reliably).
//
// Storage: a single row in the `settings` table, id 'cities'. Shape: { cities: string[] }.

import { dbGetById, dbInsert } from '@/lib/db';

const SETTINGS_ID = 'cities';

function norm(s) {
  return String(s || '').trim().toLowerCase();
}

export async function getCities() {
  const row = await dbGetById('settings', SETTINGS_ID);
  const cities = Array.isArray(row?.cities) ? row.cities : [];
  return cities.slice().sort((a, b) => a.localeCompare(b));
}

export async function addCity(city) {
  const clean = String(city || '').trim();
  if (!clean) throw new Error('City name is required');
  const existing = await getCities();
  if (existing.some((c) => norm(c) === norm(clean))) return existing; // already there
  const next = [...existing, clean].sort((a, b) => a.localeCompare(b));
  await dbInsert('settings', SETTINGS_ID, { id: SETTINGS_ID, cities: next, updatedAt: new Date().toISOString() });
  return next;
}

export async function removeCity(city) {
  const existing = await getCities();
  const next = existing.filter((c) => norm(c) !== norm(city));
  await dbInsert('settings', SETTINGS_ID, { id: SETTINGS_ID, cities: next, updatedAt: new Date().toISOString() });
  return next;
}
