// The HESEOS smart-home enquiry landing page (public/smart-home/index.html, served at /smart-home
// — see next.config.mjs) as the destination of a QR scan / referral link. When someone scans a
// partner/location QR or taps a referral link, lib/heseosDefaultFlow.js's single message replies
// with the usual "thanks for scanning" greeting plus a tappable button to THIS page, instead of
// running a long question-by-question chat. The page's own form (app/api/leads/landing/route.js)
// then creates the lead and credits whoever the link belonged to via the ref code below.
import { indianMobile } from '@/lib/heseosDoorLock';

// The full https:// link for one WhatsApp chat. Everything after /smart-home is optional:
//  ?ref=<code>  the attribution code (lib/attribution.js) of the QR/referral link this chat came
//               from — it is what makes the landing-page lead count for that partner/referrer
//  ?via=wa      marks the visit as coming from a WhatsApp chat, so a lead with no ref code is still
//               labelled "WhatsApp Direct" rather than "Landing Page"
//  ?p=<mobile>  only PRE-FILLS the mobile field (the customer can change it)
//  ?c=<city>    only PRE-SELECTS the city we already know for that link (partner's / placement's city)
// '' if PUBLIC_BASE_URL isn't set in this environment, so a flow never texts a dead, base-less link.
export function smartHomeLink(phone, { ref, city } = {}) {
  const base = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
  if (!base) return '';
  const params = ['via=wa'];
  const code = String(ref || '').trim();
  if (/^[A-Za-z0-9]{4,24}$/.test(code)) params.push(`ref=${code}`);
  const mobile = indianMobile(phone);
  if (mobile) params.push(`p=${mobile}`);
  const c = String(city || '').trim();
  if (c) params.push(`c=${encodeURIComponent(c)}`);
  return `${base}/smart-home${params.length ? `?${params.join('&')}` : ''}`;
}
