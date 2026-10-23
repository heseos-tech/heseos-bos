'use client';

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { NDA_SECTIONS, NDA_TITLE, NDA_VERSION } from '@/lib/investorNda';

// Step 1: name / mobile + NDA (must be opened and read to the end before the box can be
// ticked). Step 2: 6-digit code sent to their WhatsApp.
export default function InvestorGate() {
  const [step, setStep] = useState('form'); // 'form' | 'otp'
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [ndaRead, setNdaRead] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [ndaOpen, setNdaOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [challenge, setChallenge] = useState(null);
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const post = async (url, payload) => {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  };

  const requestCode = async () => {
    setError('');
    setBusy(true);
    try {
      const { ok, data } = await post('/api/investors/otp', { name, phone, ndaAccepted: agreed, ndaVersion: NDA_VERSION });
      if (!ok) { setError(data.error || 'Something went wrong. Please try again.'); return false; }
      setChallenge(data);
      setCode('');
      setStep('otp');
      setCooldown(30);
      if (window.hsTrack) window.hsTrack('mark', 'Code sent');
      return true;
    } catch {
      setError('Network problem. Please try again.');
      return false;
    } finally { setBusy(false); }
  };

  const submitForm = (e) => { e.preventDefault(); if (!busy) requestCode(); };

  const verify = async (e) => {
    e.preventDefault();
    if (busy || code.length !== 6) return;
    setError('');
    setBusy(true);
    try {
      const { ok, data } = await post('/api/investors/verify', { challengeId: challenge.challengeId, code });
      if (!ok) {
        setError(data.error || 'That code did not work.');
        if (data.expired) setCode('');
        return;
      }
      if (window.hsTrack) window.hsTrack('submitted', { name, phone });
      window.location.reload();
    } catch {
      setError('Network problem. Please try again.');
    } finally { setBusy(false); }
  };

  return (
    <main className="inv-page">
      <Script src="/hs-track.js" data-page="investors" strategy="afterInteractive" />
      <div className="inv-glow" aria-hidden="true" />
      <div className="inv-card">
        <img className="inv-logo" src="/brand/wordmark-white.png" alt="Heseos" />
        <p className="inv-eyebrow">Investment Proposal · Confidential</p>

        {step === 'form' ? (
          <form onSubmit={submitForm} noValidate>
            <h1 className="inv-h1">Request access</h1>
            <p className="inv-sub">This document is shared only with people who agree to our NDA. We’ll send a one-time code to your WhatsApp to confirm it’s you.</p>

            <label className="inv-field">
              <span>Full name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Your full name" required />
            </label>
            <label className="inv-field">
              <span>Mobile number (WhatsApp)</span>
              <div className="inv-phone">
                <i>+91</i>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel-national" placeholder="98765 43210" required />
              </div>
            </label>

            <div className={`inv-nda ${agreed ? 'is-on' : ''}`}>
              <label className={`inv-check ${ndaRead ? '' : 'is-locked'}`}>
                <input
                  type="checkbox"
                  checked={agreed}
                  disabled={!ndaRead}
                  onChange={(e) => setAgreed(e.target.checked)}
                />
                <span>I have read and agree to the <button type="button" className="inv-link" onClick={() => setNdaOpen(true)}>Non-Disclosure Agreement</button>.</span>
              </label>
              {!ndaRead && <p className="inv-hint">Open and read the NDA to the end to tick this box.</p>}
            </div>

            {error && <p className="inv-error" role="alert">{error}</p>}
            <button className="inv-btn" type="submit" disabled={busy || !name.trim() || !phone.trim() || !agreed}>
              {busy ? 'Sending code…' : 'Send me a code'}
            </button>
          </form>
        ) : (
          <form onSubmit={verify}>
            <h1 className="inv-h1">Enter your code</h1>
            <p className="inv-sub">
              We sent a 6-digit code to your WhatsApp ({challenge?.to}).
              {challenge?.devCode ? ` (Dev: ${challenge.devCode})` : ''}
            </p>
            <input
              className="inv-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="••••••"
              aria-label="6-digit code"
              autoFocus
            />
            {error && <p className="inv-error" role="alert">{error}</p>}
            <button className="inv-btn" type="submit" disabled={busy || code.length !== 6}>{busy ? 'Checking…' : 'Open the proposal'}</button>
            <div className="inv-row">
              <button type="button" className="inv-link" disabled={busy || cooldown > 0} onClick={requestCode}>
                {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
              </button>
              <button type="button" className="inv-link" onClick={() => { setStep('form'); setError(''); }}>Change details</button>
            </div>
          </form>
        )}

        <p className="inv-foot">Heseos Technologies Pvt. Ltd. · Pune, India</p>
      </div>

      {ndaOpen && (
        <NdaModal
          alreadyRead={ndaRead}
          onClose={() => setNdaOpen(false)}
          onAgree={() => { setNdaRead(true); setAgreed(true); setNdaOpen(false); }}
        />
      )}
    </main>
  );
}

function NdaModal({ alreadyRead, onClose, onAgree }) {
  const [atEnd, setAtEnd] = useState(alreadyRead);
  const box = useRef(null);

  useEffect(() => {
    const el = box.current;
    if (el && el.scrollHeight - el.clientHeight < 8) setAtEnd(true); // short enough to need no scrolling
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const onScroll = (e) => {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 12) setAtEnd(true);
  };

  return (
    <div className="inv-modal" role="dialog" aria-modal="true" aria-label={NDA_TITLE} onClick={onClose}>
      <div className="inv-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="inv-modal-head">
          <h2>{NDA_TITLE}</h2>
          <button type="button" className="inv-x" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="inv-modal-body" ref={box} onScroll={onScroll}>
          {NDA_SECTIONS.map((s) => (
            <section key={s.title}>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </section>
          ))}
          <p className="inv-modal-ver">Version {NDA_VERSION}</p>
        </div>
        <div className="inv-modal-foot">
          {!atEnd && <span className="inv-hint">Scroll to the end to continue</span>}
          <button type="button" className="inv-btn inv-btn--sm" disabled={!atEnd} onClick={onAgree}>I have read and I agree</button>
        </div>
      </div>
    </div>
  );
}
