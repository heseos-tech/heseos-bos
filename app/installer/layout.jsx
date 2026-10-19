import '../partner/partner-app.css';
import RegisterSW from '@/components/RegisterSW';
import HideNativeSplash from '@/components/partner/HideNativeSplash';

// Installer app — for installation partners (partners.type === 'installer'). Same .hp-* design
// system as the Partner and Team apps; see components/installer/ui.jsx.
export const metadata = {
  title: 'Heseos Installer — Install & Earn',
  manifest: '/installer.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Heseos Installer' },
  icons: { apple: '/apple-touch-icon.png' },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#060f1c',
};

export default function InstallerLayout({ children }) {
  return (
    <>
      <RegisterSW />
      <HideNativeSplash />
      {children}
    </>
  );
}
