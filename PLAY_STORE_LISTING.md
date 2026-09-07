# Heseos Partner — Google Play submission checklist

Everything needed for the first-ever Play Store listing of the Partner app
(`com.heseos.partner`). You already have a Play Console developer account, so this
covers the app-listing side only. Copy/paste the text sections directly into the
matching Play Console screens.

Remember: this app is a thin Capacitor shell around the live site
(`heseos-bos-psi.vercel.app/partner`) — see the README's "Mobile App" section. Once
it's live, ordinary feature/content updates ship instantly with no new Play Store
release; you only need a new build + re-upload for native-level changes (icon, app
name, permissions, native plugins).

## 1. Store listing (Main store listing page)

**App name** (max 30 chars): `Heseos Partner`

**Short description** (max 80 chars):
> Refer customers, track leads & demos, and earn payouts on the go.

**Full description** (max 4000 chars):
> The Heseos Partner app is how Heseos Technologies' referral partners — shops, electricians, designers, builders — manage their part of the Heseos Partner Program from a phone.
>
> With the app you can:
> • Add a referral in seconds using your own QR code or referral link
> • Track every lead's status — from New Lead through Demo Scheduled to Converted
> • Browse the smart-home product catalogue and put together a quotation for a customer
> • See your tiered payout rate and running earnings in Rewards & Earnings
> • Manage your profile, business details and the bank details used to settle payouts
>
> Payouts are settled by Heseos outside the app (bank transfer/UPI) once a referral converts — the app is for tracking and management, not for moving money.
>
> This app requires a Heseos Partner account. If you're not yet a partner, visit heseos.com to learn about the Partner Program.

**App icon**: `assets/icon.png` (512×512, already correct size/format).

**Feature graphic** (1024×500, required): generated at `store-assets/feature-graphic.png` — brand navy background, Heseos lockup, on-brand tagline. Swap it for something else if you'd rather, but it's ready to upload as-is.

**Phone screenshots** (2–8 required, PNG/JPEG, 16:9–9:16, 320–3840px per side):
Not yet produced — the images in `public/` (`Home-Screen.webp` etc.) are marketing
photos of houses, not app screenshots, so they can't be reused here. Easiest path:
open the Partner app on your phone and screenshot 3–4 of: the Home/Leads screen, a
lead's detail view, Rewards & Earnings, and Profile. Send them to me and I can crop/
resize them to spec, or upload them to Play Console yourself as-is (Play accepts
raw phone screenshots directly).

**Category**: Business
**Tags**: business, productivity

## 2. App content (required before you can publish)

**Privacy policy URL**: `https://heseos-bos-psi.vercel.app/privacy` (already live —
see `app/privacy/page.jsx`). Swap in your own domain here if/when heseos.com points
at this deployment instead.

**App access**: The app requires login, and a brand-new partner account starts
empty (no leads/history for a reviewer to see), so give the review team a working
demo account rather than relying on self-signup:
- Create one dedicated test partner account (or reuse an existing internal one) with
  a few sample leads/conversions already in it so Rewards & Leads aren't empty.
- In Play Console → App content → App access, choose "All functionality is
  available without special access" → No, then provide that username/password and
  a one-line note: "Log in with these credentials on the Home tab to see leads,
  demo scheduling, rewards and profile."

**Ads**: No ads in this app → declare "No, my app does not contain ads."

**Content rating questionnaire**: Category = Reference, News, Or Education → or
Business/Utility if offered as a separate category picker. Answer no to
violence/sexual content/gambling/user-generated content shared publicly (leads are
private between a partner and Heseos, not visible to other partners) — this should
land on **Everyone**.

**Target audience**: 18+ / general audience, not "designed for children" —
this is a business tool for adult partners, not a consumer/kids app. Do NOT check
any of the "appeals to children" boxes.

**Data safety form** — matches `app/privacy/page.jsx` and the single
`android/app/src/main/AndroidManifest.xml` permission (`INTERNET` only, no camera/
location/contacts/microphone requested):

| Data type | Collected? | Shared with 3rd parties? | Purpose |
|---|---|---|---|
| Name | Yes | No | Account management, app functionality |
| Email address | Yes | No | Account management, app functionality |
| Phone number | Yes | No | Account management, app functionality |
| Financial info (bank account details) | Yes | No | App functionality (payout settlement — processed by Heseos itself, not a third-party payment processor) |
| Location, Photos/Videos, Contacts, Camera, Microphone | No | — | Not requested — app has no permission to any of these |
| Third-party analytics/advertising IDs | No | — | No analytics or ad SDKs are included |

- Is all user data encrypted in transit? **Yes** (HTTPS/TLS throughout).
- Can users request their data be deleted? **Yes** — via the contact details on the
  privacy policy page (support@heseos.com).
- Data collection is required for the app to function (it's a login-gated business
  tool), so "data collection is optional" = **No**.

## 3. Pricing & distribution

- **Free** app, no in-app purchases (payouts are settled outside the app — see
  Terms).
- Countries: India at minimum; add others only if you actually onboard partners
  there.
- Not primarily a Google Play for Education / government app — leave those unchecked.

## 4. Build & upload

versionCode is currently `1`, versionName `1.0` in `android/app/build.gradle` — fine
for a first submission. Build the signed bundle yourself (the signing keystore
lives outside this repo on purpose — see README's "Android — build & release"):

```bash
cd android && ./gradlew bundleRelease
```

Upload the resulting `android/app/build/outputs/bundle/release/app-release.aab` to
Play Console → your app → **Testing → Internal testing** first (recommended for a
first-ever submission — lets you install it on your own device and sanity-check
before it goes to real review), then promote to **Production** once you're happy,
or upload straight to Production if you'd rather skip internal testing.

## 5. What's left for you to do in Play Console

Everything above is prep — the actual account, payment, and final "Submit for
review" / "Publish" clicks need to happen in your own Play Console session (I don't
have access to your Google account or a way to pay the registration fee, and
publishing is the kind of action you should be the one to pull the trigger on
anyway). If you get stuck on a specific screen, tell me what you're looking at and
I can walk you through that step.
