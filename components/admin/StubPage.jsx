// A classy "coming soon" placeholder — used for nav items the admin sidebar links to that
// don't have a full page built yet (Demo Schedule, Quotations, Conversions, Reports,
// Payouts, Tasks, Settings). Keeps the sidebar honest: every item is a real route, but only
// says "coming soon" where there's genuinely nothing behind it yet.
export default function StubPage({ title, description, Icon }) {
  return (
    <div className="adm-stub">
      <div className="adm-stub-icon"><Icon size={26} /></div>
      <h1 className="adm-h1">{title}</h1>
      <p className="adm-stub-desc">{description}</p>
      <span className="adm-stub-badge">Coming soon</span>
    </div>
  );
}
