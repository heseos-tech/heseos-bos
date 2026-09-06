// Heseos BOS service worker — install + offline shell for /employee, /team and /partner ONLY.
// Ported from MARG's public/sw.js: every request outside those scopes passes straight
// through to the network, so a stale cache can never break the marketing site or admin panel
// after a redeploy.
//
// v2: page requests (the app shell HTML) now race the network against a short timeout instead
// of always waiting for it. This matters specifically for the installed PWA (Chrome/Safari
// "Add to Home Screen") — unlike the Capacitor-wrapped app, which has a native splash screen to
// cover any wait, an installed PWA has nothing covering the gap between tapping the icon and
// the page appearing. Partner/Team no longer do a database-gated server render (see lib/auth.js
// + components/partner/ui.jsx's useSessionGate), so the network response itself is now fast in
// the common case — this only kicks in and serves the last-known-good cached shell instantly
// when the connection itself is slow/flaky, while the network fetch keeps running in the
// background (e.waitUntil) to refresh the cache for the next open. A registered service worker
// only takes over AFTER the very first visit, so this doesn't change first-ever-install
// behaviour, and it never touches /api/* calls (leads/messages/session checks) — those always
// go straight to the network, same as before.
const CACHE = 'heseos-bos-v2';
const SHELL = ['/employee', '/team', '/partner', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'];
const RACE_TIMEOUT_MS = 400;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch { return; }
  if (url.origin !== self.location.origin) return;

  // Immutable, content-hashed build assets — safe to cache-first.
  if (url.pathname.startsWith('/_next/static/')) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }))
    );
    return;
  }

  const inEmployee = url.pathname === '/employee' || url.pathname.startsWith('/employee/');
  const inTeam = url.pathname === '/team' || url.pathname.startsWith('/team/');
  const inPartner = url.pathname === '/partner' || url.pathname.startsWith('/partner/');
  const isShell = SHELL.includes(url.pathname);
  // Never cache API calls — leads/messages/session checks must always hit the network.
  const isApi = url.pathname.startsWith('/api/');
  if ((!inEmployee && !inTeam && !inPartner && !isShell) || isApi) return;

  const fallbackShell = inEmployee ? '/employee' : (inTeam ? '/team' : '/partner');

  e.respondWith((async () => {
    const cached = await caches.match(req);

    const networkPromise = fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => null);
    // Keep the worker alive long enough for the cache write above even if we already answered
    // from cache below — otherwise the browser can kill it the instant respondWith settles.
    e.waitUntil(networkPromise);

    // Nothing cached yet (first-ever visit to this URL) — nothing to race against, so this
    // behaves exactly like the old network-first logic: wait for the network, fall back to
    // any cached copy or the shell only on outright failure.
    if (!cached) {
      const res = await networkPromise;
      if (res) return res;
      return (await caches.match(req)) || (req.mode === 'navigate' ? caches.match(fallbackShell) : Response.error());
    }

    // Already have a cached copy of this exact page — race it against the network. A fast
    // connection still gets the freshest response (the common case now); a slow one gets the
    // cached page instantly instead of staring at a blank screen, with the network update
    // landing in the cache for the next open.
    const timedOut = new Promise((resolve) => setTimeout(() => resolve(null), RACE_TIMEOUT_MS));
    const fast = await Promise.race([networkPromise, timedOut]);
    return fast || cached;
  })());
});
