import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.heseos.partner',
  appName: 'Heseos Partner',
  webDir: 'www',
  server: {
    url: 'https://heseos-bos-psi.vercel.app/partner',
    cleartext: false,
  },
  backgroundColor: '#060f1c',
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
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
