'use client';
// Small shared building blocks for the Heseos Bot console — kept separate from
// components/partner/ui.jsx and components/admin/ui.jsx since this is its own product
// (see app/bot/bot-console.css's .bc-* design system).
import { useState } from 'react';
import { IconEye, IconEyeOff } from './icons';

const AVATAR_COLORS = ['#d6336c', '#a3792a', '#7c3aed', '#2563eb', '#16a34a', '#dc2626', '#0d9488', '#c2410c'];

function hashName(name) {
  let h = 0;
  const s = String(name || '?');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function colorFor(name) {
  return AVATAR_COLORS[hashName(name) % AVATAR_COLORS.length];
}

export function Avatar({ name, size = 'sm' }) {
  const initial = String(name || '?').trim().charAt(0).toUpperCase() || '?';
  const cls = size === 'lg' ? 'bc-avatar bc-avatar-lg' : 'bc-avatar bc-avatar-sm';
  return <div className={cls} style={{ background: colorFor(name) }}>{initial}</div>;
}

// Short "10:32 am" — used inside a chat thread where the date is already implied by context;
// fmtDate/fmtDateTime (lib/date.js) cover the full dd-mm-yyyy / date+time cases elsewhere.
export function fmtTime(v) {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
}

export function Button({ variant = 'primary', block, sm, className = '', children, ...props }) {
  const cls = ['bc-btn', variant === 'primary' && 'bc-btn-primary', variant === 'accent' && 'bc-btn-accent', variant === 'outline' && 'bc-btn-outline', block && 'bc-btn-block', sm && 'bc-btn-sm', className].filter(Boolean).join(' ');
  return <button className={cls} {...props}>{children}</button>;
}

export function TextField({ label, icon, type = 'text', showToggle, className = '', ...props }) {
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (show ? 'text' : 'password') : type;
  return (
    <div className={`bc-field ${className}`}>
      {label && <label>{label}</label>}
      <div className={icon || isPassword ? 'bc-input-icon-wrap' : ''}>
        {icon}
        <input className="bc-input" type={inputType} {...props} />
        {isPassword && (
          <button type="button" className="bc-input-eye" onClick={() => setShow((s) => !s)} tabIndex={-1} aria-label="Toggle password visibility">
            {show ? <IconEyeOff size={17} /> : <IconEye size={17} />}
          </button>
        )}
      </div>
    </div>
  );
}

export function Select({ label, children, className = '', ...props }) {
  return (
    <div className={`bc-field ${className}`}>
      {label && <label>{label}</label>}
      <select className="bc-select" {...props}>{children}</select>
    </div>
  );
}

export function Switch({ checked, onChange, label }) {
  return (
    <label className="bc-switch" aria-label={label}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="bc-switch-track" />
      <span className="bc-switch-thumb" />
    </label>
  );
}

export function Badge({ tone = 'gray', children }) {
  return <span className={`bc-badge bc-badge-${tone}`}>{children}</span>;
}
