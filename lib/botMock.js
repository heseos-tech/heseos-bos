// Heseos Bot platform — seed data generator. Every new tenant gets a believable, populated
// Inbox the moment they finish the signup wizard ("make bot live on the go") instead of
// staring at an empty console — same idea as a SaaS demo workspace. Content is templated off
// the tenant's own business name / bot name / industry so it actually reads like their bot,
// not a generic placeholder. This is mock data only (see the sandbox's own constraints — no
// live WhatsApp webhook here); wa_chats/wa_messages historically did this for real for
// Heseos's own single-number Team Inbox, since retired in favour of this multi-tenant,
// self-service system.
//
// direction follows the same convention as wa_messages: 'in' = the customer wrote it (inbound
// to the business), 'out' = the business/bot wrote it (outbound to the customer).

import { industryByKey } from './botPresets';

const NAMES = [
  ['Priya Sharma', 'F'], ['Rohit Verma', 'M'], ['Ayesha Khan', 'F'], ['Karan Mehta', 'M'],
  ['Sneha Patil', 'F'], ['Arjun Nair', 'M'], ['Fatima Sheikh', 'F'], ['Vivaan Gupta', 'M'],
  ['Ananya Iyer', 'F'], ['Yusuf Ali', 'M'],
];
const CITIES = ['Pune', 'Mumbai', 'Bengaluru', 'Delhi', 'Hyderabad', 'Ahmedabad', 'Chennai', 'Jaipur', 'Nagpur', 'Surat'];

function phoneFor(seed) {
  const n = 7000000000 + (seed * 9973) % 999999999;
  return `91${String(n).slice(0, 10)}`;
}

function minutesAgo(n) {
  return new Date(Date.now() - n * 60 * 1000).toISOString();
}

