// Lightweight, storage-backed rate limiter — no external service, no API keys, works the same
// on Neon or the local JSON-file fallback (see lib/db.js's `rate_limits` table). Built for
// app/api/auth/bot/register's per-IP signup throttle, but keyed generically so any other route
// can use it later (e.g. `checkRateLimit(`login:${ip}`, ...)`) without colliding with this one.

import { dbGetById, dbInsert } from '@/lib/db';

// Never remember a hit older than this, regardless of the window being checked — keeps each
// row small even for a long-running low-and-slow abuser.
const PRUNE_MS = 24 * 60 * 60 * 1000;

// Vercel (and most proxies) set x-forwarded-for to "client, proxy1, proxy2…" — the first entry
// is the original caller. Falls back to x-real-ip, then 'unknown' for local dev without either.
export function getClientIp(request) {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) {
    const first = fwd.split(',')[0].trim();
    if (first) return first;
  }
  return request.headers.get('x-real-ip') || 'unknown';
}

// Records one "hit" for `key` and reports whether it's within `max` hits per `windowMs`.
// Call this FIRST, before any real work, so a blocked request costs almost nothing — it's one
// small read + (on success) one small write, not a full signup attempt.
export async function checkRateLimit(key, { max, windowMs }) {
  const now = Date.now();
  const id = `rl_${key}`;
  const existing = await dbGetById('rate_limits', id);
  const hits = ((existing && existing.hits) || []).filter((ts) => now - ts < PRUNE_MS);

  const recentCount = hits.filter((ts) => now - ts < windowMs).length;
  const allowed = recentCount < max;

  if (allowed) {
    hits.push(now);
    await dbInsert('rate_limits', id, { id, hits });
  }

  return { allowed, remaining: Math.max(0, max - recentCount - (allowed ? 1 : 0)) };
}
