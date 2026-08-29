'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  IconEye, IconEyeOff, IconChevronDown, IconArrowLeft, IconHome, IconLeads, IconPlus, IconGift, IconUser, IconCheck,
} from './icons';

// ── Buttons ──────────────────────────────────────────────────────────────
export function Button({ variant = 'primary', block, sm, className = '', children, ...props }) {
  const cls = ['hp-btn', variant === 'primary' && 'hp-btn-primary', variant === 'outline' && 'hp-btn-outline', variant === 'ghost' && 'hp-btn-ghost', block && 'hp-btn-block', sm && 'hp-btn-sm', className].filter(Boolean).join(' ');
  return <button className={cls} {...props}>{children}</button>;
}

// ── Text / password input with a leading icon ──────────────────────────────
export function TextField({ label, icon, type = 'text', showToggle, ...props }) {
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (show ? 'text' : 'password') : type;
  return (
    <div className="hp-field">
      {label && <label className="hp-field-label">{label}</label>}
      <div className="hp-input-wrap">
        {icon && <span className="hp-input-icon">{icon}</span>}
        <input className="hp-input" type={inputType} {...props} />
        {isPassword && (
          <button type="button" className="hp-eye-btn" onClick={() => setShow((s) => !s)} tabIndex={-1} aria-label="Toggle password visibility">
            {show ? <IconEyeOff size={18} /> : <IconEye size={18} />}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Styled native select (keeps real accessibility/behaviour) ─────────────
export function SelectField({ label, icon, value, onChange, options, placeholder = 'Select an option', ...props }) {
  return (
    <div className="hp-field">
      {label && <label className="hp-field-label">{label}</label>}
      <div className="hp-select-wrap">
        {icon && <span className="hp-select-icon-l">{icon}</span>}
        <select className={`hp-select${!value ? ' hp-placeholder' : ''}`} value={value} onChange={onChange} {...props}>
          <option value="" disabled>{placeholder}</option>
          {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
        <span className="hp-select-icon-r"><IconChevronDown size={16} /></span>
      </div>
    </div>
  );
}

export function TextareaField({ label, icon, ...props }) {
  return (
    <div className="hp-field">
      {label && <label className="hp-field-label">{label}</label>}
      <div className="hp-textarea-wrap">
        {icon && <span className="hp-input-icon" style={{ width: 20, marginTop: 1 }}>{icon}</span>}
        <textarea className="hp-textarea" {...props} />
      </div>
    </div>
  );
}

export function Checkbox({ checked, onChange, children }) {
  return (
    <div className="hp-check-row" onClick={onChange} style={{ cursor: 'pointer' }}>
      <span className={`hp-checkbox${checked ? ' checked' : ''}`}>{checked && <IconCheck size={12} color="#fff" />}</span>
      <span className="hp-check-label">{children}</span>
    </div>
  );
}

// ── Status badge — maps a canonical status key to label + colour class ────
const STATUS_MAP = {
  new: { label: 'New', cls: 'hp-badge-new' },
  progress: { label: 'In Progress', cls: 'hp-badge-progress' },
  followup: { label: 'Follow Up', cls: 'hp-badge-followup' },
  converted: { label: 'Converted', cls: 'hp-badge-converted' },
  rejected: { label: 'Rejected', cls: 'hp-badge-rejected' },
};
export function StatusBadge({ status }) {
  const s = STATUS_MAP[status] || STATUS_MAP.new;
  return <span className={`hp-badge ${s.cls}`}><span className="hp-badge-dot" />{s.label}</span>;
}
export { STATUS_MAP };

// ── Avatar (photo not available → initials) ────────────────────────────────
export function Avatar({ name = '', size = 'sm' }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'H';
  const cls = size === 'lg' ? 'hp-avatar hp-avatar-lg' : 'hp-avatar hp-avatar-sm';
  return <div className={cls}>{initials}</div>;
}

// ── Wizard step indicator ───────────────────────────────────────────────────
export function ProgressSteps({ step, total = 3 }) {
  return (
    <div className="hp-steps">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
          <div className={`hp-step-dot${i < step ? ' done' : ''}${i === step ? ' active' : ''}`}>{i + 1}</div>
          {i < total - 1 && <div className={`hp-step-line${i < step ? ' done' : ''}`} />}
        </div>
      ))}
    </div>
  );
}

// ── Inner-screen header: back arrow + title ─────────────────────────────────
export function ScreenHeader({ title, onBack, backHref }) {
  const router = useRouter();
  return (
    <div className="hp-header">
      {backHref ? (
        <Link href={backHref} className="hp-back-btn"><IconArrowLeft size={18} /></Link>
      ) : (
        <button className="hp-back-btn" onClick={onBack || (() => router.back())}><IconArrowLeft size={18} /></button>
      )}
      <div className="hp-header-title">{title}</div>
    </div>
  );
}

export function SectionHead({ title, viewAllHref }) {
  return (
    <div className="hp-section-head">
      <div className="hp-section-title">{title}</div>
      {viewAllHref && <Link className="hp-view-all" href={viewAllHref}>View All</Link>}
    </div>
  );
}

// ── Bottom navigation — consistent across all authenticated tab screens ───
const NAV_ITEMS = [
  { href: '/partner/home', label: 'Home', icon: IconHome },
  { href: '/partner/leads', label: 'Leads', icon: IconLeads },
  { href: '/partner/leads/new', label: 'Add Lead', icon: IconPlus, center: true },
  { href: '/partner/rewards', label: 'Rewards', icon: IconGift },
  { href: '/partner/profile', label: 'Profile', icon: IconUser },
];
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="hp-bottom-nav">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = item.center ? false : pathname === item.href || (item.href === '/partner/leads' && pathname.startsWith('/partner/leads') && !pathname.includes('/new'));
        if (item.center) {
          return (
            <Link key={item.href} href={item.href} className="hp-nav-center">
              <span className="hp-nav-center-btn"><Icon size={22} /></span>
              <span className="hp-nav-center-label">{item.label}</span>
            </Link>
          );
        }
        return (
          <Link key={item.href} href={item.href} className={`hp-nav-item${active ? ' active' : ''}`}>
            <Icon size={21} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }) {
  return (
    <div className="hp-shell">
      <div className="hp-shell-scroll">{children}</div>
      <BottomNav />
    </div>
  );
}
