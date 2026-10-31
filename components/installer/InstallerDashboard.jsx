'use client';
// Installer app -> Home: today's picture at a glance, and the same refer-and-earn shortcuts partners get.
// Layout follows the Heseos Installer home design (hero → 4 stat cards → jobs banner → Refer & Earn →
// Training → Punch New Lead). Every number comes from the existing jobs API; every link goes to the
// existing screens. Styles are the installer-only `ih-*` classes at the end of app/partner/partner-app.css.
import Link from 'next/link';
import { Avatar } from '@/components/partner/ui';
import { IconBell, IconLeads, IconPlus, IconQrCode, IconLink, IconMapPin, IconCalendar, IconPlay, IconWallet, IconCheckCircle } from '@/components/partner/icons';
import { IconOrders, IconChevronRight } from '@/components/admin/icons';
import { useJobs, fmtDate, dueTag } from './jobUtils';

// ₹1,000 as-is; from ₹1,00,000 up it goes compact (₹1.2L / ₹1.5Cr) so the number always fits its card.
function shortMoney(n) {
  const v = Math.round(Number(n) || 0);
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(v >= 100000000 ? 0 : 1).replace(/\.0$/, '')}Cr`;
  if (v >= 100000) return `₹${(v / 100000).toFixed(v >= 10000000 ? 0 : 1).replace(/\.0$/, '')}L`;
  return `₹${v.toLocaleString('en-IN')}`;
}
const valSize = (t) => (String(t).length >= 7 ? ' ih-val--xs' : String(t).length >= 6 ? ' ih-val--sm' : '');

function StatCard({ tone, href, Icon, value, label }) {
  const text = String(value);
  return (
    <Link href={href} className={`ih-stat ih-stat--${tone}`} aria-label={`${label}: ${text}`}>
      <span className="ih-stat-icon"><Icon size={19} /></span>
      <span className={`ih-stat-val${valSize(text)}`}>{text}</span>
      <span className="ih-stat-label">{label}</span>
      <span className="ih-stat-go" aria-hidden="true"><IconChevronRight size={14} /></span>
    </Link>
  );
}

function SectionHead({ title, href }) {
  return (
    <div className="ih-section-head">
      <h2 className="ih-section-title">{title}</h2>
      {href && <Link href={href} className="ih-view-all">View All</Link>}
    </div>
  );
}

function ActionCard({ href, Icon, title, sub }) {
  return (
    <Link href={href} className="ih-action">
      <span className="ih-icon-box"><Icon size={22} /></span>
      <span className="ih-action-text">
        <span className="ih-action-title">{title}</span>
        <span className="ih-action-sub">{sub}</span>
      </span>
      <IconChevronRight size={18} style={{ color: 'var(--hp-text-soft)', flexShrink: 0 }} />
    </Link>
  );
}

// Decorative map + listing-card artwork for the jobs banner (no data in it).
function JobsArt() {
  return (
    <svg className="ih-banner-art" viewBox="0 0 170 96" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="ihCard" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#24415f" /><stop offset="1" stopColor="#14283f" /></linearGradient>
        <radialGradient id="ihGlow" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#ff7a00" stopOpacity="0.55" /><stop offset="1" stopColor="#ff7a00" stopOpacity="0" /></radialGradient>
      </defs>
      <g stroke="#2a4663" strokeWidth="1" opacity="0.7" fill="none">
        <path d="M70 0 L110 96" /><path d="M110 0 L150 96" /><path d="M40 20 L170 40" /><path d="M30 62 L170 78" /><path d="M0 40 L170 20" opacity="0.5" />
      </g>
      <ellipse cx="124" cy="70" rx="26" ry="9" fill="url(#ihGlow)" />
      <g transform="translate(6 24) rotate(-8)">
        <rect width="74" height="50" rx="7" fill="url(#ihCard)" stroke="#38597a" strokeWidth="1" />
        <rect x="9" y="9" width="20" height="20" rx="5" fill="#ff7a00" />
        <path d="M13.5 20.5 19 15.5l5.5 5v6.5h-11z" fill="#fff" />
        <rect x="36" y="11" width="28" height="4" rx="2" fill="#5f7d9b" />
        <rect x="36" y="20" width="22" height="4" rx="2" fill="#41607f" />
        <rect x="9" y="36" width="54" height="4" rx="2" fill="#41607f" />
      </g>
      <path d="M124 74c-9-12-15-19-15-28a15 15 0 1 1 30 0c0 9-6 16-15 28z" fill="#ff7a00" />
      <circle cx="124" cy="46" r="6" fill="#0e2136" />
    </svg>
  );
}

export default function InstallerDashboard({ partner }) {
  const { available, mine } = useJobs();
  const active = mine.filter((j) => !j.done);
  const done = mine.filter((j) => j.done);
  const earned = done.reduce((n, j) => n + (Number(j.fee) || 0), 0);
  const next = active.slice().sort((a, b) => (a.installDate < b.installDate ? -1 : 1))[0];
  const firstName = (partner.name || 'there').split(' ')[0];
  const noCity = !String(partner.city || '').trim();
  return (
    <>
      <section className="ih-hero">
        <div className="ih-hero-art" aria-hidden="true"><img src="/smart-home/villa.jpg" alt="" /></div>
        <div className="ih-hero-glow" aria-hidden="true" />
        <div className="ih-hero-body">
          <div className="hp-topbar" style={{ padding: 'calc(18px + env(safe-area-inset-top, 0px)) 0 4px' }}>
            <img src="/brand/lockup-white.png" alt="Heseos — Lighting Ahead" className="hp-brand-logo hp-brand-logo-sm" style={{ height: 30 }} />
            <div className="hp-topbar-right">
              <button className="hp-bell" aria-label="Notifications" style={{ width: 42, height: 42 }}><IconBell size={19} /></button>
              <Link href="/installer/home?tab=profile" aria-label="Profile"><Avatar name={partner.name} /></Link>
            </div>
          </div>
          <h1 className="ih-greet">Hi, {firstName}! <span aria-hidden="true">👋</span></h1>
          <p className="ih-greet-sub">Let&rsquo;s build smarter spaces together.</p>
          <div className="ih-coverage">
            <span className="ih-coverage-pin"><IconMapPin size={15} /></span>
            <span className="ih-coverage-text">
              <span className="ih-coverage-label">Coverage</span>
              <span className="ih-coverage-city">{partner.city || 'Not set'}</span>
            </span>
          </div>
        </div>
      </section>

      {noCity && (
        <div className="ops-banner"><IconMapPin size={16} /><span>Your profile has no city yet — ask Heseos to set it so jobs in your city show up.</span></div>
      )}

      <div className="ih-stats">
        <StatCard tone="orange" href="/installer/home?tab=jobs" Icon={IconOrders} value={available.length} label="Available Jobs" />
        <StatCard tone="blue" href="/installer/home?tab=jobs" Icon={IconCalendar} value={active.length} label="My Active Jobs" />
        <StatCard tone="green" href="/installer/home?tab=earnings" Icon={IconCheckCircle} value={done.length} label="Completed" />
        <StatCard tone="purple" href="/installer/home?tab=earnings" Icon={IconWallet} value={shortMoney(earned)} label="Fees Earned" />
      </div>

      {next && (
        <Link href="/installer/home?tab=jobs" className="ih-next">
          <div className="ops-id">NEXT INSTALLATION</div>
          <div className="ops-name">{next.customerName || next.ref}</div>
          <div className={`ops-install ${dueTag(next.installDate)}`} style={{ marginTop: 8 }}>
            <IconCalendar size={14} /><span>{fmtDate(next.installDate)}{next.installSlot ? ` · ${next.installSlot}` : ''}</span>
          </div>
          <div className="ops-line">{next.address}</div>
        </Link>
      )}

      <Link href="/installer/home?tab=jobs" className="ih-banner">
        <span className="ih-icon-box ih-icon-box--lg"><IconOrders size={26} /></span>
        <span className="ih-banner-text">
          <span className="ih-banner-title">{available.length ? `${available.length} job${available.length === 1 ? '' : 's'} available in your city` : 'Find installation jobs'}</span>
          <span className="ih-banner-sub">Claim a job — first come, first served</span>
        </span>
        <JobsArt />
        <span className="ih-banner-go" aria-hidden="true"><IconChevronRight size={20} /></span>
      </Link>

      <SectionHead title="Refer & Earn" href="/installer/home?tab=referrals" />
      <ActionCard href="/installer/refer" Icon={IconLink} title="Your referral link" sub="Share it — earn when a lead converts" />
      <ActionCard href="/installer/qr" Icon={IconQrCode} title="Your QR code" sub="Customers scan it to contact you" />
      <ActionCard href="/installer/home?tab=leads" Icon={IconLeads} title="My referred leads" sub="Track the leads you've sent in" />

      <SectionHead title="Training" href="/installer/training" />
      <Link href="/installer/training" className="ih-action ih-train">
        <span className="ih-train-thumb">
          <img src="/smart-home/panels.jpg" alt="" loading="lazy" />
          <span className="ih-train-play"><IconPlay size={22} /></span>
        </span>
        <span className="ih-action-text">
          <span className="ih-action-title">Training videos</span>
          <span className="ih-action-sub">Install &amp; set up Touch Panel, Smart Plug, IR Blaster, Door Lock</span>
        </span>
        <IconChevronRight size={18} style={{ color: 'var(--hp-text-soft)', flexShrink: 0 }} />
      </Link>

      <div className="ih-cta">
        <Link href="/installer/leads/new" className="ih-cta-btn"><IconPlus size={20} /> Punch New Lead</Link>
      </div>
    </>
  );
}
