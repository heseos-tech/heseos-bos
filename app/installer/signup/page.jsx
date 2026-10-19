'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, TextField, Checkbox } from '@/components/partner/ui';
import { IconUserPlus, IconPhone, IconLock, IconMapPin } from '@/components/partner/icons';

// Installer app self sign-up — an installation partner creates their own account (no Heseos staff
// step). Uses the same endpoint as the Partner app's sign-up with `type: 'installer'`; the city
// (or cities) entered here decides which installation jobs they can see and claim.
export default function InstallerSignupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [password, setPassword] = useState('');
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!city.trim()) { setError('Please enter the city you work in.'); return; }
    if (!agree) { setError('Please agree to the Terms & Conditions to continue.'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/partner/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, password, city, type: 'installer' }),
      });
      const raw = await res.text();
      let data = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch { /* non-JSON error body */ }
      if (!res.ok) throw new Error(data.error || `Could not create your account (${res.status})`);
      // The API signs the new installer in; if session signing failed it asks them to log in.
      router.push(data.partner ? '/installer/home' : '/installer/login');
      router.refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="hp-root">
      <div className="hp-hero">
        <div className="hp-hero-bg" style={{ backgroundImage: "url('/Signup-Screen.webp')" }} />
        <div className="hp-hero-scrim-full" />
        <div className="hp-hero-content" style={{ justifyContent: 'space-between', paddingBottom: 18 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>Sign Up</div>

          <div>
            <h1 className="hp-h2">Become a Heseos <span className="hp-accent-text">Installer</span></h1>
            <p className="hp-sub" style={{ marginBottom: 20 }}>Create your account, then claim installation jobs in your city.</p>

            <form onSubmit={submit}>
              <TextField icon={<IconUserPlus size={18} />} placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} required />
              <TextField icon={<IconPhone size={18} />} placeholder="Mobile Number" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="numeric" required />
              <TextField icon={<IconMapPin size={18} />} placeholder="City you work in (e.g. Pune, Mumbai)" value={city} onChange={(e) => setCity(e.target.value)} required />
              <TextField icon={<IconLock size={18} />} type="password" placeholder="Create Password" value={password} onChange={(e) => setPassword(e.target.value)} required />

              <Checkbox checked={agree} onChange={() => setAgree((a) => !a)}>
                I agree to the <span className="hp-link-accent">Terms &amp; Conditions</span> and <span className="hp-link-accent">Privacy Policy</span>
              </Checkbox>

              {error && <div className="hp-error">{error}</div>}

              <Button type="submit" block disabled={loading}>{loading ? 'Creating Account…' : 'Create Account'}</Button>
            </form>

            <p className="hp-footnote">Already have an account? <Link href="/installer/login" className="hp-link-accent">Login</Link></p>
          </div>
        </div>
      </div>
    </div>
  );
}
