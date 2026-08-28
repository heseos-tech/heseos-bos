# Heseos BOS — Lead Capture & Fulfillment System

Built with **Next.js 15** + **React 19**, same stack, theme and component language as MARG
(`marg/`) — Plus Jakarta Sans, the exact same colour tokens, the same card/pill/button system —
adapted for Heseos's home-automation sales journey instead of MARG's home-loan journey.

## What this is

A single backend ("single source of truth") for every lead Heseos captures, across every
channel — website form, Meta Instant Forms, WhatsApp QR at shops, and partners adding leads
directly — plus four interfaces on top of it:

1. **Public site** — marketing page + a 6-step lead capture form matching the fields already
   used in Heseos's Meta Instant Forms (product interest, property type, conditional budget,
   timeline, persona, contact info).
2. **Employee interface** (`/employee`) — where the pre-sales/lead-nurturing team calls and
   qualifies leads, schedules demos (address + date + time), and where sales engineers mark
   the final outcome of a demo visit. Includes the **WhatsApp Team Inbox** (`/employee/inbox`).
   Installable as a PWA.
3. **Partner portal** (`/partner`) — where a distribution partner (shop, electrician, designer,
   builder) logs in and adds a lead directly, the same way MARG's Mitras add home-loan leads.
   Installable as a PWA.
4. **Admin panel** (`/admin`, admin role only) — create/deactivate employee and partner
   accounts.

Every lead is one row in the `leads` table (JSONB), and every stage change is appended to that
lead's `history` array with a timestamp and who did it — so the full lifecycle of a lead is
always reconstructable, end to end, no matter which channel it came in through.

## The lead journey (mirrors MARG's canonical-stage pattern)

```
New Lead → Demo Scheduled → Converted
                 ↓
             Rejected (terminal, from either stage)
```

- **New Lead** — just submitted, from any channel. The pre-sales team logs a contact outcome:
  Call Not Picked, Not Interested (dead), Follow-up Later, or — by scheduling a demo (address,
  date, time) — the lead moves to **Demo Scheduled**.
- **Demo Scheduled** — a sales engineer visits and marks the final outcome: Rejected Before
  Demo, Customer Out of Station, Future Demo Requested (the latter two ask for a new date/time
  and the lead stays in this stage), Not Interested After Demo, or **Converted**.
- All of this logic lives in one place: `lib/leadStage.js` — same idea as MARG's
  `lib/leadStage.js`, so the stage/colour/label story never drifts between screens.

## Lead intake channels

| Channel | How it works |
|---|---|
| Website form | `components/LeadForm.jsx` → `POST /api/leads`, `source: website` |
| Partner app | Partner logs in at `/partner`, adds a lead → `source: partner_app`, auto-attributed to their `partnerId` |
| WhatsApp QR (shop) | Shop's printed QR points at `/wa/<partnerId>` → redirects to `wa.me` with a pre-filled, ref-tagged message → inbound webhook creates the lead, `source: whatsapp_qr` |
| Meta Instant Form | Meta's `leadgen` webhook → `/api/leads/meta-webhook` fetches the full answers via Graph API → `source: meta_lead_form` |

## WhatsApp inbox + QR entry point

- `lib/whatsapp.js` — thin wrapper around the Meta Cloud API (`sendText`, `sendTemplate`,
  `sendInteractiveButtons`, `parseWebhook`), ported from MARG's version, trimmed to what a
  single-number Team Inbox needs (no multi-brand routing).
