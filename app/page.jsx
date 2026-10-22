import InternalNav from '@/components/bos/InternalNav';
import Hero from '@/components/Hero';
import SystemFlow from '@/components/bos/SystemFlow';
import SignIn from '@/components/bos/SignIn';
import RolesGrid from '@/components/bos/RolesGrid';
import InternalFooter from '@/components/bos/InternalFooter';

// bos.heseos.com — the front door of Heseos's own internal system. It explains what BOS is to the team and
// points each group (staff, Team app, partners, installers, bot console) at its own sign-in. Not a product
// page, so it also asks search engines not to list it.
export const metadata = {
  title: 'HESEOS BOS — Internal Business Operating System',
  description: 'Heseos’s internal operating system for leads, demos, orders, installations and payouts. Sign in for staff, partners and installers.',
  robots: { index: false, follow: false },
  openGraph: { title: 'HESEOS BOS', description: 'Heseos’s internal operating system.', type: 'website', siteName: 'Heseos' },
};

export default function HomePage() {
  return (
    <>
      <InternalNav />
      <Hero />
      <SystemFlow />
      <SignIn />
      <RolesGrid />
      <InternalFooter />
    </>
  );
}
