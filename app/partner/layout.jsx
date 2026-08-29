import './partner-app.css';
import RegisterSW from '@/components/RegisterSW';

export const metadata = {
  title: 'Heseos Partner — Lighting Ahead',
  manifest: '/partner.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Heseos Partner' },
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

export default function PartnerLayout({ children }) {
  return (
    <>
      <RegisterSW />
      {children}
    </>
  );
}
