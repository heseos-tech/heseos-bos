// Serves a file stored in the Bot Inbox (see lib/botMedia.js) — only to the logged-in tenant that
// owns it. Images and PDFs open inline; anything else a customer might have sent is forced to
// download (and never sniffed), so a stray HTML/SVG file can't run in the console's origin.

import { dbGetById } from '@/lib/db';
import { getBotTenant } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const INLINE_IMAGE = /^image\/(jpeg|png|gif|webp)$/i;

export async function GET(request, { params }) {
  const tenant = await getBotTenant();
  if (!tenant) return new Response('Unauthorized', { status: 401 });
  const { id } = await params;
  const row = await dbGetById('bot_media', decodeURIComponent(id)).catch(() => null);
  if (!row || row.tenantId !== tenant.id || !row.base64) return new Response('Not found', { status: 404 });

  const mime = String(row.mime || '').toLowerCase().split(';')[0];
  const inlineOk = INLINE_IMAGE.test(mime) || mime === 'application/pdf';
  const wantDownload = new URL(request.url).searchParams.get('download') === '1';
  const name = String(row.filename || 'file').replace(/[^\w.\- ]+/g, '_');
  const bytes = Buffer.from(row.base64, 'base64');
  return new Response(bytes, {
    headers: {
      'Content-Type': inlineOk ? mime : 'application/octet-stream',
      'Content-Length': String(bytes.length),
      'Content-Disposition': `${inlineOk && !wantDownload ? 'inline' : 'attachment'}; filename="${name}"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
