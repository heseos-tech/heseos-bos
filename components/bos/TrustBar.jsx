// components/bos/TrustBar.jsx
// Bottom tagline + 4-icon trust row.

import { IconShield, IconScale, IconSpeed, IconPeople } from './icons';

const ITEMS = [
  { label: 'Secure & Reliable', Icon: IconShield, tone: 'teal' },
  { label: 'Scalable for Growth', Icon: IconScale, tone: 'blue' },
  { label: 'Built for Speed', Icon: IconSpeed, tone: 'orange' },
  { label: 'Designed for People', Icon: IconPeople, tone: 'orange' },
];

export default function TrustBar() {
  return (
    <section className="bos-trustbar">
      <div className="container">
        <p className="bos-trustbar-tagline">A platform trusted by partners. Loved by customers.</p>
        <div className="bos-trustbar-row">
          {ITEMS.map((it) => (
            <div className="bos-trustbar-item" key={it.label}>
              <span className={`bos-trustbar-icon bos-trustbar-icon--${it.tone}`}><it.Icon /></span>
              {it.label}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
