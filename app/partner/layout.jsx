import RegisterSW from '@/components/RegisterSW';

export const metadata = {
  title: 'Heseos Partner',
  manifest: '/partner.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Heseos Partner' },
  icons: { apple: '/apple-touch-icon.png' },
};

export const viewport = {
  themeColor: '#D9481E',
};

export default function PartnerLayout({ children }) {
  return (
    <>
      <RegisterSW />
      {children}
    </>
  );
}
