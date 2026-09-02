import Script from 'next/script';
import './globals.css';
import FloatingCTA from '@/components/FloatingCTA';

export const metadata = {
  title: 'Heseos: Smart Home Automation, Done Right',
  description:
    'Heseos designs and installs smart home automation for every space — from a single retrofit switch to a fully automated home. Book a free demo today.',
  keywords: 'home automation, smart home, smart switches, touch panel, retrofit automation, Heseos',
  icons: {
    icon: [{ url: '/icon-192.png', type: 'image/png' }],
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'Heseos: Smart Home Automation, Done Right',
    description: 'Book a free demo. Our smart home experts recommend the right automation solution for your space.',
    type: 'website',
    siteName: 'Heseos',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        {/*
          Captures the browser's 'beforeinstallprompt' event (Chrome/Edge's signal that the PWA
          is installable) the instant it fires, into window.__heseosInstallPrompt — BEFORE React
          hydrates. Chrome can fire this event within a second or two of page load, sometimes
          before a client component's own useEffect has attached its listener; without this, a
          visitor who taps "Download App" fast enough on the Partner/Team landing screen
          (components/partner/InstallApp.jsx's useInstallPrompt) could miss the native install
          dialog and fall back to the manual "Add to Home Screen" instructions instead. Runs on
          every page (root layout), not just /partner and /team, since it costs nothing elsewhere.
        */}
        <Script id="pwa-install-capture" strategy="beforeInteractive">
          {`window.__heseosInstallPrompt = null;
window.addEventListener('beforeinstallprompt', function (e) {
  e.preventDefault();
  window.__heseosInstallPrompt = e;
});`}
        </Script>
      </head>
      <body>
        <FloatingCTA />
        {children}
      </body>
    </html>
  );
}
