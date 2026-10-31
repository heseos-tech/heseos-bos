// app/api/shop/door-lock/notify-me/route.js
// PUBLIC — for visitors whose pincode is outside the area we serve (Pune today, see lib/serviceArea.js).
// The landing page calls it (a) quietly, as soon as such a pincode is typed, and (b) when the visitor taps
// "Notify me" after leaving a name and mobile number. The pincode is looked up again HERE — a request for a
// pincode that IS serviceable is ignored — and the request is stored in the landing_activity collection
// (kind 'unserviceable'), which Admin -> Landing Activity reports on. No order is created, nothing is sent.
import { checkServiceArea, recordUnserviceable } from '@/lib/serviceArea';
import { indianMobile } from '@/lib/heseosDoorLock';
import { getClientIp } from '@/lib/rateLimit';
import { geoFromHeaders } from '@/lib/userAgent';

export const dynamic = 'force-dynamic';
const clean = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid request' }, { status: 400 }); }
  if (body?.website) return Response.json({ ok: true }); // honeypot
  const pincode = String(body?.pincode || '').replace(/\D/g, '');
  if (!/^\d{6}$/.test(pincode)) return Response.json({ error: 'Please enter a valid 6-digit pincode.' }, { status: 400 });
  const name = clean(body?.name, 60);
  const rawPhone = String(body?.phone || '').trim();
  const mobile = rawPhone ? indianMobile(rawPhone) : '';
  if (rawPhone && !mobile) return Response.json({ error: 'Please enter a valid 10-digit mobile number.' }, { status: 400 });
  if (body?.wantsCallback && !mobile) return Response.json({ error: 'Please enter a valid 10-digit mobile number.' }, { status: 400 });

  const area = await checkServiceArea(pincode);
  if (!area.known) return Response.json({ ok: true, recorded: false });
  if (area.serviceable) return Response.json({ ok: true, serviceable: true, recorded: false });
  const row = await recordUnserviceable({
    pincode, city: area.city, state: area.state, name, phone: mobile, sid: clean(body?.sid, 40),
    ip: getClientIp(request), geo: geoFromHeaders(request.headers), source: body?.wantsCallback ? 'notify_me' : 'pincode_check', wantsCallback: !!body?.wantsCallback,
  });
  return Response.json({ ok: true, serviceable: false, recorded: !!row, city: area.city });
}
