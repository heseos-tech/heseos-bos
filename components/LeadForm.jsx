'use client';
import { useState } from 'react';
import { PRODUCT_INTEREST, PROPERTY_TYPE, TIMELINE, PERSONA_TYPE, budgetOptionsFor } from '@/lib/formOptions';

const STEPS = ['interest', 'property', 'budget', 'timeline', 'persona', 'contact'];

const emptyForm = {
  productInterest: [],
  propertyType: '',
  budget: '',
  timeline: '',
  persona: '',
  name: '',
  phone: '',
  email: '',
  city: '',
  postcode: '',
};

export default function LeadForm({ source = 'website', partnerId = null, onSuccess = null }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const stepKey = STEPS[step];

  function toggleInterest(v) {
    setForm((f) => ({
      ...f,
      productInterest: f.productInterest.includes(v)
        ? f.productInterest.filter((x) => x !== v)
        : [...f.productInterest, v],
    }));
  }
  function pick(field, v) {
    setForm((f) => ({ ...f, [field]: v, ...(field === 'propertyType' ? { budget: '' } : {}) }));
  }
  function setText(field, v) {
    setForm((f) => ({ ...f, [field]: v }));
  }

  function canNext() {
    if (stepKey === 'interest') return form.productInterest.length > 0;
    if (stepKey === 'property') return !!form.propertyType;
    if (stepKey === 'budget') return !!form.budget;
    if (stepKey === 'timeline') return !!form.timeline;
    if (stepKey === 'persona') return !!form.persona;
    return true;
  }

  async function submit() {
    setError('');
    if (!form.name.trim() || !form.phone.trim() || !form.city.trim()) {
      setError('Please fill in your name, phone and city.');
      return;
    }
    if (!/^\d{10}$/.test(form.phone.replace(/\D/g, '').slice(-10))) {
      setError('Please enter a valid 10-digit phone number.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, source, partnerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      setDone(true);
      onSuccess && onSuccess(data);
    } catch (e) {
      setError(e.message || 'Could not submit — please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="lf-card">
        <div className="lf-success">
          <div className="lf-success-icon">
            <svg width="26" height="26" fill="none" stroke="var(--p)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg>
          </div>
          <div className="lf-success-title">Thanks, {form.name.split(' ')[0]}!</div>
          <div className="lf-success-desc">A Heseos advisor will call you within 24 hours to understand your needs and schedule your free demo.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="lf-card">
      <div className="lf-progress">
        {STEPS.map((s, i) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 'none' }}>
            <div className={`lf-prog-dot${i < step ? ' done' : ''}${i === step ? ' active' : ''}`}>{i < step ? '✓' : i + 1}</div>
            {i < STEPS.length - 1 && <div className={`lf-prog-line${i < step ? ' done' : ''}`} />}
          </div>
        ))}
      </div>

      {stepKey === 'interest' && (
        <>
          <div className="lf-step-title">What are you looking for?</div>
          <div className="lf-step-sub">Select all that apply</div>
          <div className="lf-pills">
            {PRODUCT_INTEREST.map((p) => (
              <button type="button" key={p.v} className={`lf-pill${form.productInterest.includes(p.v) ? ' active' : ''}`} onClick={() => toggleInterest(p.v)}>
                {p.l}
              </button>
            ))}
          </div>
        </>
      )}

      {stepKey === 'property' && (
        <>
          <div className="lf-step-title">Your property type</div>
          <div className="lf-step-sub">This helps us size the right system for you</div>
          <div className="lf-pills">
            {PROPERTY_TYPE.map((p) => (
              <button type="button" key={p.v} className={`lf-pill${form.propertyType === p.v ? ' active' : ''}`} onClick={() => pick('propertyType', p.v)}>
                {p.l}
              </button>
            ))}
          </div>
        </>
      )}

      {stepKey === 'budget' && (
        <>
          <div className="lf-step-title">What&rsquo;s your budget?</div>
          <div className="lf-step-sub">For {PROPERTY_TYPE.find((p) => p.v === form.propertyType)?.l}</div>
          <div className="lf-pills cols-1">
            {budgetOptionsFor(form.propertyType).map((b) => (
              <button type="button" key={b.v} className={`lf-pill${form.budget === b.v ? ' active' : ''}`} onClick={() => pick('budget', b.v)}>
                {b.l}
              </button>
            ))}
          </div>
        </>
      )}

      {stepKey === 'timeline' && (
        <>
          <div className="lf-step-title">How soon do you want to automate?</div>
          <div className="lf-pills">
            {TIMELINE.map((t) => (
              <button type="button" key={t.v} className={`lf-pill${form.timeline === t.v ? ' active' : ''}`} onClick={() => pick('timeline', t.v)}>
                {t.l}
              </button>
            ))}
          </div>
        </>
      )}

      {stepKey === 'persona' && (
        <>
          <div className="lf-step-title">How will you define yourself?</div>
          <div className="lf-pills">
            {PERSONA_TYPE.map((p) => (
              <button type="button" key={p.v} className={`lf-pill${form.persona === p.v ? ' active' : ''}`} onClick={() => pick('persona', p.v)}>
                {p.l}
              </button>
            ))}
          </div>
        </>
      )}

      {stepKey === 'contact' && (
        <>
          <div className="lf-step-title">Your contact information</div>
          <div className="lf-step-sub">So our advisor can reach you</div>
          <div className="lf-field">
            <label className="lf-label">Full Name</label>
            <input className="lf-input" value={form.name} onChange={(e) => setText('name', e.target.value)} placeholder="Your full name" />
          </div>
          <div className="lf-field">
            <label className="lf-label">Phone Number</label>
            <input className="lf-input" value={form.phone} onChange={(e) => setText('phone', e.target.value)} placeholder="10-digit mobile number" inputMode="numeric" />
          </div>
          <div className="lf-field">
            <label className="lf-label">Email (Optional)</label>
            <input className="lf-input" value={form.email} onChange={(e) => setText('email', e.target.value)} placeholder="you@email.com" type="email" />
          </div>
          <div className="lf-field">
            <label className="lf-label">City</label>
            <input className="lf-input" value={form.city} onChange={(e) => setText('city', e.target.value)} placeholder="Your city" />
          </div>
          <div className="lf-field">
            <label className="lf-label">Post Code</label>
            <input className="lf-input" value={form.postcode} onChange={(e) => setText('postcode', e.target.value)} placeholder="Pincode" inputMode="numeric" />
          </div>
        </>
      )}

      {error && <div className="lf-error">{error}</div>}

      <div className="lf-actions">
        <button type="button" className="lf-btn-back" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>Back</button>
        {stepKey === 'contact' ? (
          <button type="button" className="lf-btn-next" disabled={submitting} onClick={submit}>{submitting ? 'Submitting…' : 'Get My Free Demo'}</button>
        ) : (
          <button type="button" className="lf-btn-next" disabled={!canNext()} onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>Next</button>
        )}
      </div>
    </div>
  );
}
