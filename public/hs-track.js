/* HESEOS landing-page analytics — first-party, no cookies, no third-party calls.
 *
 * Include on a landing page with:  <script src="/hs-track.js" data-page="door_lock"></script>
 * (data-page: door_lock | smart_home). It keeps ONE cumulative snapshot of the visit — how far the
 * visitor scrolled, which sections they reached, which buttons they tapped, whether they started /
 * submitted the form, and how long the page was actually in view — and POSTs it to /api/track
 * (merged server-side into one row per visit, see lib/landingActivity.js).
 *
 * Pages can add to it through window.hsTrack(event, data):
 *   hsTrack('error')                                  a validation / server error was shown
 *   hsTrack('submitted', {name, phone, refId})        the form went through
 * It stays silent for crawlers, link-preview bots and visitors who send Do-Not-Track.
 */
(function () {
  'use strict';
  var script = document.currentScript;
  var page = script && script.getAttribute('data-page');
  if (!page) return;
  var ua = navigator.userAgent || '';
  if (/bot|crawl|spider|slurp|headless|preview|facebookexternalhit|whatsapp\/|lighthouse/i.test(ua)) return;
  if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return;

  var ENDPOINT = '/api/track';
  var q;
  try { q = new URLSearchParams(location.search); } catch (e) { q = { get: function () { return null; } }; }
  function store(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { /* storage blocked */ } return null; }

  var sid = store('hs_sid_' + page);
  if (!sid || !/^[a-z0-9]{8,40}$/.test(sid)) {
    sid = (Date.now().toString(36) + Math.random().toString(36).slice(2, 12)).replace(/[^a-z0-9]/g, '');
    store('hs_sid_' + page, sid);
  }

  var t0 = Date.now();
  function secs() { return Math.round((Date.now() - t0) / 1000); }

  var s = {
    sid: sid, page: page,
    via: q.get('via') === 'wa' ? 'wa' : (store('hs_via') === 'wa' ? 'wa' : ''),
    ref: (/^[A-Za-z0-9]{4,24}$/.test(q.get('ref') || '') ? q.get('ref') : (store('hs_ref') || '')),
    p: /^\d{10}$/.test(q.get('p') || '') ? q.get('p') : '',
    utm: { source: q.get('utm_source') || '', medium: q.get('utm_medium') || '', campaign: q.get('utm_campaign') || '' },
    referrer: '',
    device: window.innerWidth < 700 ? 'mobile' : window.innerWidth < 1100 ? 'tablet' : 'desktop',
    maxScroll: 0, activeSeconds: 0, sections: [], clicks: [],
    formStartSecs: null, fields: [], submitAttempts: 0, errors: 0, submittedSecs: null,
    contact: null, refId: ''
  };
  try {
    if (document.referrer) { var h = new URL(document.referrer).hostname; if (h && h !== location.hostname) s.referrer = h; }
  } catch (e) { /* ignore */ }

  var dirty = true, timer = null;
  function send() {
    timer = null; if (!dirty) return; dirty = false;
    var body = JSON.stringify(s);
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }))) return;
    } catch (e) { /* fall through */ }
    try { fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true }); } catch (e) { /* ignore */ }
  }
  function soon() { dirty = true; if (!timer) timer = setTimeout(send, 1500); }
  function now() { dirty = true; if (timer) { clearTimeout(timer); } send(); }

  // Time actually spent looking at the page (tab visible).
  setInterval(function () { if (document.visibilityState === 'visible') { s.activeSeconds += 1; dirty = true; } }, 1000);
  setInterval(function () { if (dirty) send(); }, 20000);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') now(); });
  window.addEventListener('pagehide', now);

  // Scroll depth, reported in 25% steps so one scroll doesn't mean dozens of beacons.
  var ticking = false, lastStep = 0;
  function onScroll() {
    if (ticking) return; ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      var el = document.documentElement;
      var total = Math.max(el.scrollHeight, document.body.scrollHeight) - window.innerHeight;
      var pct = total <= 0 ? 100 : Math.min(100, Math.round(((window.pageYOffset || el.scrollTop) / total) * 100));
      if (pct > s.maxScroll) { s.maxScroll = pct; var step = Math.floor(pct / 25); if (step > lastStep) { lastStep = step; soon(); } else { dirty = true; } }
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  // Sections reached (any <section id="…"> that gets ≥30% on screen).
  function watchSections() {
    if (!('IntersectionObserver' in window)) return;
    var seen = {};
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) {
        var id = en.target.id;
        if (en.isIntersecting && id && !seen[id]) { seen[id] = 1; s.sections.push([id, secs()]); soon(); }
      });
    }, { threshold: 0.3 });
    [].slice.call(document.querySelectorAll('section[id]')).forEach(function (el) { io.observe(el); });
  }

  // Buttons / links tapped (not the form's own submit button — that's counted as a submit attempt).
  function labelOf(el) { return (el.textContent || '').replace(/[↗↓→↑]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40); }
  function locOf(el) {
    if (el.closest('.mobile-cta')) return 'sticky bar';
    if (el.closest('nav')) return 'top nav';
    if (el.closest('.hero')) return 'hero';
    var sec = el.closest('section[id]');
    return sec ? sec.id : 'page';
  }
  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('a, button') : null;
    if (!el || el.type === 'submit') return;
    var label = labelOf(el);
    if (!label || s.clicks.length >= 40) return;
    var c = [label, locOf(el), secs()];
    if (!s.clicks.some(function (x) { return x[0] === c[0] && x[1] === c[1] && x[2] === c[2]; })) { s.clicks.push(c); now(); }
  }, true);

  // Form engagement.
  function onFormTouch(e) {
    var t = e.target; if (!t || !t.closest || !t.closest('form') || !/^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) return;
    if (s.formStartSecs == null) { s.formStartSecs = secs(); soon(); }
    var n = t.name || t.id; if (n && n !== 'website' && s.fields.indexOf(n) < 0 && s.fields.length < 15) { s.fields.push(n); dirty = true; }
  }
  document.addEventListener('focusin', onFormTouch);
  document.addEventListener('input', onFormTouch);
  document.addEventListener('submit', function () { s.submitAttempts += 1; soon(); }, true);

  window.hsTrack = function (ev, data) {
    if (ev === 'error') { s.errors += 1; soon(); }
    else if (ev === 'submitted') {
      s.submittedSecs = secs();
      data = data || {};
      s.contact = { name: String(data.name || '').slice(0, 60), phone: String(data.phone || '').replace(/\D/g, '').slice(-10) };
      s.refId = String(data.refId || '').slice(0, 40);
      now();
    }
  };

  function start() { watchSections(); onScroll(); now(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
