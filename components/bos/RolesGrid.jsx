// components/bos/RolesGrid.jsx
// "Built for every role in your growth engine" — 4 role cards. Photo areas are
// clean gradient placeholders (per product decision) standing in for real
// team/role photography — swap the .bos-role-photo div for a real <Image>
// once photos are supplied, keeping the badge + copy as-is.

import { IconRolePartners, IconRolePresales, IconRoleSales, IconRoleLeaders, IconArrowUpRight } from './icons';

const ROLES = [
  { name: 'Partners', desc: 'Add leads on the go. Track status. Earn rewards.', Icon: IconRolePartners, tone: 'orange' },
  { name: 'Pre-sales Team', desc: 'Qualify leads. Nurture relationships. Schedule demos.', Icon: IconRolePresales, tone: 'orange' },
  { name: 'Sales Engineers', desc: 'Manage demos. Send quotes. Close more deals.', Icon: IconRoleSales, tone: 'blue' },
  { name: 'Leaders', desc: 'Real-time insights. Smarter decisions.', Icon: IconRoleLeaders, tone: 'purple' },
];

export default function RolesGrid() {
  return (
    <section className="bos-roles">
      <div className="container">
        <div className="bos-section-head bos-section-head--center">
          <div className="bos-eyebrow bos-eyebrow--center">Built for Every Role</div>
          <h2 className="bos-h2">Built for every role in your growth engine</h2>
        </div>

        <div className="bos-roles-grid">
          {ROLES.map((r) => (
            <div className="bos-role-card" key={r.name}>
              <div className={`bos-role-photo bos-role-photo--${r.tone}`}>
                <span className={`bos-role-badge bos-role-badge--${r.tone}`}><r.Icon /></span>
              </div>
              <div className="bos-role-name">{r.name}</div>
              <div className="bos-role-desc">{r.desc}</div>
              <button className="bos-role-arrow" aria-label={`Learn more about ${r.name}`}><IconArrowUpRight size={15} /></button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
