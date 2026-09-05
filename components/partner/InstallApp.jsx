'use client';
// Add-to-Home-Screen / native install button for the Partner and Team PWAs — a single shared
// component (Team imports it directly, same pattern as every other screen it borrows from
// components/partner/*) since both apps' manifests (public/partner.webmanifest,
// public/team.webmanifest — plus public/sw.js's service worker) are already fully installable
// (standalone display, full icon set incl. maskable). This just gives the user a way to
// trigger it, on whichever platform they're on:
//
//  - Android / Chrome / Edge (any browser that fires 'beforeinstallprompt'): tapping the menu
//    item calls the browser's own native install prompt directly via that captured event — no
//    custom UI needed, the OS/browser handles the dialog.
//  - iOS Safari: there is no programmatic install API at all — "Add to Home Screen" only exists
//    behind Safari's own Share sheet, and only Safari itself (not Chrome-for-iOS or any other
//    iOS browser, which all have to use Apple's WebKit but can't offer this) can add a real,
//    standalone-launching PWA icon. So on iOS this always opens a bottom sheet with the manual
//    steps instead — there's nothing to programmatically trigger.
//  - Any other browser that simply hasn't fired 'beforeinstallprompt' yet (Firefox, an in-app
//    browser, or Chrome before it's decided the page is "install-worthy") falls back to the
//    same kind of manual-steps sheet, generically worded for "your browser's menu".
//
// Once the app is already running standalone (installed and opened from its home-screen icon,
// or Chrome's 'appinstalled' event has fired) the menu item renders nothing — there's nothing
// left to install.
import { useEffect, useState, useCallback, useRef } from 'react';
import Portal from '@/components/shared/Portal';
import { Button } from './ui';
import { IconDownload, IconShare, IconPlus } from './icons';

export function useInstallPrompt() {
  // A ref, not just state — promptInstall() and waitForPrompt() below need to read the FRESHEST
  // captured event synchronously (state from a stale closure could miss one that arrived a
  // moment ago), so the ref is the source of truth and `hasPrompt` state only exists to make the
  // UI re-render when it changes.
  const deferredRef = useRef(null);
  const [hasPrompt, setHasPrompt] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const standalone = window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true;
    setInstalled(!!standalone);

    const ua = window.navigator.userAgent || '';
    // iPadOS 13+ reports as "Macintosh" but exposes multi-touch — the standard sniff for telling
    // a real Mac apart from an iPad in desktop-site mode.
    setIsIOS(/iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1));

    // Pick up an event already captured before hydration by the beforeInteractive script in
    // app/layout.jsx (window.__heseosInstallPrompt) — Chrome can fire 'beforeinstallprompt'
    // within a second or two of page load, sometimes before this component has even mounted, so
    // relying only on the listener below risks missing it.
    if (window.__heseosInstallPrompt) {
      deferredRef.current = window.__heseosInstallPrompt;
      setHasPrompt(true);
    }

    function onBeforeInstall(e) {
      e.preventDefault();
      window.__heseosInstallPrompt = e;
      deferredRef.current = e;
      setHasPrompt(true);
    }
    function onInstalled() {
      setInstalled(true);
      deferredRef.current = null;
      window.__heseosInstallPrompt = null;
      setHasPrompt(false);
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    const evt = deferredRef.current;
    if (!evt) return false;
    evt.prompt();
    const choice = await evt.userChoice.catch(() => null);
    deferredRef.current = null; // a captured prompt event can only ever be used once
    window.__heseosInstallPrompt = null;
    setHasPrompt(false);
    return choice?.outcome === 'accepted';
  }, []);

  // Chrome doesn't always fire 'beforeinstallprompt' before the visitor has even had a chance to
  // tap "Download App" — it can take a beat after page load. Rather than immediately falling
  // back to manual instructions, give it a short window to still show up.
  const waitForPrompt = useCallback(async (timeoutMs = 1800) => {
    if (deferredRef.current) return true;
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      await new Promise((r) => setTimeout(r, 100));
      if (deferredRef.current) return true;
    }
    return !!deferredRef.current;
  }, []);

  return { installed, isIOS, canPromptNative: hasPrompt, promptInstall, waitForPrompt };
}

