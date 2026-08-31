import Image from 'next/image';

const cols = [
  {
    heading: 'Platform',
    links: [
      ['How It Works', '/#how-it-works'],
      ['Products', '/#products'],
      ['Book a Demo', '/get-started'],
    ],
  },
  {
    heading: 'Partners',
    links: [
      ['Become a Partner', '/become-a-partner'],
      ['Partner Login', '/partner/login'],
    ],
  },
  {
    heading: 'Company',
    links: [
      ['Employee Login', '/employee/login'],
      ['Contact Us', '/get-started'],
    ],
  },
];

export default function Footer() {
  return (
    <footer id="footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <Image src="/brand/lockup-white.png" alt="Heseos" width={282} height={64} style={{ height: 30, width: 'auto', marginBottom: 4 }} />
            <p className="footer-tagline">
              Smart home automation, done right — from a single retrofit switch to a fully automated home. Built for how Indian homes actually live.
            </p>
          </div>

          {cols.map((col) => (
            <div className="footer-col" key={col.heading}>
              <h4>{col.heading}</h4>
              <ul className="footer-links">
                {col.links.map(([label, href]) => (
                  <li key={label}>
                    <a href={href}>{label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="footer-bottom">
          <span className="footer-copy">
            © {new Date().getFullYear()} TEN Labs Technologies. Heseos — Smart Home Automation.
          </span>
          <div className="footer-badges">
            {['Verified Installers', 'On-site Demo', '2-Year Warranty'].map((b) => (
              <span className="footer-badge" key={b}>{b}</span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
