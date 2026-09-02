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
import { useEffect, useState, useCallback } from 'react';
import { Button } from './ui';
import { IconDownload, IconShare, IconPlus } from './icons';

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
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

    function onBeforeInstall(e) {
      e.preventDefault();
      setDeferredPrompt(e);
    }
    function onInstalled() {
      setInstalled(true);
      setDeferredPrompt(null);
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice.catch(() => null);
    setDeferredPrompt(null); // a captured prompt event can only ever be used once
    return choice?.outcome === 'accepted';
  }, [deferredPrompt]);

  return { installed, isIOS, canPromptNative: !!deferredPrompt, promptInstall };
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
  );
}

// Drop-in .hp-menu-item row for Profile screens (components/partner/ProfileScreen.jsx,
// components/team/ProfileScreen.jsx). `appName` is just the display copy ("Partner App" /
// "Team App") for the sheet's title. Renders nothing once the app is already installed.
export default function InstallAppMenuItem({ appName = 'App' }) {
  const { installed, isIOS, canPromptNative, promptInstall } = useInstallPrompt();
  const [showSheet, setShowSheet] = useState(false);

  if (installed) return null;

  async function handleClick() {
    // A native prompt IS the complete flow — whether the user accepts or dismisses it, that's
    // their answer. Only fall back to the manual-steps sheet when there's no native prompt to
    // offer at all (always true on iOS; sometimes true elsewhere).
    if (canPromptNative) {
      await promptInstall();
      return;
    }
    setShowSheet(true);
  }

  return (
    <>
      <button className="hp-menu-item" onClick={handleClick}>
        <span className="hp-menu-icon"><IconDownload size={17} /></span>
        <span className="hp-menu-label">Install App</span>
      </button>
      {showSheet && <InstallStepsSheet appName={appName} isIOS={isIOS} onClose={() => setShowSheet(false)} />}
    </>
  );
}