- `lib/waInbound.js` — the inbound handler: de-dupes Meta's retries, upserts a `wa_chats` row
  per phone number, stores every message in `wa_messages`, auto-creates a lead the first time a
  number is seen (tagged with whichever partner's QR ref was in the pre-filled text, if any),
  and sends a one-time auto-acknowledgement.
- `app/api/whatsapp/webhook` — the Meta webhook (GET verification handshake, POST receiver).
- `app/wa/[ref]` — the QR redirect. Print a QR code (any free QR generator) pointing at
  `https://<yourdomain>/wa/<partnerId-or-shop-label>` and stick it at the shop counter; scanning
  it opens WhatsApp with Heseos's number and a pre-filled, ref-tagged message.
- `/employee/inbox` — the Team Inbox UI: conversation list, thread view, reply box. Claim a chat
  to assign it to yourself.
- **Not built**: an automated conversational bot (MARG's `lib/waBot.js`, 1000+ lines, is the
  reference if you want one later) — for now every inbound message is answered by a human in the
  Team Inbox, which matches what you described (pre-sales does the qualifying calls).

## Meta Lead Ads webhook

- `app/api/leads/meta-webhook` — GET verification handshake (`META_LEAD_VERIFY_TOKEN`), POST
  receives Meta's `leadgen` change notification (just a `leadgen_id`), then calls the Graph API
  with `META_LEAD_ACCESS_TOKEN` (needs the `leads_retrieval` permission on your Page) to fetch
  the actual answers.
- `lib/metaLeadMap.js` — maps Meta's `field_data` into Heseos's schema. The built-in Contact
  Information fields (`full_name`, `phone_number`, `email`, `city`, `post_code`) have fixed keys
  and map directly; custom questions are matched by keyword + answer-label matching since their
  exact field keys depend on how the form was built in Meta's UI. **Every answer is also kept
  verbatim in `rawMetaFields` on the lead**, so nothing is silently lost even if a mapping
  guess is off — check a few real submissions after connecting the webhook and tighten the
  keyword rules in `metaLeadMap.js` if needed.
- Setup: Meta App dashboard → Webhooks → subscribe your Page to the `leadgen` field, callback
  URL = this route, verify token = `META_LEAD_VERIFY_TOKEN`. Generate a Page access token with
  `leads_retrieval` + `pages_manage_ads` for `META_LEAD_ACCESS_TOKEN`.

## Admin panel

`/admin` (employees with `role: admin` only) — create employees (pre-sales / sales engineer /
admin) and partners, deactivate either without deleting their history. Passwords are hashed with
`pbkdf2` via `lib/auth.js`'s `hashPassword()` — accounts created through `/admin` are secure by
default, unlike the plaintext demo seed data in `/data`.

## PWA — installable now, native later

Per your call: `/employee` and `/partner` are installable Progressive Web Apps for now (same
approach MARG itself uses for its Mitra app — one codebase, add-to-home-screen, works offline
for the app shell). `public/sw.js` only takes over those two scopes — the marketing site and
`/admin` always hit the network fresh. `public/employee.webmanifest` and `partner.webmanifest`
carry the icons/theme/name. When you're ready for native, that's a separate React Native (or
Expo) build consuming the same `/api` routes — nothing here needs to change for that.

## Local Development

```bash
npm install
npm run dev
# Open http://localhost:3000
```

No `DATABASE_URL` needed to try it locally — `lib/db.js` falls back to the JSON files under
`/data`, which already have three demo employee logins and one demo partner login seeded:

| Interface | Login | Password |
|---|---|---|
| `/employee/login` | `admin@heseos.com` (admin — sees everything + `/admin`) | `admin123` |
| `/employee/login` | `presales@heseos.com` (pre-sales) | `presales123` |
| `/employee/login` | `engineer@heseos.com` (sales engineer) | `engineer123` |
| `/partner/login` | phone `9876543210` (Heseos Demo Electronics) | `partner123` |

Try it end to end: submit the form on the homepage (or add a lead from `/partner`), then log in
as `presales@heseos.com` to work the "New Leads" queue and schedule a demo, then log in as
`engineer@heseos.com` to mark the demo outcome. WhatsApp and the Meta webhook need real Meta
credentials (see the tables above) to test against actual traffic — without them, `waConfigured()`
just skips sending and the routes no-op safely.

## Production Setup (Neon Postgres + Vercel)

1. Create a Neon project → copy the pooled connection string.
2. `vercel env add DATABASE_URL` (or add it in Project Settings → Environment Variables).
3. Optionally run `db/schema.sql` in the Neon SQL editor up front (the app also creates tables
   automatically on first request).
4. Set the WhatsApp + Meta Lead Ads env vars from `.env.example` once you have those
   credentials.
5. Log in as the seeded admin, immediately create real employee/partner accounts via `/admin`,
   then deactivate or stop using the plaintext demo accounts in `/data` (those only exist for
   local file-fallback dev — once `DATABASE_URL` is set, production reads/writes Neon, not
   `/data`, so the demo seed never even reaches production unless you insert it yourself).
6. `vercel` to deploy.

## Design System

Same component language, layout, spacing and font as MARG (`marg/app/globals.css`) — cards,
pills, buttons, dashboard shell, all identical — but re-themed to Heseos's own brand (logo +
colours), not MARG's blue/teal:

