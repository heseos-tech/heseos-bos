// Heseos Bot platform — the rule-based conversation engine. This is what "just enter bot
// configuration and their bot is ready" actually means at runtime: every reply below is built
// purely from the signed-in tenant's own Bot Configuration fields (tenant.languages,
// tenant.welcomeMessage, tenant.menuOptions) — there is no per-tenant code, no special-casing
// for Heseos's own bot vs. any third party's. A brand-new tenant becomes a working bot the
// moment they finish signup + connect a WhatsApp number, with zero code changes.
//
// Flow per chat: (languages.length > 1) pick-a-language -> welcome message -> quick menu ->
// once the customer's choice is understood, the bot goes quiet (botOn: false) and hands the
// conversation to the tenant's own team in the Inbox — mirrors components/bot/InboxScreen.jsx's
// existing "Bot on/off" pill and "Needs Agent" tab, which already read chat.botOn.

import { dbPatch } from '@/lib/db';
import { botReply } from '@/lib/botReply';
import { LANGUAGES, industryByKey, fillTemplate } from '@/lib/botPresets';

function activeMenu(tenant) {
  const preset = industryByKey(tenant.industry);
  const configured = (tenant.menuOptions || []).filter((m) => m.enabled !== false);
  return configured.length ? configured : preset.menuOptions;
}

function menuText(tenant) {
  const menu = activeMenu(tenant);
  const lines = menu.map((m, i) => `${i + 1}\uFE0F\u20E3 ${m.icon || ''} ${m.label}`.trim());
  return { menu, text: `Here's what I can help with:\n${lines.join('\n')}` };
}

function matchMenuOption(menu, raw) {
  const text = String(raw || '').trim().toLowerCase();
  if (!text) return null;
  const num = parseInt(text, 10);
  if (num && menu[num - 1]) return menu[num - 1];
  return menu.find((m) => {
    const label = String(m.label || '').toLowerCase();
    return label === text || text.includes(label) || label.includes(text);
  }) || null;
}

function languageChoices(tenant) {
  const codes = tenant.languages && tenant.languages.length ? tenant.languages : ['en'];
  return codes.map((code) => ({ code, label: (LANGUAGES.find((l) => l.code === code) || {}).label || code }));
}

function langPromptText(tenant) {
  const choices = languageChoices(tenant);
  const lines = choices.map((c, i) => `${i + 1}\uFE0F\u20E3 ${c.label}`);
  return `Please choose your language 👇\n*अपनी भाषा चुनें*\n${lines.join('\n')}`;
}

function matchLanguage(tenant, raw) {
  const choices = languageChoices(tenant);
  const text = String(raw || '').trim().toLowerCase();
  if (!text) return null;
  const num = parseInt(text, 10);
  if (num && choices[num - 1]) return choices[num - 1].code;
  const found = choices.find((c) => c.label.toLowerCase().includes(text) || text.includes(c.code));
  return found ? found.code : null;
}

// A chat that started from a QR-code scan or a partner/referral link (chat.attributionKind is
// set by app/api/bot/webhook when the customer's first message carried a resolvable `(ref:...)`
// tag — see lib/attribution.js) gets tenant.qrWelcomeMessage instead of the regular
// tenant.welcomeMessage, when the tenant has actually written one for that language. Referral
// links (not a QR scan) fall back to the regular welcome, same as a plain, untracked message —
// only kinds prefixed 'qr_' count as "scanned a QR code" for this purpose.
function welcomeText(tenant, lang, chat) {
  const viaQrScan = String(chat?.attributionKind || '').startsWith('qr_');
  const qrStored = tenant.qrWelcomeMessage || {};
  if (viaQrScan && qrStored[lang]) return fillTemplate(qrStored[lang], tenant);
  const stored = tenant.welcomeMessage || {};
  const raw = stored[lang] || stored[(tenant.languages || ['en'])[0]] || industryByKey(tenant.industry).sampleWelcome;
  return fillTemplate(raw, tenant);
}

// Advances one chat's conversation state by exactly one customer message. Called from the
// webhook (app/api/bot/webhook) right after the inbound message is persisted, and only while
// chat.botOn !== false — once a human has taken over (or the engine hands off), it stays quiet.
export async function runBotTurn(tenant, chat, inboundText) {
  const multiLang = (tenant.languages || ['en']).length > 1;
  let stage = chat.stage || (multiLang ? 'lang' : 'welcome');

  if (stage === 'lang') {
    const picked = matchLanguage(tenant, inboundText);
    if (!picked) {
      await botReply(tenant, chat, langPromptText(tenant));
      return;
    }
    await dbPatch('bot_chats', chat.id, { lang: picked, stage: 'welcome' });
    stage = 'welcome';
  }

  if (stage === 'welcome') {
    const lang = chat.lang || (tenant.languages || ['en'])[0];
    await botReply(tenant, chat, welcomeText(tenant, lang, chat));
    const { text } = menuText(tenant);
    await botReply(tenant, chat, text);
    await dbPatch('bot_chats', chat.id, { stage: 'menu' });
    return;
  }

  if (stage === 'menu') {
    const { menu } = menuText(tenant);
    const picked = matchMenuOption(menu, inboundText);
    if (picked) {
      await botReply(tenant, chat, `Got it — *${picked.label}*. Noted 👍 Our team will follow up with you shortly.`);
      // Surfaces in the tenant's own Leads tab (app/api/bot/leads — filters chats with a `lead`
      // object, same shape lib/botMock.js's seed data uses) the moment a customer's interest is
      // captured, whether or not this tenant is also bridged into Heseos's shared leads table.
      await dbPatch('bot_chats', chat.id, { stage: 'handled', botOn: false, selectedOption: picked.label, lead: { status: 'qualified' } });
      return;
    }
    const retries = (chat.menuRetries || 0) + 1;
    if (retries >= 2) {
      await botReply(tenant, chat, "Let me connect you with our team for this — they'll be with you shortly.");
      await dbPatch('bot_chats', chat.id, { stage: 'handled', botOn: false, menuRetries: retries, lead: chat.lead || { status: 'new' } });
      return;
    }
    const { text } = menuText(tenant);
    await botReply(tenant, chat, `Sorry, I didn't quite get that. ${text}`);
    await dbPatch('bot_chats', chat.id, { menuRetries: retries });
    return;
  }

  // stage 'handled' (or anything else): the engine has already handed off — say nothing.
}
