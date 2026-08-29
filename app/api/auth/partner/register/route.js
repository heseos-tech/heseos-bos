// app/api/auth/partner/register/route.js
// Self-serve partner sign-up — "Join the Heseos Partner Network". Creates a new partner
// account (hashed password, same pbkdf2 scheme as everywhere else in lib/auth.js), then signs
// the partner straight in, matching the mobile app's "Create Account" → dashboard flow.

import { NextResponse } from 'next/server';
import { dbList, dbInsert } from '@/lib/db';
import { hashPassword, encodePartnerSession, PARTNER_COOKIE } from '@/lib/auth';

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const name = String(body.name || '').trim();
  const phoneDigits = String(body.phone || '').replace(/\D/g, '').slice(-10);
  const password = String(body.password || '');
  const businessName = String(body.businessName || '').trim();

  if (!name || !password) return NextResponse.json({ error: 'Name and password are required' }, { status: 400 });
  if (phoneDigits.length !== 10) return NextResponse.json({ error: 'Please enter a valid 10-digit mobile number' }, { status: 400 });
  if (password.length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });

  const partners = await dbList('partners');
  const exists = partners.some((p) => String(p.phone || '').replace(/\D/g, '').slice(-10) === phoneDigits);
  if (exists) return NextResponse.json({ error: 'An account already exists for this mobile number' }, { status: 409 });

  const id = `PTR${Date.now().toString().slice(-8)}`;
  const acct = {
    id,
    name,
    businessName: businessName || name,
    phone: phoneDigits,
    password: await hashPassword(password),
    type: 'shop',
    active: true,
    createdAt: new Date().toISOString(),
  };
  await dbInsert('partners', id, acct);

  let token;
  try {
    token = encodePartnerSession(id);
  } catch (e) {
    console.error('[auth/partner/register] session signing failed:', e.message);
    return NextResponse.json({ success: true, id, note: 'Account created — please log in.' });
  }

  const res = NextResponse.json({ success: true, partner: { id, name: acct.name, phone: acct.phone, businessName: acct.businessName } });
  res.cookies.set(PARTNER_COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
