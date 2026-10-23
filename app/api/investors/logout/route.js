import { NextResponse } from 'next/server';
import { INVESTOR_COOKIE } from '@/lib/investorAccess';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(INVESTOR_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
