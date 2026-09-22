import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.heseos.partner',
  appName: 'Heseos Partner',
  webDir: 'www',
  server: {
    url: 'https://heseos-bos-psi.vercel.app/partner',
    cleartext: false,
    // Shown instead of a blank white WebView when the live app shell can't be loaded (no/slow
    // connection, a too-old WebView, etc. — this is what "the app just won't open" turned out
    // to be on some phones: the native splash below hides on a timer regardless of whether the
    // page actually finished loading, so a slow/failed load left nothing but the WebView's own
    // blank background underneath). See www/error.html.
    errorPath: 'error.html',
  },
  backgroundColor: '#060f1c',
  plugins: {
    SplashScreen: {
      // launchAutoHide stays true (a plain timer) ONLY as a safety net for when our own JS
      // never gets to run at all — a genuinely failed load, or a WebView too old to run it.
      // The real hide is components/partner/HideNativeSplash.jsx: it calls SplashScreen.hide()
      // manually the moment the app has actually mounted, which — being tied to a real event
      // instead of a guessed duration — hides it immediately on a fast connection and keeps
      // covering the wait for as long as a slow-but-working one actually takes, with no fixed
      // delay either way. So this number only matters for the failure case: long enough that it
      // never fires before a normal load (successful or slow) would have hidden it manually
      // anyway, short enough that a truly broken load doesn't sit on the splash forever before
      // falling through to errorPath above.
      launchShowDuration: 6000,
      launchAutoHide: true,
      backgroundColor: '#060f1c',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#060f1c',
    },
  },
};

export default config;
