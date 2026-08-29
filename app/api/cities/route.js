// Read-only, unauthenticated list of the cities Heseos operates in (managed at
// Admin -> Settings -> Cities, see lib/cities.js). Just city names — no PII, safe to expose
// to anything that needs a city picker, starting with the partner app's "Punch New Lead" form
// (so a partner can only submit a lead for a city we actually serve). Adding/removing cities
// stays admin-only at /api/admin/cities.
import { getCities } from '@/lib/cities';

export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({ cities: await getCities() });
}
