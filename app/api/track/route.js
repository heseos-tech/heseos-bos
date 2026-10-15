// Public beacon endpoint for the landing pages' analytics (public/hs-track.js). Accepts a
// cumulative visit snapshot and merges it into one row — see lib/landingActivity.js. Always answers
// 204 quickly, whatever happens: tracking must never slow down or break a landing page.
import { recordLandingSnapshot } from '@/lib/landingActivity';
import { getClientIp } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const raw = await request.text();
    if (raw.length > 8000) return new Response(null, { status: 204 });
    const body = JSON.parse(raw);
    await recordLandingSnapshot(body, getClientIp(request));
  } catch (err) {
    console.error('track error:', err?.message || err);
  }
  return new Response(null, { status: 204 });
}
