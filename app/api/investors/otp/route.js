// POST /api/investors/otp — step 1 of the /investors gate. Validates name/phone/email + NDA
// acceptance, then sends the same 6-digit code to the person's WhatsApp and email.
import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { dbInsert } from '@/lib/db';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { NDA_VERSION } from '@/lib/investorNda';
import {
  cleanName, cleanEmail, cleanPhone, maskPhone, maskEmail,
  newOtp, otpHash, sendOtpWhatsApp, sendOtpEmail, OTP_TTL_MS,
} from '@/lib/investorAccess';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }

  const name = cleanName(body.name);
  const email = cleanEmail(body.email);
  const phone = cleanPhone(body.phone);
  if (name.length < 2) return NextResponse.json({ error: 'Please enter your full name.' }, { status: 400 });
  if (!phone) return NextResponse.json({ error: 'Please enter a valid mobile number (10 digits, or with country code).' }, { status: 400 });
  if (!email) return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  if (body.ndaAccepted !== true || body.ndaVersion !== NDA_VERSION) {
    return NextResponse.json({ error: 'Please read and accept the NDA to continue.' }, { status: 400 });
  }

  const ip = getClientIp(request);
  const [byIp, byPhone, cool] = await Promise.all([
    checkRateLimit(`inv-ip:${ip}`, { max: 12, windowMs: 30 * 60 * 1000 }),
    checkRateLimit(`inv-ph:${phone}`, { max: 6, windowMs: 30 * 60 * 1000 }),
    checkRateLimit(`inv-cd:${phone}`, { max: 1, windowMs: 25 * 1000 }),
  ]);
  if (!cool.allowed) return NextResponse.json({ error: 'A code was just sent. Please wait a few seconds before asking for another.' }, { status: 429 });
  if (!byIp.allowed || !byPhone.allowed) return NextResponse.json({ error: 'Too many attempts. Please try again in a little while.' }, { status: 429 });

  const code = newOtp();
  const id = `otp_${crypto.randomBytes(9).toString('base64url')}`;
  const [wa, mail] = await Promise.all([sendOtpWhatsApp(phone, code), sendOtpEmail(email, name, code)]);

  const devMode = process.env.NODE_ENV !== 'production';
  if (!wa.ok && !mail.ok && !devMode) {
    console.error('Investor OTP not delivered:', { wa: wa.error, mail: mail.error });
    return NextResponse.json({ error: 'We could not send the code right now. Please try again in a minute, or contact the Heseos team.' }, { status: 502 });
  }
  if (devMode && !wa.ok && !mail.ok) console.log(`[investors] DEV OTP for ${phone} / ${email}: ${code}`);

  const now = Date.now();
  await dbInsert('investor_otps', id, {
    id, codeHash: otpHash(id, code), name, phone, email, ip,
    userAgent: String(request.headers.get('user-agent') || '').slice(0, 300),
    sentWhatsApp: wa.ok, sentEmail: mail.ok,
    attempts: 0, used: false, createdAt: new Date(now).toISOString(), expiresAt: now + OTP_TTL_MS,
  });

  return NextResponse.json({
    ok: true, challengeId: id,
    sent: { whatsapp: wa.ok, email: mail.ok },
    to: { whatsapp: maskPhone(phone), email: maskEmail(email) },
    ...(devMode && !wa.ok && !mail.ok ? { devCode: code } : {}),
  });
}
