import { NextResponse } from 'next/server';
import { dbList } from '@/lib/db';
import { verifyPassword, encodeBotSession, BOT_COOKIE } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST(request) {
  const { loginId, password } = await request.json().catch(() => ({}));
  if (!loginId || !password) return NextResponse.json({ error: 'Login ID and password required' }, { status: 400 });

  const tenants = await dbList('bot_tenants');
  const acct = tenants.find((t) => String(t.loginId || '').toLowerCase() === String(loginId).trim().toLowerCase());
  if (!acct || acct.active === false) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

  const ok = await verifyPassword(password, acct.password);
  if (!ok) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

  let token;
  try {
    token = encodeBotSession(acct.id);
  } catch (e) {
    console.error('[auth/bot] session signing failed:', e.message);
    return NextResponse.json(
      { error: 'Server is not configured for sessions yet — set AUTH_SECRET (or DATABASE_URL) in your deployment environment variables.' },
      { status: 500 }
    );
  }

  const res = NextResponse.json({ success: true, tenant: { id: acct.id, businessName: acct.businessName, botName: acct.botName, loginId: acct.loginId } });
  res.cookies.set(BOT_COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

export async function DELETE() {
  (await cookies()).delete(BOT_COOKIE);
  return NextResponse.json({ success: true });
}
