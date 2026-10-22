// components/bos/SignIn.jsx
// "Where do I sign in?" — one card per kind of user, each pointing at that group's own login.

import { IconMonitor, IconPhoneApp, IconRolePartners, IconRoleInstaller, IconChat, IconArrowRight } from './icons';

const WAYS = [
  {
    title: 'Staff — desktop',
    who: 'Admin, Pre-sales, Sales Engineers, Operations, Accounts',
    note: 'The full panels: leads, orders, reports, payouts.',
    href: '/employee/login', cta: 'Staff sign in', Icon: IconMonitor, tone: 'navy',
  },
  {
    title: 'Team app — phone',
    who: 'Staff on the move',
    note: 'Quick view of leads, orders, catalogue and referrals.',
    href: '/team/login', cta: 'Open Team app', Icon: IconPhoneApp, tone: 'orange',
  },
  {
    title: 'Partners',
    who: 'Shops, electricians, designers, builders',
    note: 'Add leads, track status, see earnings.',
    href: '/partner/login', cta: 'Partner sign in', Icon: IconRolePartners, tone: 'orange',
    alt: { label: 'New partner? Join', href: '/become-a-partner' },
  },
  {
    title: 'Installers',
    who: 'Verified installation partners',
    note: 'Claim installation jobs and mark them done.',
    href: '/installer/login', cta: 'Installer sign in', Icon: IconRoleInstaller, tone: 'blue',
    alt: { label: 'Create an account', href: '/installer/signup' },
  },
  {
    title: 'Heseos Bot console',
    who: 'Whoever handles WhatsApp',
    note: 'The shared inbox, bot flows and message templates.',
    href: '/bot', cta: 'Open bot console', Icon: IconChat, tone: 'purple',
  },
];

export default function SignIn() {
  return (
    <section className="bos-signin" id="signin">
      <div className="container">
        <div className="bos-section-head bos-section-head--center">
          <div className="bos-eyebrow bos-eyebrow--center">Sign in</div>
          <h2 className="bos-h2">Pick the door that matches your role</h2>
          <p className="bos-section-sub">Each group has its own login and its own view of BOS.</p>
        </div>

        <div className="bos-signin-grid">
          {WAYS.map((w) => (
            <div className="bos-signin-card" key={w.title}>
              <span className={`bos-signin-icon bos-signin-icon--${w.tone}`}><w.Icon size={20} /></span>
              <div className="bos-signin-title">{w.title}</div>
              <div className="bos-signin-who">{w.who}</div>
              <div className="bos-signin-note">{w.note}</div>
              <div className="bos-signin-actions">
                <a href={w.href} className="bos-btn-primary bos-btn-sm">{w.cta}<IconArrowRight size={14} /></a>
                {w.alt && <a href={w.alt.href} className="bos-signin-alt">{w.alt.label}</a>}
              </div>
            </div>
          ))}
        </div>

        <p className="bos-signin-help">
          Need access? Staff logins are created by an Admin (Admin → Employees). Partners and installers can use the links on their cards, or ask their Heseos contact.
        </p>
      </div>
    </section>
  );
}
