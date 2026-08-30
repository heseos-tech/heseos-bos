// app/api/auth/bot/register/route.js
// Self-serve tenant sign-up for the Heseos Bot platform ("self-service bot configuration so we
// can make bot live on the go for anyone who wants our bot"). Mirrors
// app/api/auth/partner/register/route.js's shape (hashed password, sign-straight-in), plus
// seeds a full demo Inbox (lib/botMock.js) so the tenant lands on a populated console instead
// of an empty one.

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { dbList, dbInsert } from '@/lib/db';
import { hashPassword, encodeBotSession, BOT_COOKIE } from '@/lib/auth';
import { industryByKey } from '@/lib/botPresets';
import { seedTenantData } from '@/lib/botMock';

const REFERRAL_SOURCES = ['Website Widget', 'Instagram Bio Link', 'Google Business Profile', 'WhatsApp QR (in-store)'];

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const businessName = String(body.businessName || '').trim();
  const contactName = String(body.contactName || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const loginId = String(body.loginId || '').trim().toLowerCase();
  const password = String(body.password || '');
  const industry = String(body.industry || 'other');
  const botName = String(body.botName || '').trim() || `${businessName.split(' ')[0] || 'Heseos'} Mitra`;
  const languages = Array.isArray(body.languages) && body.languages.length ? body.languages : ['en'];
  const welcomeMessage = String(body.welcomeMessage || '').trim();
  const menuOptions = Array.isArray(body.menuOptions) && body.menuOptions.length ? body.menuOptions : null;

  if (!businessName || !contactName) return NextResponse.json({ error: 'Business name and your name are required' }, { status: 400 });
  if (!loginId || loginId.length < 4) return NextResponse.json({ error: 'Login ID must be at least 4 characters' }, { status: 400 });
  if (!password || password.length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });

  const tenants = await dbList('bot_tenants');
  if (tenants.some((t) => String(t.loginId || '').toLowerCase() === loginId)) {
    return NextResponse.json({ error: 'That login ID is already taken — please choose another' }, { status: 409 });
  }

  const preset = industryByKey(industry);
  const id = `BOT${Date.now().toString().slice(-8)}`;
  const finalMenu = (menuOptions || preset.menuOptions).slice(0, 6).map((m, i) => ({
    id: `menu_${i + 1}`, label: m.label, icon: m.icon || '✨', enabled: true,
  }));
  const finalWelcome = {};
  for (const code of languages) finalWelcome[code] = welcomeMessage && code === languages[0] ? welcomeMessage : preset.sampleWelcome;

  const tenant = {
    id,
    businessName,
    contactName,
    email,
    phone: String(body.phone || '').replace(/\D/g, '').slice(-10),
    loginId,
    password: await hashPassword(password),
    industry,
    botName,
    brandColor: String(body.brandColor || '#D9481E'),
    whatsappNumber: `+91 ${70000 + (Date.now() % 9999)} ${10000 + Math.floor(Math.random() * 89999)}`,
    status: 'live',
    languages,
    welcomeMessage: finalWelcome,
    menuOptions: finalMenu,
    referrals: REFERRAL_SOURCES.map((source, i) => ({ source, leads: 14 - i * 3, conversions: 5 - i })),
    // Real WhatsApp connection (self-service — "Tenant pastes their own Meta credentials"):
    // waPhoneNumberId + waAccessToken start empty until the tenant fills them in on the Bot
    // Configuration screen; waVerifyToken is generated here so every tenant gets a unique
    // value to paste into their own Meta App's webhook config (app/api/bot/webhook validates
    // against it). linkToHeseosLeads is never tenant-editable — see app/api/bot/webhook's
    // bridgeToHeseosLeads() — it's set manually, only for Heseos's own account.
    waPhoneNumberId: '',
    waAccessToken: '',
    waVerifyToken: crypto.randomBytes(16).toString('base64url'),
    linkToHeseosLeads: false,
    active: true,
    createdAt: new Date().toISOString(),
  };
  await dbInsert('bot_tenants', id, tenant);

  const { chats, messages } = seedTenantData(tenant);
  await Promise.all([
    ...chats.map((c) => dbInsert('bot_chats', c.id, c)),
    ...messages.map((m) => dbInsert('bot_messages', m.id, m)),
  ]);

  let token;
  try {
    token = encodeBotSession(id);
  } catch (e) {
    console.error('[auth/bot/register] session signing failed:', e.message);
    return NextResponse.json({ success: true, id, note: 'Account created — please log in.' });
  }

  const res = NextResponse.json({ success: true, tenant: { id, businessName, botName, loginId } });
  res.cookies.set(BOT_COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
