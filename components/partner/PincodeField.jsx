'use client';
// Pincode input for the Partner + Installer apps (sign-up and My Profile). The city and state are
// never typed — they come from the pincode (/api/shop/pincode, the same India Post lookup the order
// form uses), so every partner's city is a real, consistently spelt one. The server looks the pincode
// up again on save and ignores any city the client sends (see app/api/auth/partner/register and
// app/api/partner/profile).
import { useEffect, useState } from 'react';
import { TextField } from './ui';
import { IconMapPin } from './icons';

// -> { status: 'idle' | 'loading' | 'ok' | 'error', city, state, message }
export function usePincodeLookup(pincode) {
  const [res, setRes] = useState({ status: 'idle', city: '', state: '', message: '' });
  useEffect(() => {
    const pin = String(pincode || '');
    if (!/^\d{6}$/.test(pin)) { setRes({ status: 'idle', city: '', state: '', message: '' }); return undefined; }
    let alive = true;
    setRes({ status: 'loading', city: '', state: '', message: '' });
    fetch(`/api/shop/pincode?pin=${pin}`)
      .then((r) => r.json().catch(() => ({})))
      .then((d) => {
        if (!alive) return;
        if (d && d.city) setRes({ status: 'ok', city: d.city, state: d.state || '', message: '' });
        else setRes({ status: 'error', city: '', state: '', message: 'We couldn’t find a city for this pincode. Please check it and try again.' });
      })
      .catch(() => { if (alive) setRes({ status: 'error', city: '', state: '', message: 'Couldn’t check the pincode right now. Please try again.' }); });
    return () => { alive = false; };
  }, [pincode]);
  return res;
}

export default function PincodeField({ value, onChange, lookup, label, placeholder = 'Pincode of your area (6 digits)' }) {
  return (
    <>
      <TextField
        label={label}
        icon={<IconMapPin size={18} />}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        inputMode="numeric"
        autoComplete="postal-code"
        maxLength={6}
        placeholder={placeholder}
        required
      />
      {lookup.status === 'loading' && <div className="hp-hint">Checking pincode…</div>}
      {lookup.status === 'ok' && (
        <div className="hp-hint" style={{ color: 'var(--hp-success)', fontWeight: 600 }}>
          {[lookup.city, lookup.state].filter(Boolean).join(', ')}
        </div>
      )}
      {lookup.status === 'error' && <div className="hp-error">{lookup.message}</div>}
    </>
  );
}
