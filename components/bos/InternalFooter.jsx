import Image from 'next/image';

export default function InternalFooter() {
  return (
    <footer id="footer">
      <div className="container">
        <div className="bos-foot">
          <div>
            <Image src="/brand/lockup-white.png" alt="Heseos" width={282} height={64} style={{ height: 28, width: 'auto', marginBottom: 10 }} />
            <p className="footer-tagline" style={{ maxWidth: 360 }}>
              HESEOS BOS is the internal operating system of TEN Labs Technologies. For authorised team members, partners and installers only.
            </p>
          </div>
          <ul className="footer-links bos-foot-links">
            <li><a href="#signin">Sign in</a></li>
            <li><a href="/privacy">Privacy</a></li>
            <li><a href="/delete-account">Delete my account</a></li>
          </ul>
        </div>
        <div className="footer-bottom">
          <span className="footer-copy">© {new Date().getFullYear()} TEN Labs Technologies. Heseos — Smart Home Automation.</span>
        </div>
      </div>
    </footer>
  );
}