| Token | Value |
|---|---|
| Primary (orange) | `#D9481E` |
| Secondary | `#E8611F` |
| Primary — dark/hover | `#B23815` |
| Accent (gold) | `#FDB44B` |
| Ink (navy text, matches wordmark) | `#0A1628` |
| Background | `#F8FAFB` |
| Font | Plus Jakarta Sans |
| Max width | 1260px |

Brand assets live in `public/brand/` (`icon.png` — the mark alone; `lockup-navy.png` /
`lockup-white.png` — icon + "HESEOS" wordmark, for light vs. dark surfaces), sourced directly
from the logo file you provided. `public/icon-*.png`, `icon-maskable-*.png`,
`apple-touch-icon.png` and `app/favicon.ico` are all cropped from the same mark — no more
placeholder monograms.

## Project Structure

```
heseos-bos/
├── app/
│   ├── page.jsx                 # Marketing home page
│   ├── become-a-partner/        # Partner recruitment landing page
│   ├── employee/                # Pre-sales + sales engineer dashboard, WhatsApp inbox, PWA layout
│   ├── partner/                 # Partner portal (add + track leads), PWA layout
│   ├── admin/                   # Employee/partner account management (admin role only)
│   ├── wa/[ref]/                # QR → wa.me redirect, ref-tagged
│   └── api/
│       ├── leads/                # POST (intake), GET (scoped list)
│       ├── leads/[id]/           # PATCH (contact / scheduleDemo / demoOutcome / assign)
│       ├── leads/meta-webhook/   # Meta Lead Ads webhook
│       ├── whatsapp/             # webhook, send, chats (Team Inbox)
│       ├── admin/                # employees, partners CRUD (admin only)
│       └── auth/                 # employee + partner login/logout
├── components/                  # Navbar, Hero, LeadForm, EmployeeDashboard, InboxView, AdminPanel…
├── lib/
│   ├── db.js                    # Neon + JSON-fallback storage (ported from MARG)
│   ├── leadStage.js              # Canonical lead lifecycle — stages, colours, timestamps
│   ├── formOptions.js            # Field options, straight from the Meta Instant Form
│   ├── auth.js                   # Employee + partner cookie sessions
│   ├── whatsapp.js               # Meta Cloud API wrapper
│   ├── waInbound.js              # WhatsApp inbound → chat + lead
│   └── metaLeadMap.js            # Meta Instant Form field_data → lead schema
├── public/
│   ├── employee.webmanifest / partner.webmanifest / sw.js   # PWA
│   ├── brand/                                                # Logo assets (icon, navy/white lockups)
│   └── icon-*.png                                            # Real Heseos brand icons
└── db/schema.sql
```

## What's next (flagged, not yet built)

1. **Automated WhatsApp bot** — right now every inbound WhatsApp message goes to a human in the
   Team Inbox. If you want it to auto-qualify before a human steps in, MARG's `lib/waBot.js` is
   the reference implementation for a scripted conversation flow.
2. **Native apps** — when you're ready, both `/employee` and `/partner` already have a stable
   `/api` surface (cookie-session auth) a React Native/Expo app can call directly; no backend
   changes needed to add native alongside the PWA.
3. **QR image generation** — `/wa/[ref]` gives you the target URL; turning that into a printable
   QR code currently needs any free QR generator (e.g. paste the URL into one). Worth adding the
   `qrcode` package (already a MARG dependency) to generate them in-app from `/admin` later.