// Bottom-sheet with manual "how to install" steps — shown whenever there's no native prompt to
// trigger (always on iOS; as a fallback everywhere else). Reuses the same .hp-sheet-overlay /
// .hp-sheet markup as every other bottom sheet in this app (see
// components/team/LeadDetailScreen.jsx for the pattern this was copied from).
function InstallStepsSheet({ appName, isIOS, onClose }) {
  const steps = isIOS
    ? [
        { icon: IconShare, text: "Tap the Share icon in Safari's toolbar" },
        { icon: IconPlus, text: 'Scroll down and tap "Add to Home Screen"' },
        { icon: IconDownload, text: 'Tap "Add" — the app icon appears on your home screen' },
      ]
    : [
        { icon: IconDownload, text: "Open your browser's menu (⋮ or ···)" },
        { icon: IconPlus, text: 'Tap "Install app" or "Add to Home screen"' },
        { icon: IconDownload, text: 'Confirm — the app icon appears on your home screen' },
      ];

  return (
    <Portal>
      <div className="hp-sheet-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="hp-sheet">
          <div className="hp-sheet-handle" />
          <div className="hp-sheet-title">Install Heseos {appName}</div>
          <div className="hp-sheet-sub">
            {isIOS ? 'Open this page in Safari, then:' : 'Add this app to your home screen for one-tap access:'}
          </div>
          <div className="hp-menu-list" style={{ marginBottom: 4 }}>
            {steps.map((s, i) => {
              const Icon = s.icon;
              return (
                <div className="hp-menu-item" style={{ cursor: 'default' }} key={i}>
                  <span className="hp-menu-icon"><Icon size={16} /></span>
                  <span className="hp-menu-label">{i + 1}. {s.text}</span>
                </div>
              );
            })}
          </div>
          <div className="hp-sheet-actions">
            <Button variant="outline" block onClick={onClose}>Got it</Button>
          </div>
        </div>
      </div>
    </Portal>
  );
}

// Shared behaviour behind both trigger shapes below: tapping either one either fires the
// browser's native install prompt directly (Android/Chrome/Edge, once 'beforeinstallprompt' has
// fired) or opens the manual-steps sheet (always on iOS; as a fallback everywhere else — see
// this file's header comment for the full breakdown).
function useInstallAction() {
  const { installed, isIOS, canPromptNative, promptInstall, waitForPrompt } = useInstallPrompt();
  const [showSheet, setShowSheet] = useState(false);
  const [checking, setChecking] = useState(false);

  async function handleClick() {
    // A native prompt IS the complete flow — whether the user accepts or dismisses it, that's
    // their answer. Chrome doesn't always have fired 'beforeinstallprompt' by the time someone
    // taps this (it can take a beat after page load), so if it's not ready yet, give it a short
    // window (waitForPrompt) rather than immediately assuming it'll never come — only fall back
    // to the manual-steps sheet once that window has passed with nothing (always true on iOS,
    // which never fires the event at all; sometimes true elsewhere).
    if (canPromptNative) {
      await promptInstall();
      return;
    }
    setChecking(true);
    const available = await waitForPrompt();
    setChecking(false);
    if (available) {
      await promptInstall();
      return;
    }
    setShowSheet(true);
  }

  return { installed, isIOS, showSheet, setShowSheet, checking, handleClick };
}

// Drop-in .hp-menu-item row for Profile screens (components/partner/ProfileScreen.jsx,
// components/team/ProfileScreen.jsx). `appName` is just the display copy ("Partner App" /
// "Team App") for the sheet's title. Renders nothing once the app is already installed.
export default function InstallAppMenuItem({ appName = 'App' }) {
  const { installed, isIOS, showSheet, setShowSheet, checking, handleClick } = useInstallAction();

  if (installed) return null;

  return (
    <>
      <button className="hp-menu-item" onClick={handleClick} disabled={checking}>
        <span className="hp-menu-icon"><IconDownload size={17} /></span>
        <span className="hp-menu-label">{checking ? 'Preparing install…' : 'Install App'}</span>
      </button>
      {showSheet && <InstallStepsSheet appName={appName} isIOS={isIOS} onClose={() => setShowSheet(false)} />}
    </>
  );
}

// Standalone "Download App" CTA button — same install behaviour as InstallAppMenuItem above,
// styled to sit alongside the Login/Sign Up buttons on the pre-login hero screens
// (app/partner/page.jsx, app/team/page.jsx) so a visitor can grab the PWA before they even log
// in, on both Android (native install dialog) and iPhone (manual Add to Home Screen steps).
// Renders nothing once the app is already installed. A Server Component page can render this
// directly — it's the 'use client' boundary itself.
export function InstallAppButton({ appName = 'App', className = '' }) {
  const { installed, isIOS, showSheet, setShowSheet, checking, handleClick } = useInstallAction();

  if (installed) return null;

  return (
    <>
      <button type="button" className={`hp-btn hp-btn-ghost hp-btn-block hp-btn-sm ${className}`} onClick={handleClick} disabled={checking}>
        <IconDownload size={16} /> {checking ? 'Preparing…' : 'Download App'}
      </button>
      {showSheet && <InstallStepsSheet appName={appName} isIOS={isIOS} onClose={() => setShowSheet(false)} />}
    </>
  );
}
