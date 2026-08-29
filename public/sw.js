// Heseos BOS service worker — install + offline shell for /employee, /team and /partner ONLY.
// Ported from MARG's public/sw.js: every request outside those scopes passes straight
// through to the network, so a stale cache can never break the marketing site or admin panel
// after a redeploy.
const CACHE = 'heseos-bos-v1';
const SHELL = ['/employee', '/team', '/partner', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'];

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
  // Never cache API calls — leads/messages must always be fresh.
  const isApi = url.pathname.startsWith('/api/');
  if ((!inEmployee && !inTeam && !inPartner && !isShell) || isApi) return;

  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || (req.mode === 'navigate' ? caches.match(inEmployee ? '/employee' : (inTeam ? '/team' : '/partner')) : undefined)))
  );
});
