// Scheduled safety-net sync — pulls every enabled form's full lead history from Meta on a
// timer, so leads still get captured even during a webhook gap. Vercel's Hobby plan only
// allows once-daily cron (see docs), so this route is meant to be triggered by an external
// scheduler (e.g. cron-job.org, free tier) hitting it every N minutes — not by vercel.json's
// own `crons` field. If this project later moves to Vercel Pro, a real vercel.json cron entry
// can call this same URL; Vercel's own cron requests already send an
// `Authorization: Bearer <CRON_SECRET>` header, which this route also accepts.
//
// Setup:
//   1. Set CRON_SYNC_SECRET in your Vercel project's environment variables (any long random
//      string — do not reuse a real password) and redeploy.
//   2. Point an external scheduler at:
//        https://bos.heseos.com/api/cron/sync-meta-leads?secret=<CRON_SYNC_SECRET>
//      on whatever interval you want (every 10 minutes, etc).
import { syncAllLeads } from '@/lib/metaAds';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const secret = process.env.CRON_SYNC_SECRET;
  if (!secret) return Response.json({ error: 'CRON_SYNC_SECRET is not set on the server.' }, { status: 500 });

  const { searchParams } = new URL(request.url);
  const authHeader = request.headers.get('authorization') || '';
  const provided = searchParams.get('secret') || authHeader.replace(/^Bearer\s+/i, '');
  if (provided !== secret) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const result = await syncAllLeads();
  if (result.error) return Response.json({ error: result.error }, { status: 400 });
  return Response.json({ ok: true, ...result });
}
