// Gate for the investment proposal at /investors. A visitor gives name + phone, reads and accepts
// the NDA (lib/investorNda.js), then gets a 6-digit code on WhatsApp — typing it in proves the
// number is theirs and opens the proposal for a few days via a signed cookie.
//
//  investor_otps    one row per code request (code stored only as an HMAC, never in clear)
//  investor_access  one row per person who verified: the NDA acceptance record + last-open time
//
// The proposal HTML itself lives in /private (never in /public) and is served only by
// app/api/investors/proposal/route.js to a request carrying a valid cookie.

import crypto from 'crypto';
import { cookies } from 'next/headers';
import { dbGetById, dbInsert, dbPatch } from '@/lib/db';
import { botSendTemplate, botWaConfigured } from '@/lib/botWhatsapp';
import { getHeseosBotTenant } from '@/lib/attribution';
import { NDA_VERSION } from '@/lib/investorNda';

export const INVESTOR_COOKIE = 'heseos_investor';
export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const SESSION_MS = 3 * 24 * 60 * 60 * 1000;

const secret = () =>
  process.env.AUTH_SECRET ||
  process.env.DATABASE_URL ||
  (process.env.NODE_ENV === 'production' ? null : 'heseos-dev-session-secret');

const hmac = (s) => {
  const k = secret();
  if (!k) throw new Error('AUTH_SECRET is required');
  return crypto.createHmac('sha256', k).update(s).digest('base64url');
};
const safeEq = (a, b) => {
  const x = Buffer.from(String(a)); const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// ── Input cleaning ───────────────────────────────────────────────────────────
export function cleanName(v) { return String(v || '').replace(/\s+/g, ' ').trim().slice(0, 80); }
// Returns digits with country code (what WhatsApp needs), or '' if it can't be a phone number.
// 10 digits (optionally with a leading 0) = Indian mobile; otherwise the number must already carry a country code.
export function cleanPhone(v) {
  let d = String(v || '').replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  if (d.length === 10) return /^[6-9]/.test(d) ? `91${d}` : '';
  return d.length >= 11 && d.length <= 15 ? d : '';
}
export const maskPhone = (p) => (p.length > 5 ? `+${p.slice(0, 2)}${'•'.repeat(Math.max(0, p.length - 6))}${p.slice(-4)}` : '•••');

// ── One-time codes ───────────────────────────────────────────────────────────
export const newOtp = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');
export const otpHash = (challengeId, code) => hmac(`otp:${challengeId}:${code}`);

// ── Session cookie ───────────────────────────────────────────────────────────
export function encodeInvestorSession(accessId) {
  const payload = Buffer.from(JSON.stringify({ typ: 'investor', sub: accessId, exp: Date.now() + SESSION_MS })).toString('base64url');
  return `${payload}.${hmac(payload)}`;
}
function decodeInvestorSession(token) {
  if (!token) return null;
  const [payload, sig] = String(token).split('.');
  if (!payload || !sig) return null;
  try {
    if (!safeEq(sig, hmac(payload))) return null;
    const d = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return d && d.typ === 'investor' && d.sub && d.exp > Date.now() ? String(d.sub) : null;
  } catch { return null; }
}
export const investorCookieOptions = () => ({
  httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/',
  maxAge: Math.floor(SESSION_MS / 1000),
});

// The signed-in investor (their investor_access row), or null.
export async function getInvestor() {
  const jar = await cookies();
  const id = decodeInvestorSession(jar.get(INVESTOR_COOKIE)?.value);
  if (!id) return null;
  const row = await dbGetById('investor_access', id);
  return row && !row.revoked && row.ndaVersion ? row : null;
}

export async function recordAccept({ name, phone, via, ip, ua }) {
  const now = new Date().toISOString();
  const id = `inv_${crypto.randomBytes(9).toString('base64url')}`;
  const row = {
    id, name, phone, ndaVersion: NDA_VERSION, acceptedAt: now, verifiedVia: via,
    ip, userAgent: String(ua || '').slice(0, 300), lastOpenedAt: now, opens: 1, revoked: false,
  };
  await dbInsert('investor_access', id, row);
  return row;
}
export async function touchInvestor(row) {
  try { await dbPatch('investor_access', row.id, { lastOpenedAt: new Date().toISOString(), opens: (row.opens || 0) + 1 }); } catch { /* best effort */ }
}

// ── Delivery ─────────────────────────────────────────────────────────────────
// WhatsApp: an approved Meta *Authentication* template (default name investor_otp, language en_US:
// body "{{1}} is your verification code…" + the Copy-code button). Sent straight through the Meta
// API and deliberately NOT logged into the Inbox — the code must not sit in a chat thread.
export async function sendOtpWhatsApp(phone, code) {
  try {
    const tenant = await getHeseosBotTenant();
    if (!tenant || !botWaConfigured(tenant)) return { ok: false, error: 'WhatsApp not configured' };
    const noButton = process.env.INVESTOR_OTP_TEMPLATE_NO_BUTTON === 'true';
    const res = await botSendTemplate(
      { phoneNumberId: tenant.waPhoneNumberId, token: tenant.waAccessToken },
      phone,
      {
        name: process.env.INVESTOR_OTP_TEMPLATE || 'investor_otp',
        language: process.env.INVESTOR_OTP_TEMPLATE_LANG || 'en_US',
        params: [code],
        buttons: noButton ? [] : [{ type: 'url', text: code }],
      }
    );
    return res;
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function resendEmail({ to, subject, html, text }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: 'Email not configured (RESEND_API_KEY)' };
  const from = process.env.INVESTOR_EMAIL_FROM || process.env.RESEND_FROM || 'Heseos <onboarding@resend.dev>';
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, html, text }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) console.error('Investor email send failed:', JSON.stringify(data));
    return { ok: res.ok, error: res.ok ? null : (data.message || `HTTP ${res.status}`) };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}

// Heads-up to the Heseos team that someone just got in. Best effort.
export function notifyTeamOfAccess(row) {
  const to = process.env.NOTIFY_EMAIL;
  if (!to) return Promise.resolve();
  return resendEmail({
    to,
    subject: `Investor proposal opened — ${row.name}`,
    text: `${row.name}\n${row.phone}\nAccepted NDA v${row.ndaVersion} at ${row.acceptedAt}.`,
    html: `<p><b>${esc(row.name)}</b> just accepted the NDA and opened the investment proposal.</p><p>${esc(row.phone)}<br>NDA v${esc(row.ndaVersion)} · ${esc(row.acceptedAt)}</p>`,
  }).catch(() => {});
}
