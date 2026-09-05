'use client';
// components/shared/Portal.jsx — renders its children directly under document.body via
// React's createPortal, escaping every ancestor's stacking/clipping context entirely.
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
// Portaling to document.body sidesteps the whole class of bug: the sheet is no longer a
// descendant of any scrollable/clipping ancestor, so there's nothing left to clip it, and it's
// compared against the nav purely on z-index (where it already wins).
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export default function Portal({ children }) {
  const [mounted, setMounted] = useState(false);
  // document is undefined during SSR/the first server-rendered pass — only portal once we're
  // actually mounted in the browser.
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}
