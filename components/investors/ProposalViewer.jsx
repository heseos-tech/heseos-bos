'use client';

import { useEffect, useRef } from 'react';

// The unlocked view: a slim confidentiality bar (carries the reader's name as a deterrent) over
// the proposal, loaded from the cookie-protected API route. While it is open it reports read time,
// scroll depth and seconds per slide to /api/investors/ping (Admin -> Landing Activity -> Investors).
// The proposal is same-origin, so its slides (<section class="slide" id>) can be observed directly.
export default function ProposalViewer({ name }) {
  const frame = useRef(null);

  const signOut = async () => {
    try { await fetch('/api/investors/logout', { method: 'POST' }); } catch { /* ignore */ }
    window.location.reload();
  };

  useEffect(() => {
    const sid = (Date.now().toString(36) + Math.random().toString(36).slice(2, 12)).replace(/[^a-z0-9]/g, '');
    const st = { sid, activeSeconds: 0, maxScroll: 0, slides: {}, device: window.innerWidth < 700 ? 'mobile' : window.innerWidth < 1100 ? 'tablet' : 'desktop' };
    const visible = new Set();
    let dirty = true;
    let io = null;

    const send = () => {
      if (!dirty) return;
      dirty = false;
      const body = JSON.stringify(st);
      try { if (navigator.sendBeacon && navigator.sendBeacon('/api/investors/ping', new Blob([body], { type: 'application/json' }))) return; } catch { /* fall through */ }
      try { fetch('/api/investors/ping', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }); } catch { /* ignore */ }
    };

    const onScroll = (e) => {
      const doc = frame.current?.contentDocument;
      if (!doc) return;
      const t = !e.target || e.target === doc ? doc.scrollingElement : e.target;
      if (!t || t.scrollHeight == null) return;
      const room = t.scrollHeight - t.clientHeight;
      if (room < 200) return;
      const pct = Math.min(100, Math.round((t.scrollTop / room) * 100));
      if (pct > st.maxScroll) { st.maxScroll = pct; dirty = true; }
    };

    const attach = () => {
      const win = frame.current?.contentWindow;
      const doc = frame.current?.contentDocument;
      if (!win || !doc) return;
      win.addEventListener('scroll', onScroll, { capture: true, passive: true });
      if ('IntersectionObserver' in win) {
        io = new win.IntersectionObserver((ents) => {
          ents.forEach((en) => { if (en.isIntersecting) visible.add(en.target.id); else visible.delete(en.target.id); });
        }, { threshold: 0.45 });
        doc.querySelectorAll('section[id]').forEach((el) => io.observe(el));
      }
    };
    const f = frame.current;
    f?.addEventListener('load', attach);
    if (f?.contentDocument?.readyState === 'complete') attach();

    // Every second the tab is in view: count read time, and give the slide(s) on screen a second.
    const tick = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      st.activeSeconds += 1;
      visible.forEach((id) => { if (id) st.slides[id] = (st.slides[id] || 0) + 1; });
      dirty = true;
    }, 1000);
    const push = setInterval(send, 10000);
    const hide = () => { if (document.visibilityState === 'hidden') { dirty = true; send(); } };
    const leave = () => { dirty = true; send(); };
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('pagehide', leave);
    setTimeout(send, 2500);

    return () => {
      clearInterval(tick); clearInterval(push);
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('pagehide', leave);
      f?.removeEventListener('load', attach);
      try { io && io.disconnect(); } catch { /* ignore */ }
      leave();
    };
  }, []);

  return (
    <div className="inv-viewer">
      <div className="inv-bar">
        <span className="inv-bar-mark">Confidential</span>
        <span className="inv-bar-who">Shared with {name}</span>
        <button type="button" className="inv-bar-out" onClick={signOut}>Sign out</button>
      </div>
      <iframe ref={frame} className="inv-frame" src="/api/investors/proposal" title="Heseos Investment Proposal" />
    </div>
  );
}
