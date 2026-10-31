// PUBLIC — the landing-page order form asks this for the city + state of a pincode the moment the customer
// types the 6th digit (see public/door-lock/index.html). Returns { city, state } (either may be '' if unknown).
import { checkServiceArea, NOT_SERVICEABLE_MESSAGE } from '@/lib/serviceArea';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const pin = String(new URL(request.url).searchParams.get('pin') || '').replace(/\D/g, '');
  if (!/^\d{6}$/.test(pin)) return Response.json({ city: '', state: '' }, { status: 400 });
  const a = await checkServiceArea(pin);
  // `serviceable` is only false when we KNOW the city and it isn't one we serve; an unknown pincode stays "not found".
  return Response.json(
    { city: a.city, state: a.state, serviceable: a.known ? a.serviceable : null, ...(a.known && !a.serviceable ? { message: NOT_SERVICEABLE_MESSAGE } : {}) },
    { headers: { 'Cache-Control': 'public, max-age=3600' } },
  );
}
