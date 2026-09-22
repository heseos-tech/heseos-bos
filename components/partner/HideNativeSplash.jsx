'use client';
import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';

// Hides the native app's launch splash the moment this — the Partner app's root layout — has
// actually mounted, instead of capacitor.config.ts's old fixed timer (which hid it on a clock
// whether or not the page had actually loaded, leaving a blank WebView on anything slower than
// that timer — see the SplashScreen.launchShowDuration comment there). This fires on the very
// first real paint, so a fast connection hides it right away and a slow-but-working one stays
// covered for exactly as long as it actually takes — no fixed delay either way. Purely a safety
// net (launchAutoHide + launchShowDuration) is left to cover the case where this JS never runs
// at all: a load that fails outright, or a WebView too old to run it.
//
// Capacitor.isNativePlatform() is false in the regular browser/PWA, where there's no native
// splash to hide and this is a no-op.
export default function HideNativeSplash() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    SplashScreen.hide().catch(() => {});
  }, []);
  return null;
}
