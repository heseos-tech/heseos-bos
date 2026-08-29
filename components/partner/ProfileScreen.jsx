'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar } from './ui';
import { IconUser, IconBank, IconHistory, IconHelp, IconFile, IconShield, IconLogout, IconChevronRight } from './icons';

const MENU = [
  { icon: IconUser, label: 'My Profile' },
  { icon: IconBank, label: 'Bank Details' },
  { icon: IconHistory, label: 'Payout History' },
  { icon: IconShield, label: 'How It Works' },
  { icon: IconHelp, label: 'Help & Support' },
  { icon: IconFile, label: 'Terms & Conditions' },
];

export default function ProfileScreen({ partner }) {
  const router = useRouter();
  const [toast, setToast] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    await fetch('/api/auth/partner', { method: 'DELETE' });
    router.push('/partner/login');
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
            <button key={m.label} className="hp-menu-item" onClick={() => { setToast(`${m.label} coming soon`); setTimeout(() => setToast(''), 2000); }}>
              <span className="hp-menu-icon"><Icon size={17} /></span>
              <span className="hp-menu-label">{m.label}</span>
              <IconChevronRight size={16} style={{ color: 'var(--hp-text-faint)' }} />
            </button>
          );
        })}
      </div>

      <div className="hp-menu-list">
        <button className="hp-menu-item danger" onClick={logout} disabled={loggingOut}>
          <span className="hp-menu-icon"><IconLogout size={17} /></span>
          <span className="hp-menu-label">{loggingOut ? 'Logging out…' : 'Logout'}</span>
        </button>
      </div>

      {toast && <div className="hp-toast">{toast}</div>}
    </>
  );
}
