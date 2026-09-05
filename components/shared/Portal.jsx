'use client';
// components/shared/Portal.jsx — renders its children into a stable container that escapes
// .hp-shell-scroll/.hp-shell's overflow clipping, via React's createPortal.
//
// Why this exists: every bottom sheet in the Partner/Team apps (.hp-sheet-overlay) and the
// shared quotation modal (.qb-modal-overlay) are position:fixed with a z-index comfortably
// above .hp-bottom-nav's (300/1000 vs 40) — on paper that should always paint above the nav.
// In practice, on the Partner/Team mobile shell, these sheets were rendered as deep descendants
// of .hp-shell-scroll (overflow-y:auto) and .hp-shell (overflow:hidden); a position:fixed
// element still gets its paint clipped to such an ancestor's box in real browsers, even though
// its *position* is computed against the viewport — so the sheet's own bottom edge (and the
// dark backdrop behind it) was ending wherever that ancestor's box happened to end, not at the
// true bottom of the screen, leaving a gap through which the always-viewport-fixed bottom nav
// showed through untouched, cutting off the sheet's lowest content/buttons behind it. Reported
// against the Team App's "Add Task" sheet, the "Mark Demo Outcome" sheet and the Partner
// Catalogue's product-detail sheet — same underlying cause in all three, likely every
// .hp-sheet-overlay/.qb-modal-overlay in the app.
//
// FIRST ATTEMPT (portaling straight to document.body) traded that bug for a worse one: .hp-root
// is where every --hp-* custom property (background, text, border, shadow tokens — see
// app/partner/partner-app.css) is DEFINED, and CSS custom properties only cascade to DOM
// DESCENDANTS of the element that sets them. A child of document.body is no longer a descendant
// of .hp-root at all (React's component tree still nests it there, but the DOM position is what
// CSS inheritance follows), so every var(--hp-...) inside .hp-sheet/.hp-sheet-overlay resolved
// to nothing — no background, no border, no shadow — which is exactly the "see-through, buttons
// floating over the catalogue grid and the nav" look reported right after that fix shipped.
//
// The actual fix: portal into a container that is still INSIDE .hp-root (so every --hp-*
// variable still cascades to it) but is a DIRECT child of .hp-root rather than nested inside
// .hp-shell/.hp-shell-scroll — the same nesting depth .hp-bottom-nav itself sits at, which is
// exactly why the nav has never had this clipping problem. Falls back to document.body when no
// .hp-root is present on the page at all (QuotationBuilderModal's other two mount points, Admin
// and the desktop Sales Engineer panel, use plain hardcoded colors in their .qb-* classes — see
// app/globals.css — so they don't depend on .hp-root's variables and portaling to body is fine).
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

function getOrCreatePortalTarget() {
  const root = document.querySelector('.hp-root');
  const parent = root || document.body;
  const layerClass = root ? 'hp-portal-layer' : 'hp-portal-layer-body';
  let el = parent.querySelector(`:scope > .${layerClass}`);
  if (!el) {
    el = document.createElement('div');
    el.className = layerClass;
    parent.appendChild(el);
  }
  return el;
}

export default function Portal({ children }) {
  const [target, setTarget] = useState(null);
  // document is undefined during SSR/the first server-rendered pass — only portal once we're
  // actually mounted in the browser.
  useEffect(() => { setTarget(getOrCreatePortalTarget()); }, []);
  if (!target) return null;
  return createPortal(children, target);
}
