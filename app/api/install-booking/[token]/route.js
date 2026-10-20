// app/api/install-booking/[token]/route.js — the customer's "Book installation" submit
// (components/BookInstallationForm.jsx). Public but token-gated + rate limited; see lib/installBooking.js.
import { verifyInstallBookingToken, submitInstallBooking } from '@/lib/installBooking';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  const { token } = await params;
  const orderId = verifyInstallBookingToken(decodeURIComponent(token || ''));
  if (!orderId) return Response.json({ error: 'This booking link is not valid' }, { status: 404 });

  const rl = await checkRateLimit(`install-booking:${getClientIp(request)}`, { max: 30, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) return Response.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });

  const body = await request.json().catch(() => ({}));
  const r = await submitInstallBooking(orderId, { date: body.date, slot: body.slot, note: body.note });
  if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
  return Response.json({ success: true, installDate: r.order.installDate, installSlot: r.order.installSlot });
}
