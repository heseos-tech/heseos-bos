// POST /api/investors/verify — step 2: checks the code (from WhatsApp OR email, they're the same
// code), records the NDA acceptance and sets the signed access cookie.
import { NextResponse } from 'next/server';
import { dbGetById, dbPatch } from '@/lib/db';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import {
  otpHash, recordAccept, encodeInvestorSession, investorCookieOptions, notifyTeamOfAccess,
  INVESTOR_COOKIE, OTP_MAX_ATTEMPTS,
} from '@/lib/investorAccess';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }
  const id = String(body.challengeId || '');
  const code = String(body.code || '').replace(/\D/g, '');
  if (!id || code.length !== 6) return NextResponse.json({ error: 'Enter the 6-digit code.' }, { status: 400 });

  const ip = getClientIp(request);
  const rl = await checkRateLimit(`inv-vf:${ip}`, { max: 30, windowMs: 30 * 60 * 1000 });
  if (!rl.allowed) return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });

  const ch = await dbGetById('investor_otps', id);
  if (!ch || ch.used) return NextResponse.json({ error: 'This code is no longer valid. Please request a new one.', expired: true }, { status: 400 });
  if (Date.now() > ch.expiresAt) return NextResponse.json({ error: 'This code has expired. Please request a new one.', expired: true }, { status: 400 });
  if ((ch.attempts || 0) >= OTP_MAX_ATTEMPTS) return NextResponse.json({ error: 'Too many wrong attempts. Please request a new code.', expired: true }, { status: 400 });

  const ok = otpHash(id, code) === ch.codeHash;
  if (!ok) {
    const attempts = (ch.attempts || 0) + 1;
    await dbPatch('investor_otps', id, { attempts });
    const left = OTP_MAX_ATTEMPTS - attempts;
    return NextResponse.json({ error: left > 0 ? `That code is not right. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'Too many wrong attempts. Please request a new code.', expired: left <= 0 }, { status: 400 });
  }

  await dbPatch('investor_otps', id, { used: true, usedAt: new Date().toISOString() });
  const via = ch.sentWhatsApp && ch.sentEmail ? 'whatsapp/email' : ch.sentWhatsApp ? 'whatsapp' : ch.sentEmail ? 'email' : 'dev';
  const row = await recordAccept({ name: ch.name, phone: ch.phone, email: ch.email, via, ip, ua: request.headers.get('user-agent') });
  notifyTeamOfAccess(row);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(INVESTOR_COOKIE, encodeInvestorSession(row.id), investorCookieOptions());
  return res;
}
