// app/api/auth/bot/register/route.js
// Self-serve tenant SIGN-UP REQUEST for the Heseos Bot platform ("self-service bot
// configuration so we can make bot live on the go for anyone who wants our bot") — with an
// approval gate: this form is open to anyone (no login required to submit it), so every new
// tenant lands as approvalStatus 'pending' and does NOT get a session cookie or a seeded demo
// console yet. That's deliberate — an unapproved signup should cost nothing beyond one small
// database row until a Heseos admin approves it (Admin -> Settings -> Bot Signups, see
// app/api/admin/bot-tenants/[id]/route.js), which is also when the demo Inbox gets seeded
// (lib/botMock.js) and the account can actually log in. Mirrors
// app/api/auth/partner/register/route.js's shape otherwise (hashed password, uniqueness check).
//
// Two more layers here specifically because this route needs no login to hit: a per-IP rate
// limit (lib/rateLimit.js — no external service, no API keys) checked FIRST so a blocked
// request costs almost nothing, and a honeypot field (`hp_note` — see
// components/bot/SignupWizard.jsx's hidden input) that real users never fill in but naive bots
// often do; a filled honeypot gets a fake success response with no database write at all, so
// the bot never learns it was caught.

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { dbList, dbInsert } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { industryByKey } from '@/lib/botPresets';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

const REFERRAL_SOURCES = ['Website Widget', 'Instagram Bio Link', 'Google Business Profile', 'WhatsApp QR (in-store)'];
const SIGNUP_RATE_LIMIT = { max: 5, windowMs: 60 * 60 * 1000 }; // 5 attempts / IP / hour

export async function POST(request) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(`bot_signup:${ip}`, SIGNUP_RATE_LIMIT);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many signup attempts from your network — please try again in a while.' }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));

  // Honeypot: a hidden field real users never see or fill. A bot that auto-fills every input on
  // the page trips it — reply as if it worked, but never touch the database.
  if (String(body.hp_note || '').trim()) {
    return NextResponse.json({ success: true, pending: true, businessName: '', botName: '', loginId: '' });
  }

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
    // against it). Every self-service signup starts White Label — a public signup form can
    // never make itself Heseos's own in-house bot; only a Heseos admin can promote an account
    // to botKind 'heseos' from Admin -> Settings -> Bot Signups (see
    // app/api/admin/bot-tenants/[id]'s set_bot_kind action). linkToHeseosLeads mirrors that
    // same decision for older code that still checks it directly.
    waPhoneNumberId: '',
    waAccessToken: '',
    waVerifyToken: crypto.randomBytes(16).toString('base64url'),
    botKind: 'white_label',
    linkToHeseosLeads: false,
    // Gate: no demo data, no working login, until a Heseos admin approves this request.
    approvalStatus: 'pending',
    seeded: false,
    active: true,
    createdAt: new Date().toISOString(),
  };
  await dbInsert('bot_tenants', id, tenant);

  // No session cookie, no seeded demo Inbox — both happen on approval (see
  // app/api/admin/bot-tenants/[id]/route.js) so a flood of unapproved signups never costs more
  // than one tiny row each.
  return NextResponse.json({ success: true, pending: true, businessName, botName, loginId });
}
