// POST /api/investors/ping — the unlocked proposal viewer reports how long and how far someone read
// (and seconds per slide). Only for a signed-in investor. Always 204; tracking never gets in the way.
import { getInvestor } from '@/lib/investorAccess';
import { recordInvestorView } from '@/lib/landingActivity';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const raw = await request.text();
    if (raw.length <= 6000) {
      const investor = await getInvestor();
      if (investor) await recordInvestorView(investor, JSON.parse(raw));
    }
  } catch (err) {
    console.error('investor ping error:', err?.message || err);
  }
  return new Response(null, { status: 204 });
}
