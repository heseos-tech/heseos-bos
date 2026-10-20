// The public https:// address customers' phones can actually open — used to build every link we
// text out (landing pages, quotation, installation booking...). Uses PUBLIC_BASE_URL, but ignores
// a value that points at the developer's own machine (localhost / 127.0.0.1 / a bare LAN IP) or
// has no scheme, because such a link can never open on a customer's phone ("website not
// opening"). In that case it falls back to the Vercel production address that Vercel exposes
// automatically (VERCEL_PROJECT_PRODUCTION_URL), and returns '' only if neither is usable.
export function publicBaseUrl() {
  const clean = (v) => String(v || '').trim().replace(/\/+$/, '');
  const usable = (u) => {
    if (!/^https?:\/\//i.test(u)) return false;
    try {
      const h = new URL(u).hostname;
      if (h === 'localhost' || h.endsWith('.localhost') || h === '0.0.0.0' || h === '[::1]') return false;
      if (/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h)) return false;
      return true;
    } catch { return false; }
  };
  const explicit = clean(process.env.PUBLIC_BASE_URL);
  if (usable(explicit)) return explicit;
  const prod = clean(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  if (prod) {
    const u = /^https?:\/\//i.test(prod) ? prod : `https://${prod}`;
    if (usable(u)) return u;
  }
  return '';
}
