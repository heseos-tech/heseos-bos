// lib/quotationShare.js
// Signs/verifies a compact, unguessable public link to one quotation revision — the "quotation
// link" a customer gets alongside the PDF on WhatsApp, separate from the employee-only,
// session-gated GET /api/leads/[id]/quotation-pdf route (app/quotation/[token]/page.js and
// app/api/quotation/[token]/pdf/route.js are the two places that check this token instead).
//
// Deliberately stateless: nothing new is written to the database to "create" a share link, so
// there's no share-link record to expire, clean up, or go stale relative to the lead. The token
// itself carries the leadId + revision number in plain view (neither is a secret on its own —
// see app/api/leads/route.js's id generator) plus an HMAC-SHA256 signature over both, so a
// customer can't be handed a link to someone ELSE's quotation just by guessing/incrementing an
// id in the URL — the signature has to match, and forging one without the server's secret is
// infeasible. Follows the exact same HMAC-signed-token shape lib/auth.js already uses for
// session cookies (same secret() env-var precedence), just for a different purpose.
import crypto from 'crypto';

const secret = () =>
  process.env.AUTH_SECRET ||
  process.env.DATABASE_URL ||
  (process.env.NODE_ENV === 'production' ? null : 'heseos-dev-quotation-share-secret');

function signPayload(payload) {
  const s = secret();
  if (!s) throw new Error('AUTH_SECRET is required to create quotation share links');
  return crypto.createHmac('sha256', s).update(payload).digest('base64url');
}

// Builds the token for one lead's one revision, e.g. "L2972813555.2.kQ9f...". Safe to drop
// straight into a URL path segment — base64url has nothing that needs escaping there.
export function buildQuotationShareToken(leadId, revisionNumber) {
  const payload = `${leadId}.${revisionNumber}`;
  return `${payload}.${signPayload(payload)}`;
}

// Recovers { leadId, revision } from a token, or null if it's malformed, tampered with, or was
// never actually signed by this server — never throws, so callers can treat null as a plain
// "not found" rather than a crash.
export function verifyQuotationShareToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [leadId, revisionStr, sig] = parts;
  if (!leadId || !revisionStr || !sig) return null;
  let expected;
  try {
    expected = signPayload(`${leadId}.${revisionStr}`);
  } catch {
    return null;
  }
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const revision = Number(revisionStr);
  if (!Number.isFinite(revision)) return null;
  return { leadId, revision };
}

// The full https:// link a customer can open with no login — null (never a broken partial
// URL) if PUBLIC_BASE_URL isn't set in this environment yet, so callers can fall back to "just
// send the PDF" instead of texting someone a dead link.
export function buildQuotationShareLink(leadId, revisionNumber) {
  const base = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
  if (!base) return null;
  return `${base}/quotation/${buildQuotationShareToken(leadId, revisionNumber)}`;
}
