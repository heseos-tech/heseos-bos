import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';

export default function BecomePartnerPage() {
  return (
    <>
      <Navbar />
      <section className="hero" style={{ minHeight: '70vh' }}>
        <div className="hero-orb1" />
        <div className="container" style={{ paddingTop: '90px', paddingBottom: '60px', position: 'relative', zIndex: 2 }}>
          <div className="section-label">Distribution Partners</div>
          <h1 className="hero-h1" style={{ maxWidth: '720px' }}>Bring us the lead. We handle the rest.</h1>
          <p className="hero-sub" style={{ maxWidth: '620px' }}>
            Shops, electricians, interior designers and builders can add customer leads straight into Heseos&rsquo;s pipeline from the partner portal — our team calls, demos and closes, and you earn on every conversion.
          </p>
          <div className="hero-actions">
            <Link href="/partner/login" className="btn-primary">
              Partner Login
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            </Link>
            <a href="/get-started" className="btn-ghost">Not a partner? Enquire here</a>
          </div>
          <p style={{ marginTop: '28px', fontSize: '13px', color: 'var(--ink-soft)' }}>
            Don&rsquo;t have partner access yet? Ask your Heseos account manager to set up your login, or reach out via the enquiry form.
          </p>
        </div>
      </section>
      <Footer />
    </>
  );
}
