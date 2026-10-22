// components/bos/SystemFlow.jsx
// "How BOS works" — the journey one customer takes through Heseos, and who owns each step.

import { IconCapture, IconQualify, IconEngage, IconConvert, IconRoleOps, IconArrowRight } from './icons';

const STEPS = [
  { name: 'Capture', who: 'Partners · QR · WhatsApp · Ads', desc: 'Every enquiry lands in BOS as a lead, tagged with where it came from.', Icon: IconCapture },
  { name: 'Qualify', who: 'Pre-sales', desc: 'Call, qualify and book a demo with the customer.', Icon: IconQualify },
  { name: 'Demo & quote', who: 'Sales engineers', desc: 'Run the on-site demo, send the quotation and close the deal.', Icon: IconEngage },
  { name: 'Order & deliver', who: 'Operations', desc: 'Confirm, pack and ship the order — tracked through the courier.', Icon: IconRoleOps },
  { name: 'Install & pay', who: 'Installers · Accounts', desc: 'Installers complete the job; accounts record payment and settle payouts.', Icon: IconConvert },
];

export default function SystemFlow() {
  return (
    <section className="bos-flow" id="how">
      <div className="container">
        <div className="bos-section-head bos-section-head--center">
          <div className="bos-eyebrow bos-eyebrow--center">How BOS works</div>
          <h2 className="bos-h2">One customer, start to finish</h2>
        </div>

        <div className="bos-flow-row">
          {STEPS.map((s, i) => (
            <div className="bos-flow-item" key={s.name}>
              <div className="bos-flow-card">
                <div className="bos-flow-icon"><s.Icon /></div>
                <div className="bos-flow-name">{s.name}</div>
                <div className="bos-flow-who">{s.who}</div>
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
