import { NextResponse } from 'next/server';
import { dbList } from '@/lib/db';
import { verifyPassword, encodePartnerSession, getPartner, PARTNER_COOKIE } from '@/lib/auth';
import { cookies } from 'next/headers';

// "Who am I" check — the client-side session gate (see components/partner/ui.jsx's
// useSessionGate) calls this on every cold app open/page load instead of blocking the page's
// own server render on a DB round trip. Never hand the password hash to the client.
export async function GET() {
  const partner = await getPartner();
  if (!partner) return NextResponse.json({ authenticated: false }, { status: 401 });
  const { password, ...safe } = partner;
  return NextResponse.json({ authenticated: true, partner: safe });
}

export async function POST(request) {
  const { phone, password } = await request.json();
  if (!phone || !password) return NextResponse.json({ error: 'Phone and password required' }, { status: 400 });

  const partners = await dbList('partners');
  const acct = partners.find((p) => String(p.phone || '').replace(/\D/g, '').slice(-10) === String(phone).replace(/\D/g, '').slice(-10));
  if (!acct || acct.active === false) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

  const ok = await verifyPassword(password, acct.password);
  if (!ok) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

  let token;
  try {
    token = encodePartnerSession(acct.id);
  } catch (e) {
    console.error('[auth/partner] session signing failed:', e.message);
    return NextResponse.json(
      { error: 'Server is not configured for sessions yet — set AUTH_SECRET (or DATABASE_URL) in your deployment environment variables.' },
      { status: 500 }
    );
  }

  const res = NextResponse.json({ success: true, partner: { id: acct.id, name: acct.name, phone: acct.phone, businessName: acct.businessName } });
  res.cookies.set(PARTNER_COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

export async function DELETE() {
  (await cookies()).delete(PARTNER_COOKIE);
  return NextResponse.json({ success: true });
}
