// components/bos/SystemFlow.jsx
// "One system. Every channel." — the four-step Capture / Qualify / Engage /
// Convert process strip beneath the hero.

import { IconCapture, IconQualify, IconEngage, IconConvert, IconArrowRight } from './icons';

const STEPS = [
  { name: 'Capture', desc: 'Leads from partners, QR codes, WhatsApp and ads.', Icon: IconCapture },
  { name: 'Qualify', desc: 'Pre-sales team nurtures and qualifies high-potential leads.', Icon: IconQualify },
  { name: 'Engage', desc: 'Demos are scheduled with interested customers.', Icon: IconEngage },
  { name: 'Convert', desc: 'Quotes are sent and deals are converted faster.', Icon: IconConvert },
];

export default function SystemFlow() {
  return (
    <section className="bos-flow">
      <div className="container">
        <div className="bos-section-head bos-section-head--center">
          <div className="bos-eyebrow bos-eyebrow--center">How It Works</div>
          <h2 className="bos-h2">One system. Every channel.</h2>
        </div>

        <div className="bos-flow-row">
          {STEPS.map((s, i) => (
            <div className="bos-flow-item" key={s.name}>
              <div className="bos-flow-card">
                <div className="bos-flow-icon"><s.Icon /></div>
                <div className="bos-flow-name">{s.name}</div>
                <div className="bos-flow-desc">{s.desc}</div>
              </div>
              {i < STEPS.length - 1 && (
                <span className="bos-flow-sep" aria-hidden="true"><IconArrowRight size={16} /></span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
