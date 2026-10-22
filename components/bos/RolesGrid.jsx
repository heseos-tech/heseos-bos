// components/bos/RolesGrid.jsx
// "Who uses BOS" — a plain list of the teams and what each one does inside the system.

import { IconRolePartners, IconRolePresales, IconRoleSales, IconRoleLeaders, IconRoleOps, IconRoleAccounts, IconRoleInstaller } from './icons';

const ROLES = [
  { name: 'Pre-sales', desc: 'Call new leads, qualify them and book demos.', Icon: IconRolePresales },
  { name: 'Sales engineers', desc: 'Run demos, send quotations and close deals.', Icon: IconRoleSales },
  { name: 'Operations', desc: 'Confirm, pack, ship and schedule installations.', Icon: IconRoleOps },
  { name: 'Accounts', desc: 'Mark orders paid and settle partner and installer payouts.', Icon: IconRoleAccounts },
  { name: 'Partners', desc: 'Bring in leads and follow them to conversion.', Icon: IconRolePartners },
  { name: 'Installers', desc: 'Claim installation jobs and complete them.', Icon: IconRoleInstaller },
  { name: 'Admin & leadership', desc: 'See the whole pipeline, reports and settings.', Icon: IconRoleLeaders },
];

export default function RolesGrid() {
  return (
    <section className="bos-roles" id="teams">
      <div className="container">
        <div className="bos-section-head bos-section-head--center">
          <div className="bos-eyebrow bos-eyebrow--center">Who uses BOS</div>
          <h2 className="bos-h2">Every team has its own view</h2>
        </div>

        <div className="bos-team-grid">
          {ROLES.map((r) => (
            <div className="bos-team-card" key={r.name}>
              <span className="bos-team-icon"><r.Icon size={20} /></span>
              <div>
                <div className="bos-role-name">{r.name}</div>
                <div className="bos-role-desc" style={{ marginBottom: 0 }}>{r.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
