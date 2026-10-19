// app/api/partner/delete-account/route.js — delete my Partner / Installer account.
//
// Two ways in, both re-checked with the account password:
//   • signed in (in-app Profile → Delete Account): body { password }
//   • public web form (/delete-account — the URL given to Google Play): body { phone, password }
// See lib/accountDeletion.js for exactly what is removed and what is kept.
import { NextResponse } from 'next/server';
import { dbList } from '@/lib/db';
import { getPartner, verifyPassword, PARTNER_COOKIE } from '@/lib/auth';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { deletePartnerAccount } from '@/lib/accountDeletion';

export const dynamic = 'force-dynamic';

const last10 = (v) => String(v || '').replace(/\D/g, '').slice(-10);

export async function POST(request) {
  const rl = await checkRateLimit(`partner-delete:${getClientIp(request)}`, { max: 10, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });

  const body = await request.json().catch(() => ({}));
  const password = String(body.password || '');
  if (!password) return NextResponse.json({ error: 'Please enter your password' }, { status: 400 });

  let partner = null;
  if (body.phone) {
    const digits = last10(body.phone);
    if (digits.length !== 10) return NextResponse.json({ error: 'Please enter a valid 10-digit mobile number' }, { status: 400 });
    const partners = await dbList('partners');
    partner = partners.find((p) => !p.deleted && last10(p.phone) === digits) || null;
  } else {
    partner = await getPartner();
    if (!partner) return NextResponse.json({ error: 'Please log in again, or use the web form at /delete-account' }, { status: 401 });
  }

  const ok = partner && partner.password ? await verifyPassword(password, partner.password).catch(() => false) : false;
  if (!ok) return NextResponse.json({ error: 'Invalid mobile number or password' }, { status: 401 });

  const result = await deletePartnerAccount(partner);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  const res = NextResponse.json({ success: true });
  res.cookies.set(PARTNER_COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 });
  return res;
}
