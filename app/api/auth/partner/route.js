import { NextResponse } from 'next/server';
import { dbList } from '@/lib/db';
import { verifyPassword, encodePartnerSession, PARTNER_COOKIE } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST(request) {
  const { phone, password } = await request.json();
  if (!phone || !password) return NextResponse.json({ error: 'Phone and password required' }, { status: 400 });

  const partners = await dbList('partners');
  const acct = partners.find((p) => String(p.phone || '').replace(/\D/g, '').slice(-10) === String(phone).replace(/\D/g, '').slice(-10));
  if (!acct || acct.active === false) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

  const ok = await verifyPassword(password, acct.password);
  if (!ok) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

  const res = NextResponse.json({ success: true, partner: { id: acct.id, name: acct.name, phone: acct.phone, businessName: acct.businessName } });
  res.cookies.set(PARTNER_COOKIE, encodePartnerSession(acct.id), {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

export async function DELETE() {
  (await cookies()).delete(PARTNER_COOKIE);
  return NextResponse.json({ success: true });
}
