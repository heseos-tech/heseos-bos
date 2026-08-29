import '../partner/partner-app.css';
import RegisterSW from '@/components/RegisterSW';

// Additional, separate mobile app for employees (pre-sales & sales engineers) — lives
// alongside the existing desktop /employee dashboards (PresalesPanel/SalesEngineerPanel),
// does NOT replace them. Reuses the exact Partner-app stylesheet (same .hp-* design system)
// so it looks and feels identical, per "employee app similar in looks and UI like partner app".

export const metadata = {
  title: 'Heseos Team — On The Go',
  manifest: '/team.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Heseos Team' },
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

export default function TeamLayout({ children }) {
  return (
    <>
      <RegisterSW />
      {children}
    </>
  );
}
