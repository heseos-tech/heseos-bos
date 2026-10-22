// PUBLIC — the landing-page order form asks this for the city + state of a pincode the moment the customer
// types the 6th digit (see public/door-lock/index.html). Returns { city, state } (either may be '' if unknown).
import { lookupPincode } from '@/lib/pincodeLookup';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const pin = String(new URL(request.url).searchParams.get('pin') || '').replace(/\D/g, '');
  if (!/^\d{6}$/.test(pin)) return Response.json({ city: '', state: '' }, { status: 400 });
  return Response.json(await lookupPincode(pin), { headers: { 'Cache-Control': 'public, max-age=3600' } });
}
