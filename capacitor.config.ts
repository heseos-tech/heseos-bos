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
      // Was 800ms — too short to reliably cover a cold fetch of the app shell over an average
      // (let alone poor) mobile connection, so the branded splash was hiding well before the
      // page had anything to show, revealing blank white underneath until (or unless) the load
      // actually finished. Longer, plus errorPath above for when it genuinely never does.
      launchShowDuration: 3000,
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
