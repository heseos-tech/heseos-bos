'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Avatar, useAppBase } from './ui';
import { IconUser, IconBank, IconHistory, IconHelp, IconFile, IconShield, IconLogout, IconChevronRight, IconLink, IconQrCode } from './icons';

const menuFor = (base) => [
  { icon: IconUser, label: 'My Profile', href: `${base}/my-profile` },
  { icon: IconQrCode, label: 'QR Code', href: `${base}/qr` },
  { icon: IconLink, label: 'Referral Link', href: `${base}/refer` },
  { icon: IconBank, label: 'Bank Details', href: `${base}/bank-details` },
  { icon: IconHistory, label: 'Payout History', href: `${base}/payouts` },
  { icon: IconShield, label: 'How It Works', href: `${base}/how-it-works` },
  { icon: IconHelp, label: 'Help & Support', href: `${base}/help` },
  { icon: IconFile, label: 'Terms & Conditions', href: `${base}/terms` },
];

export default function ProfileScreen({ partner }) {
  const base = useAppBase();
  const MENU = menuFor(base);
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    await fetch('/api/auth/partner', { method: 'DELETE' });
    router.push(`${base}/login`);
    router.refresh();
  }

  return (
    <>
      <div className="hp-header" style={{ paddingBottom: 4 }}>
        <div className="hp-header-title" style={{ fontSize: 21, fontWeight: 800 }}>Profile</div>
      </div>

      <div className="hp-profile-head">
        <Avatar name={partner.name} size="lg" />
        <div className="hp-profile-name">{partner.businessName || partner.name}</div>
        <div className="hp-profile-role">HESEOS Partner</div>
        <div className="hp-profile-id">Partner ID: {partner.id}</div>
      </div>

      <div className="hp-menu-list">
        {MENU.map((m) => {
          const Icon = m.icon;
          return (
            <Link key={m.label} href={m.href} className="hp-menu-item">
              <span className="hp-menu-icon"><Icon size={17} /></span>
              <span className="hp-menu-label">{m.label}</span>
              <IconChevronRight size={16} style={{ color: 'var(--hp-text-faint)' }} />
            </Link>
          );
        })}
      </div>

      <div className="hp-menu-list">
        <button className="hp-menu-item danger" onClick={logout} disabled={loggingOut}>
          <span className="hp-menu-icon"><IconLogout size={17} /></span>
          <span className="hp-menu-label">{loggingOut ? 'Logging out…' : 'Logout'}</span>
        </button>
      </div>

    </>
  );
}
