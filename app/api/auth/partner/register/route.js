// app/api/auth/partner/register/route.js
// Self-serve partner sign-up — "Join the Heseos Partner Network". Creates a new partner
// account (hashed password, same pbkdf2 scheme as everywhere else in lib/auth.js), then signs
// the partner straight in, matching the mobile app's "Create Account" → dashboard flow.
//
// The Installer app (/installer/signup) uses this same endpoint with `type: 'installer'` — an
// installation partner is just a partner of type 'installer' whose city (looked up from the pincode they
// sign up with; older accounts may hold several, comma separated) decides which installation jobs they can see and claim (lib/installJobs.js). No
// Heseos staff step is needed; Admin can still deactivate an account from Admin → Partners.

import { NextResponse } from 'next/server';
import { dbList, dbInsert } from '@/lib/db';
import { hashPassword, encodePartnerSession, PARTNER_COOKIE } from '@/lib/auth';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { resolveServiceArea } from '@/lib/pincodeLookup';

export async function POST(request) {
  // Per-IP throttle (storage-backed, see lib/rateLimit.js) — checked first so a blocked request
  // costs almost nothing. Generous enough for a shared mobile-network IP.
  const rl = await checkRateLimit(`partner-register:${getClientIp(request)}`, { max: 10, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) return NextResponse.json({ error: 'Too many sign-up attempts. Please try again later.' }, { status: 429 });

  const body = await request.json().catch(() => ({}));
  const name = String(body.name || '').trim();
  const phoneDigits = String(body.phone || '').replace(/\D/g, '').slice(-10);
  const password = String(body.password || '');
  const businessName = String(body.businessName || '').trim();
  const isInstaller = body.type === 'installer';

  if (!name || !password) return NextResponse.json({ error: 'Name and password are required' }, { status: 400 });
  if (phoneDigits.length !== 10) return NextResponse.json({ error: 'Please enter a valid 10-digit mobile number' }, { status: 400 });
  if (password.length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });

  // Pincode is mandatory for every partner and installer. City + state are never taken from the
  // client — they come from the pincode (India Post lookup), so nobody can type a made-up city.
  // For an installer that city is what decides which installation jobs they can see and claim.
  const area = await resolveServiceArea(body.pincode);
  if (!area.ok) return NextResponse.json({ error: area.error }, { status: area.status });
  const { pincode, city, state } = area;

  const partners = await dbList('partners');
  const exists = partners.some((p) => String(p.phone || '').replace(/\D/g, '').slice(-10) === phoneDigits);
  if (exists) return NextResponse.json({ error: 'An account already exists for this mobile number — please log in' }, { status: 409 });

  const id = `PTR${Date.now().toString().slice(-8)}`;
  const acct = {
    id,
    name,
    businessName: businessName || name,
    phone: phoneDigits,
    password: await hashPassword(password),
    type: isInstaller ? 'installer' : 'shop',
    pincode,
    city,
    ...(state ? { state } : {}),
    ...(isInstaller ? { signupVia: 'installer_app' } : {}),
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

  const res = NextResponse.json({ success: true, partner: { id, name: acct.name, phone: acct.phone, businessName: acct.businessName, type: acct.type } });
  res.cookies.set(PARTNER_COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
