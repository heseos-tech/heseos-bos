import { NextResponse } from 'next/server';
import { dbList } from '@/lib/db';
import { verifyPassword, encodeEmployeeSession, EMPLOYEE_COOKIE } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST(request) {
  const { email, password } = await request.json();
  if (!email || !password) return NextResponse.json({ error: 'Email and password required' }, { status: 400 });

  const employees = await dbList('employees');
  const acct = employees.find((e) => String(e.email || '').toLowerCase() === String(email).toLowerCase());
  if (!acct || acct.active === false) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

  const ok = await verifyPassword(password, acct.password);
  if (!ok) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

  const res = NextResponse.json({ success: true, employee: { id: acct.id, name: acct.name, role: acct.role, email: acct.email } });
  res.cookies.set(EMPLOYEE_COOKIE, encodeEmployeeSession(acct.id), {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 14,
  });
  return res;
}

export async function DELETE() {
  (await cookies()).delete(EMPLOYEE_COOKIE);
  return NextResponse.json({ success: true });
}
