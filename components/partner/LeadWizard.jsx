'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ScreenHeader, ProgressSteps, TextField, SelectField, TextareaField, Button } from './ui';
import {
  IconUser, IconPhone, IconMapPin, IconBuilding, IconLayers, IconWallet, IconCalendar, IconSource, IconNote,
  IconCheck, IconCopy, IconHome,
} from './icons';
import {
  WIZARD_PROPERTY_TYPE, CONFIGURATION, REFERRAL_SOURCE, PROPERTY_TYPE_LABEL, CONFIGURATION_LABEL,
  TIMELINE_LABEL, REFERRAL_SOURCE_LABEL, budgetOptionsFor, budgetLabel,
} from '@/lib/partnerMock';
import { TIMELINE } from '@/lib/formOptions';

const empty = {
  name: '', phone: '', altPhone: '', city: '',
  propertyType: '', configuration: '', budget: '', timeline: '', referralSource: '', notes: '',
};

export default function LeadWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0); // 0,1,2 = form steps; 3 = success
  const [form, setForm] = useState(empty);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [leadId, setLeadId] = useState('');
  const [copied, setCopied] = useState(false);

  function set(field, val) {
    setForm((f) => ({ ...f, [field]: val, ...(field === 'propertyType' ? { budget: '' } : {}) }));
  }

  function canNextStep1() {
    return form.name.trim() && /^\d{10}$/.test(form.phone.replace(/\D/g, '')) && form.city.trim();
  }
  function canNextStep2() {
    return form.propertyType && form.configuration && form.budget && form.timeline && form.referralSource;
  }

  async function submit() {
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, source: 'partner_app' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong — please try again.');
      setLeadId(data.id);
      setStep(3);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  function copyId() {
    navigator.clipboard?.writeText(leadId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  if (step === 3) {
    return (
      <div className="hp-success-wrap">
        <div className="hp-success-ring"><div className="hp-success-circle"><IconCheck size={30} color="#fff" /></div></div>
        <div className="hp-success-title">Lead Submitted!</div>
        <div className="hp-success-desc">Thank you! We have received the lead. Our team will connect with the customer soon.</div>

        <div className="hp-id-card">
          <div>
            <div className="hp-id-label">Lead ID</div>
            <div className="hp-id-val">{leadId}</div>
          </div>
          <button className="hp-copy-btn" onClick={copyId} aria-label="Copy lead ID">
            {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
          </button>
        </div>

        <div className="hp-next-block">
          <div className="hp-next-title">What happens next?</div>
          <div className="hp-check-item"><IconCheck size={16} /> Our team will verify the lead</div>
          <div className="hp-check-item"><IconCheck size={16} /> We will connect with the customer</div>
          <div className="hp-check-item"><IconCheck size={16} /> You will get updates on lead progress</div>
        </div>

        <Button block onClick={() => router.push('/partner/home')}><IconHome size={16} /> Back to Dashboard</Button>
      </div>
    );
  }

  return (
    <>
      <ScreenHeader title="Punch New Lead" onBack={() => (step === 0 ? router.push('/partner/home') : setStep((s) => s - 1))} />
      <ProgressSteps step={step} total={3} />

      {step === 0 && (
        <div className="hp-card">
          <div className="hp-card-title">Customer Details</div>
          <TextField label="Full Name" icon={<IconUser size={18} />} placeholder="Enter full name" value={form.name} onChange={(e) => set('name', e.target.value)} />
          <TextField label="Mobile Number" icon={<IconPhone size={18} />} placeholder="Enter 10 digit mobile number" value={form.phone} onChange={(e) => set('phone', e.target.value)} inputMode="numeric" />
          <TextField label="Alternate Number (Optional)" icon={<IconPhone size={18} />} placeholder="Enter alternate number" value={form.altPhone} onChange={(e) => set('altPhone', e.target.value)} inputMode="numeric" />
          <TextField label="Location" icon={<IconMapPin size={18} />} placeholder="Enter city / area" value={form.city} onChange={(e) => set('city', e.target.value)} />
        </div>
      )}

      {step === 1 && (
        <div className="hp-card">
          <div className="hp-card-title">Requirement Details</div>
          <SelectField label="Property Type" icon={<IconBuilding size={18} />} value={form.propertyType} onChange={(e) => set('propertyType', e.target.value)} options={WIZARD_PROPERTY_TYPE} placeholder="Select property type" />
          <SelectField label="Configuration" icon={<IconLayers size={18} />} value={form.configuration} onChange={(e) => set('configuration', e.target.value)} options={CONFIGURATION} placeholder="Select configuration" />
          <SelectField label="Budget Range" icon={<IconWallet size={18} />} value={form.budget} onChange={(e) => set('budget', e.target.value)} options={budgetOptionsFor(form.propertyType)} placeholder={form.propertyType ? 'Select budget range' : 'Select property type first'} disabled={!form.propertyType} />
          <SelectField label="When are they planning?" icon={<IconCalendar size={18} />} value={form.timeline} onChange={(e) => set('timeline', e.target.value)} options={TIMELINE} placeholder="Select timeline" />
          <SelectField label="How did you connect?" icon={<IconSource size={18} />} value={form.referralSource} onChange={(e) => set('referralSource', e.target.value)} options={REFERRAL_SOURCE} placeholder="Select source" />
          <TextareaField label="Additional Notes (Optional)" icon={<IconNote size={18} />} placeholder="Write notes here…" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </div>
      )}

      {step === 2 && (
        <>
          <div className="hp-card">
            <div className="hp-card-title">Customer Details</div>
            <div className="hp-review-block">
              <div className="hp-review-item"><span className="hp-review-icon"><IconUser size={16} /></span><span className="hp-review-val">{form.name}</span></div>
              <div className="hp-review-item"><span className="hp-review-icon"><IconPhone size={16} /></span><span className="hp-review-val">{form.phone}</span></div>
              <div className="hp-review-item"><span className="hp-review-icon"><IconMapPin size={16} /></span><span className="hp-review-val">{form.city}</span></div>
            </div>
          </div>
          <div className="hp-card">
            <div className="hp-card-title">Requirement Summary</div>
            <div className="hp-summary-row"><span className="hp-summary-label">Property Type</span><span className="hp-summary-val">{PROPERTY_TYPE_LABEL[form.propertyType]}</span></div>
            <div className="hp-summary-row"><span className="hp-summary-label">Configuration</span><span className="hp-summary-val">{CONFIGURATION_LABEL[form.configuration]}</span></div>
            <div className="hp-summary-row"><span className="hp-summary-label">Budget Range</span><span className="hp-summary-val">{budgetLabel(form.propertyType, form.budget)}</span></div>
            <div className="hp-summary-row"><span className="hp-summary-label">Timeline</span><span className="hp-summary-val">{TIMELINE_LABEL[form.timeline]}</span></div>
            <div className="hp-summary-row"><span className="hp-summary-label">Source</span><span className="hp-summary-val">{REFERRAL_SOURCE_LABEL[form.referralSource]}</span></div>
            {form.notes && <div className="hp-summary-row"><span className="hp-summary-label">Notes</span><span className="hp-summary-val">{form.notes}</span></div>}
          </div>
        </>
      )}

      {error && <div className="hp-error" style={{ margin: '0 20px 12px' }}>{error}</div>}

      <div className="hp-cta-block" style={{ paddingBottom: 24 }}>
        {step < 2 && (
          <Button block disabled={step === 0 ? !canNextStep1() : !canNextStep2()} onClick={() => setStep((s) => s + 1)}>Next</Button>
        )}
        {step === 2 && (
          <Button block disabled={submitting} onClick={submit}>{submitting ? 'Submitting…' : 'Submit Lead'}</Button>
        )}
      </div>
    </>
  );
}
