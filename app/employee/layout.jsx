import RegisterSW from '@/components/RegisterSW';
// Pre-sales/Sales Engineer now share the same sidebar+topbar+stat-card visual language as
// Admin (components/employee/ui.jsx's EmployeeShell) — this is the same .adm-* stylesheet
// app/admin/layout.jsx loads for /admin, fully scoped under .adm-* (see that file's own header
// comment) so it can't affect /employee/login or the PWA shell below.
import '../admin/admin.css';

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
