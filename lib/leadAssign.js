// Auto-assigns a brand-new lead to a pre-sales executive AND a sales engineer whose profile
// lists the same city as the lead — so both panels have a working queue the moment a lead
// comes in, instead of everything sitting unassigned until an admin manually distributes it.
//
// Matching: exact city match (case/whitespace-insensitive) against the employee's `location`
// field. Load-balanced: among the active employees whose city matches, picks whoever
// currently carries the fewest OPEN leads in that role (Converted/Rejected don't count) —
// so leads spread evenly across a city's team instead of always landing on the same person.
// No match in that city → left unassigned, exactly as before; an admin can still assign
// manually from the Leads table.

import { dbList } from '@/lib/db';
import { stageOf } from '@/lib/leadStage';

function norm(s) {
  return String(s || '').trim().toLowerCase();
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
// that role has a matching city on file.
export async function autoAssignByCity(city) {
  const cityN = norm(city);
  if (!cityN) return { assignedTo: null, salesEngineerId: null };

  const [employees, leads] = await Promise.all([dbList('employees'), dbList('leads')]);
  const active = employees.filter((e) => e.active !== false && norm(e.location) === cityN);

  const presales = pickLeastLoaded(active.filter((e) => e.role === 'presales'), leads, 'assignedTo');
  const engineer = pickLeastLoaded(active.filter((e) => e.role === 'sales_engineer'), leads, 'salesEngineerId');

  return { assignedTo: presales ? presales.id : null, salesEngineerId: engineer ? engineer.id : null };
}
