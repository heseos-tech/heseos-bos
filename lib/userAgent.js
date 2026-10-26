// Tiny user-agent reader for the landing-page analytics — OS, browser and (where the browser says so) the phone
// model. No dependency. iPhones never reveal their model in the user-agent, so they show as just "iPhone".
export function parseUserAgent(uaRaw) {
  const ua = String(uaRaw || '').slice(0, 400);
  let os = '', osVersion = '', model = '', browser = '', inApp = '';

  let m;
  if ((m = ua.match(/Android[ /]([\d.]+)/))) {
    os = 'Android'; osVersion = m[1];
    // "...; Android 13; SM-S918B Build/..." or "...; Android 13; Pixel 7) ..."
    const mm = ua.match(/Android[ /][\d.]+;\s*([^;)]+?)(?:\s+Build\/|\)|;)/);
    const raw = mm ? mm[1].trim() : '';
    if (raw && !/^(wv|K|U)$/.test(raw) && !/Linux/.test(raw)) model = raw.slice(0, 40);
  } else if (/iPhone|iPad|iPod/.test(ua)) {
    os = 'iOS';
    m = ua.match(/OS (\d+)[_.](\d+)/); if (m) osVersion = `${m[1]}.${m[2]}`;
    model = /iPad/.test(ua) ? 'iPad' : /iPod/.test(ua) ? 'iPod' : 'iPhone';
  } else if (/Windows NT/.test(ua)) {
    os = 'Windows';
  } else if (/Mac OS X|Macintosh/.test(ua)) {
    os = 'macOS';
  } else if (/CrOS/.test(ua)) {
    os = 'ChromeOS';
  } else if (/Linux/.test(ua)) {
    os = 'Linux';
  }

  if (/FBAN|FBAV|FB_IAB/.test(ua)) inApp = 'Facebook';
  else if (/Instagram/.test(ua)) inApp = 'Instagram';
  else if (/WhatsApp/.test(ua)) inApp = 'WhatsApp';
  else if (/Line\//.test(ua)) inApp = 'Line';

  if (/SamsungBrowser/.test(ua)) browser = 'Samsung Internet';
  else if (/EdgA?\/|Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera/.test(ua)) browser = 'Opera';
  else if (/Firefox\/|FxiOS/.test(ua)) browser = 'Firefox';
  else if (/CriOS/.test(ua) || (/Chrome\//.test(ua) && !/Chromium/.test(ua))) browser = 'Chrome';
  else if (/Safari\//.test(ua) && /Version\//.test(ua)) browser = 'Safari';
  else if (/Safari\//.test(ua)) browser = 'Safari';
  if (inApp) browser = `${inApp} in-app browser`;

  return { os, osVersion, model, browser };
}

// Vercel puts the visitor's approximate location on every request (derived from the IP — no outside call).
// The city header is percent-encoded. Returns '' for anything missing.
export function geoFromHeaders(headers) {
  const dec = (v) => { try { return decodeURIComponent(String(v || '')); } catch { return String(v || ''); } };
  return {
    city: dec(headers.get('x-vercel-ip-city')).slice(0, 60),
    region: String(headers.get('x-vercel-ip-country-region') || '').slice(0, 10),
    country: String(headers.get('x-vercel-ip-country') || '').slice(0, 2),
  };
}
