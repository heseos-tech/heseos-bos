// Session auth for the employee interface + partner portal. Ported from MARG's
// lib/adminAuth.js / lib/partnerAuth.js pattern: HMAC-signed cookies, no external
// auth provider needed to get started.

import crypto from 'crypto';
import { cookies } from 'next/headers';
import { dbGetById } from '@/lib/db';
export { EMPLOYEE_ROLES } from '@/lib/formOptions'; // re-exported for server-side callers only

export const EMPLOYEE_COOKIE = 'heseos_employee';
export const PARTNER_COOKIE = 'heseos_partner';
export const BOT_COOKIE = 'heseos_bot_tenant';

const secret = () =>
  process.env.AUTH_SECRET ||
  process.env.DATABASE_URL ||
  (process.env.NODE_ENV === 'production' ? null : 'heseos-dev-session-secret');

const b64url = (v) => Buffer.from(v).toString('base64url');
const sign = (payload) => {
  const s = secret();
  if (!s) throw new Error('AUTH_SECRET is required for sessions');
  return crypto.createHmac('sha256', s).update(payload).digest('base64url');
};

function encodeSession(typ, id) {
  const payload = b64url(JSON.stringify({ typ, sub: String(id), iat: Date.now() }));
  return `${payload}.${sign(payload)}`;
}
function decodeSession(typ, token) {
  if (!token) return null;
  const [payload, sig] = String(token).split('.');
  if (!payload || !sig) return null;
  try {
    const expected = sign(payload);
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return data && data.typ === typ && data.sub ? String(data.sub) : null;
  } catch {
    return null;
  }
}

export const encodeEmployeeSession = (id) => encodeSession('employee', id);
export const encodePartnerSession = (id) => encodeSession('partner', id);
export const encodeBotSession = (id) => encodeSession('bot_tenant', id);

export async function getEmployee() {
  const token = (await cookies()).get(EMPLOYEE_COOKIE)?.value;
  const id = decodeSession('employee', token);
  if (!id) return null;
  const acct = await dbGetById('employees', id);
  return acct && acct.active !== false ? acct : null;
}

export async function getPartner() {
  const token = (await cookies()).get(PARTNER_COOKIE)?.value;
  const id = decodeSession('partner', token);
  if (!id) return null;
  const acct = await dbGetById('partners', id);
  return acct && acct.active !== false ? acct : null;
}

// Heseos Bot platform — self-service client account (see app/bot/*). Same signed-cookie
// session shape as employee/partner, just a third "typ" so tokens never cross over. A pending
// or rejected signup (see app/api/admin/bot-tenants) never gets a working session even if a
// cookie somehow exists for it — the login route already refuses to issue one, this is just
// defense in depth. Tenants created before the approval gate existed have no approvalStatus
// field, so they're grandfathered in as approved.
export async function getBotTenant() {
  const token = (await cookies()).get(BOT_COOKIE)?.value;
  const id = decodeSession('bot_tenant', token);
  if (!id) return null;
  const acct = await dbGetById('bot_tenants', id);
  if (!acct || acct.active === false) return null;
  if (acct.approvalStatus === 'pending' || acct.approvalStatus === 'rejected') return null;
  return acct;
}

// ── Password hashing (pbkdf2) — ported verbatim from MARG ────────────────────
export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('base64url');
  const iterations = 120000;
  const key = await new Promise((resolve, reject) => {
    crypto.pbkdf2(String(password), salt, iterations, 32, 'sha256', (err, derived) => (err ? reject(err) : resolve(derived)));
  });
  return `pbkdf2$${iterations}$${salt}$${key.toString('base64url')}`;
}

export async function verifyPassword(password, stored) {
  const value = String(stored || '');
  if (value.startsWith('pbkdf2$')) {
    const [, iterRaw, salt, expected] = value.split('$');
    const iterations = Number(iterRaw);
    if (!iterations || !salt || !expected) return false;
    const key = await new Promise((resolve, reject) => {
      crypto.pbkdf2(String(password), salt, iterations, 32, 'sha256', (err, derived) => (err ? reject(err) : resolve(derived)));
    });
    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(key.toString('base64url')));
    } catch {
      return false;
    }
  }
  // Dev convenience: plain-text password match when nothing has been hashed yet.
  return value !== '' && value === String(password);
}
