'use client';
// Installer app -> Home: today's picture at a glance, and the same refer-and-earn shortcuts partners get.
import Link from 'next/link';
import { Avatar } from '@/components/partner/ui';
import { IconBell, IconLeads, IconPlus, IconQrCode, IconLink, IconMapPin, IconCalendar, IconPlay } from '@/components/partner/icons';
import { IconOrders, IconChevronRight } from '@/components/admin/icons';
import { useJobs, money, fmtDate, dueTag } from './jobUtils';

function ShortcutCard({ href, Icon, title, sub }) {
  return (
    <Link href={href} className="hp-card" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
      <div className="hp-stat-icon" style={{ width: 38, height: 38, flexShrink: 0, margin: 0 }}><Icon size={19} /></div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--hp-text-soft)' }}>{sub}</div>
      </div>
      <IconChevronRight size={18} style={{ color: 'var(--hp-text-faint)', flexShrink: 0 }} />
    </Link>
  );
}

export default function InstallerDashboard({ partner }) {
  const { available, mine } = useJobs();
  const active = mine.filter((j) => !j.done);
  const done = mine.filter((j) => j.done);
  const earned = done.reduce((n, j) => n + (Number(j.fee) || 0), 0);
  const next = active.slice().sort((a, b) => (a.installDate < b.installDate ? -1 : 1))[0];
  const firstName = (partner.name || 'there').split(' ')[0];
  const stats = [
    { label: 'Available Jobs', val: available.length, icon: IconOrders, href: '/installer/home?tab=jobs' },
    { label: 'My Active Jobs', val: active.length, icon: IconCalendar, href: '/installer/home?tab=jobs' },
    { label: 'Completed', val: done.length, icon: IconLeads, href: '/installer/home?tab=earnings' },
    { label: 'Fees Earned', val: money(earned), icon: IconPlus, href: '/installer/home?tab=earnings' },
  ];
  return (
    <>
      <div className="hp-topbar">
        <img src="/brand/lockup-white.png" alt="Heseos — Lighting Ahead" className="hp-brand-logo hp-brand-logo-sm" />
        <div className="hp-topbar-right">
          <button className="hp-bell" aria-label="Notifications"><IconBell size={18} /></button>
          <Link href="/installer/home?tab=profile"><Avatar name={partner.name} /></Link>
        </div>
      </div>

      <div className="hp-greet-row">
        <div>
          <div className="hp-greet-title">Hi, {firstName}! 👋</div>
          <div className="hp-greet-sub">Here&rsquo;s your installation overview</div>
        </div>
        <div className="hp-wallet-chip">
          <div>
            <div className="hp-wallet-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><IconMapPin size={11} /> Coverage</div>
            <div className="hp-wallet-val" style={{ fontSize: 13 }}>{partner.city || 'Not set'}</div>
          </div>
        </div>
      </div>

      {!String(partner.city || '').trim() && (
        <div className="ops-banner"><IconMapPin size={16} /><span>Your profile has no city yet — ask Heseos to set it so jobs in your city show up.</span></div>
      )}

      <div className="hp-stat-grid">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Link href={s.href} className="hp-stat-card" key={s.label}>
              <div className="hp-stat-icon"><Icon size={16} /></div>
              <div className="hp-stat-val">{s.val}</div>
              <div className="hp-stat-label">{s.label}</div>
            </Link>
          );
        })}
      </div>

      {next ? (
        <Link href="/installer/home?tab=jobs" className="hp-card" style={{ display: 'block', textDecoration: 'none', border: '1px solid var(--hp-orange)' }}>
          <div className="ops-id">NEXT INSTALLATION</div>
          <div className="ops-name">{next.customerName || next.ref}</div>
          <div className={`ops-install ${dueTag(next.installDate)}`} style={{ marginTop: 8 }}>
            <IconCalendar size={14} /><span>{fmtDate(next.installDate)}{next.installSlot ? ` · ${next.installSlot}` : ''}</span>
          </div>
          <div className="ops-line">{next.address}</div>
        </Link>
      ) : (
        <ShortcutCard href="/installer/home?tab=jobs" Icon={IconOrders} title={available.length ? `${available.length} job${available.length === 1 ? '' : 's'} available in your city` : 'Find installation jobs'} sub="Claim a job — first come, first served" />
      )}

      <div className="hp-section-head" style={{ marginTop: 0 }}><div className="hp-section-title">Refer &amp; Earn</div></div>
      <ShortcutCard href="/installer/refer" Icon={IconLink} title="Your referral link" sub="Share it — earn when a lead you send converts" />
      <ShortcutCard href="/installer/qr" Icon={IconQrCode} title="Your QR code" sub="Customers scan it to enquire through you" />
      <ShortcutCard href="/installer/home?tab=leads" Icon={IconLeads} title="My referred leads" sub="Track the leads you've sent in" />

      <div className="hp-section-head" style={{ marginTop: 0 }}><div className="hp-section-title">Training</div></div>
      <ShortcutCard href="/installer/training" Icon={IconPlay} title="Training videos" sub="Install & set up Touch Panel, Smart Plug, IR Blaster, Door Lock" />

      <div className="hp-cta-block" style={{ paddingBottom: 24 }}>
        <Link href="/installer/leads/new" className="hp-btn hp-btn-primary hp-btn-block"><IconPlus size={18} /> Punch New Lead</Link>
      </div>
    </>
  );
}