// Each turn is [direction, text, minutesAgo, senderOverride?]. direction 'out' with no
// senderOverride is an automated bot message; pass an agent's name as senderOverride for an
// 'out' turn a human typed themselves (matches how Bot Configuration's "Bot on/off" toggle and
// the chat's "Assigned to" work — once a human takes over, replies carry their name).
function buildScenarios(tenant, preset) {
  const botName = tenant.botName || 'Mitra';
  const business = tenant.businessName || 'us';
  const menu = (tenant.menuOptions && tenant.menuOptions.length ? tenant.menuOptions : preset.menuOptions).map((m) => m.label);
  const [m1, m2, m3, m4] = [menu[0] || 'Our Services', menu[1] || 'Get a Quote', menu[2] || 'Book a Call', menu[3] || 'Talk to Support'];
  const intro = `Namaste 🙏 I'm *${botName}* — your companion on your ${preset.journeyPhrase}.\n\nFrom understanding what you need to getting you sorted, I'm here to guide you every step of the way.\n\nSo tell me… 👇`;

  return [
    {
      status: 'open', unread: 0, assignedTo: null, botOn: true, lead: null,
      msgs: [
        ['out', 'Please choose your language 👇\n*अपनी भाषा चुनें*', 640],
        ['in', 'English', 636],
        ['out', intro, 635],
        ['out', 'How can I help you today? 👇', 2],
      ],
    },
    {
      status: 'open', unread: 2, assignedTo: null, botOn: false, lead: { status: 'qualified' },
      msgs: [
        ['out', `Great! Here's what I can help with:\n1️⃣ ${m1}\n2️⃣ ${m2}\n3️⃣ ${m3}\n4️⃣ ${m4}`, 210],
        ['in', m2, 205],
        ['out', `Sure — could you share a few details so I can get you an accurate ${m2.toLowerCase()}?`, 204],
        ['in', 'Yes go ahead', 198],
        ['out', 'Got it, noted — handing you over to our team for the exact numbers.', 197],
        ['in', 'Can someone call me today? It’s a bit urgent', 40],
        ['in', 'Anyone there?', 12],
      ],
    },
    {
      status: 'resolved', unread: 0, assignedTo: 'Kavya Rao', botOn: false, lead: { status: 'converted' },
      msgs: [
        ['out', `Namaste 🙏 I'm *${botName}* from ${business}. How can I help you today? 👇`, 1500],
        ['in', m1, 1495],
        ['out', 'Here you go — sharing our latest catalogue and pricing right away 📄', 1490],
        ['in', 'This looks good, I’ll go ahead with this', 1400],
        ['out', 'Wonderful! Our team has confirmed it on their end — you’re all set ✅', 1395, 'Kavya Rao'],
        ['in', 'Thank you! That’s exactly what I needed 🙏', 1390],
      ],
    },
    {
      status: 'open', unread: 1, assignedTo: null, botOn: true, lead: { status: 'new' },
      msgs: [
        ['out', `🙏 Welcome — a friend shared your number with ${business}!`, 95],
        ['out', intro, 94],
        ['in', 'Hi, my friend said you guys are good, tell me more', 5],
      ],
    },
    {
      status: 'open', unread: 0, assignedTo: 'Kavya Rao', botOn: false, lead: { status: 'qualified' },
      msgs: [
        ['out', `Good news 🎉 based on what you shared, you're a great fit for ${business}!`, 800],
        ['out', 'Would you like our team to reach out with the next steps?', 799],
        ['in', 'Yes please', 780],
        ['out', 'Perfect, someone will call you within the hour.', 779, 'Kavya Rao'],
      ],
    },
    {
      status: 'open', unread: 0, assignedTo: null, botOn: true, lead: null,
      msgs: [
        ['out', 'Was this helpful? Let me know if you need anything else 🙏', 60],
        ['in', 'ok', 58],
      ],
    },
    {
      status: 'open', unread: 1, assignedTo: null, botOn: true, lead: { status: 'new' },
      msgs: [
        ['out', 'And who is this enquiry for? 👇', 25],
        ['in', '(Family, Friend, Colleague — or just type your own answer)', 24],
      ],
    },
    {
      status: 'open', unread: 1, assignedTo: null, botOn: true, lead: null,
      msgs: [
        ['in', '[unsupported]', 15],
        ['out', 'Sorry, I can only read text messages right now — could you type that out for me? 🙏', 14],
      ],
    },
    {
      status: 'resolved', unread: 0, assignedTo: 'Rahul Deshpande', botOn: true, lead: { status: 'contacted' },
      msgs: [
        ['out', 'आज आप क्या करना चाहेंगे? 🙏', 3200],
        ['in', 'जानकारी चाहिए', 3195],
        ['out', 'जरूर बताएं, हमारी टीम आपसे जल्द संपर्क करेगी।', 3190, 'Rahul Deshpande'],
      ],
    },
  ];
}

export function seedTenantData(tenant) {
  const preset = industryByKey(tenant.industry);
  const scenarios = buildScenarios(tenant, preset);
  const chats = [];
  const messages = [];

  scenarios.forEach((s, i) => {
    const [name] = NAMES[i % NAMES.length];
    const chatId = `${tenant.id}_C${i + 1}`;
    const phone = phoneFor(i + 1);
    const city = CITIES[i % CITIES.length];
    const firstTurn = s.msgs[0];
    const lastTurn = s.msgs[s.msgs.length - 1];

    chats.push({
      id: chatId,
      tenantId: tenant.id,
      name,
      phone,
      city,
      status: s.status,
      unread: s.unread,
      assignedTo: s.assignedTo,
      botOn: s.botOn,
      lead: s.lead,
      lastText: lastTurn[1].split('\n')[0].slice(0, 120),
      lastAt: minutesAgo(lastTurn[2]),
      firstMessageAt: minutesAgo(firstTurn[2]),
      createdAt: minutesAgo(firstTurn[2]),
    });

    s.msgs.forEach((m, j) => {
      const [direction, body, minsAgo, senderOverride] = m;
      messages.push({
        id: `${chatId}_M${j + 1}`,
        tenantId: tenant.id,
        chatId,
        direction,
        body,
        ts: minutesAgo(minsAgo),
        sender: direction === 'in' ? 'customer' : (senderOverride || 'bot'),
      });
    });
  });

  return { chats, messages };
}
