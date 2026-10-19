import InstallerHome from '@/components/installer/InstallerHome';

// The single Installer-app route — Home, Jobs, Earnings and Profile (plus My Leads / Referral
// Rewards) all render inside InstallerHome, switched by ?tab=.
export default function InstallerHomePage() {
  return <InstallerHome />;
}
