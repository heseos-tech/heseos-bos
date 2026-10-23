// GET /api/investors/proposal — the investment proposal HTML, served only to someone who has
// accepted the NDA and verified their code (valid signed cookie). The file lives in /private,
// never in /public, so there is no direct URL to it.
import fs from 'fs/promises';
import path from 'path';
import { getInvestor } from '@/lib/investorAccess';

export const dynamic = 'force-dynamic';

export async function GET() {
  const investor = await getInvestor();
  if (!investor) return new Response('Access requires accepting the NDA.', { status: 401, headers: { 'Cache-Control': 'no-store' } });
  const html = await fs.readFile(path.join(process.cwd(), 'private', 'investor-proposal.html'), 'utf8');
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
      'X-Frame-Options': 'SAMEORIGIN',
    },
  });
}
