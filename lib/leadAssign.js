// Auto-assigns a brand-new lead to a pre-sales executive AND a sales engineer whose profile
// covers the lead's city — so both panels have a working queue the moment a lead comes in,
// instead of everything sitting unassigned until an admin manually distributes it.
//
// Sales engineers (and partners) are pinned to exactly one city — they physically visit, so
// only an exact match on `location` counts. Pre-sales can cover several specific cities, or
// every city ('All Cities'), stored as an array in `cities` (see app/api/admin/employees).
// Matching prefers a pre-sales rep whose `cities` list names this exact city; only when no
// such rep exists does it fall back to an 'All Cities' rep, so dedicated city coverage always
// wins over the catch-all. No match at all -> left unassigned, same as before — an admin can
// still assign manually from the Leads table.
//
// Load-balanced: among tied candidates, picks whoever currently carries the fewest OPEN leads
// in that role (Converted/Rejected don't count), so work spreads evenly across a team.

import { dbList } from '@/lib/db';
import { stageOf } from '@/lib/leadStage';

function norm(s) {
  return String(s || '').trim().toLowerCase();
}

// A pre-sales employee's covered cities. Reads the structured `cities` array when present;
// falls back to treating `location` as a single city for older records saved before `cities`
// existed. Returns { all: boolean, cities: Set<normalized city> }.
function presalesCoverage(employee) {
  const list = Array.isArray(employee.cities) && employee.cities.length ? employee.cities : (employee.location ? [employee.location] : []);
  const all = list.some((c) => norm(c) === 'all' || norm(c) === 'all cities');
  return { all, cities: new Set(list.map(norm)) };
}

function pickLeastLoaded(candidates, leads, field) {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  const load = new Map(candidates.map((e) => [e.id, 0]));
  for (const l of leads) {
    const id = l[field];
    if (id && load.has(id) && stageOf(l) !== 'Converted' && stageOf(l) !== 'Rejected') {
      load.set(id, load.get(id) + 1);
    }
  }
  return candidates
    .slice()
    .sort((a, b) => (load.get(a.id) - load.get(b.id)) || String(a.createdAt).localeCompare(String(b.createdAt)))[0];
}

// Returns { assignedTo, salesEngineerId } — either can be null when no active employee in
// that role covers the lead's city.
export async function autoAssignByCity(city) {
  const cityN = norm(city);
  if (!cityN) return { assignedTo: null, salesEngineerId: null };

  const [employees, leads] = await Promise.all([dbList('employees'), dbList('leads')]);
  const active = employees.filter((e) => e.active !== false);

  // Sales engineers: exact single-city match only.
  const engineerCandidates = active.filter((e) => e.role === 'sales_engineer' && norm(e.location) === cityN);
  const engineer = pickLeastLoaded(engineerCandidates, leads, 'salesEngineerId');

  // Pre-sales: dedicated-city reps first, 'All Cities' reps only as a fallback.
  const presalesAll = active.filter((e) => e.role === 'presales');
  const cityReps = presalesAll.filter((e) => { const cov = presalesCoverage(e); return !cov.all && cov.cities.has(cityN); });
  const allCityReps = presalesAll.filter((e) => presalesCoverage(e).all);
  const presales = pickLeastLoaded(cityReps.length ? cityReps : allCityReps, leads, 'assignedTo');

  return { assignedTo: presales ? presales.id : null, salesEngineerId: engineer ? engineer.id : null };
}
