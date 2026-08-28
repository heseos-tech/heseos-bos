import RegisterSW from '@/components/RegisterSW';

export const metadata = {
  title: 'Heseos Team',
  manifest: '/employee.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Heseos Team' },
  icons: { apple: '/apple-touch-icon.png' },
};

export const viewport = {
  themeColor: '#D9481E',
};

export default function EmployeeLayout({ children }) {
  return (
    <>
      <RegisterSW />
      {children}
    </>
  );
}
