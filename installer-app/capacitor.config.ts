import type { CapacitorConfig } from '@capacitor/cli';

// Heseos INSTALLER app — a thin native shell around the live /installer web app, exactly like
// the Partner app (see ../capacitor.config.ts) but with its own appId, name, icon and Android
// project, so both apps can be installed side by side and published separately.
// Keep `server.url` and www/error.html's hardcoded URL in sync by hand.
const config: CapacitorConfig = {
  appId: 'com.heseos.installer',
  appName: 'Heseos Installer',
  webDir: 'www',
  server: {
    url: 'https://heseos-bos-psi.vercel.app/installer',
    cleartext: false,
    errorPath: 'error.html',
  },
  backgroundColor: '#060f1c',
  plugins: {
    SplashScreen: {
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
