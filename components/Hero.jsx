export default function Hero() {
  return (
    <section className="hero">
      <div className="hero-orb1" />
      <div className="hero-orb2" />
      <div className="hero-body">
        <div className="container hero-inner">
          <div>
            <div className="hero-eyebrow">
              <span className="eyebrow-dot" />
              <span className="eyebrow-text">Smart Home Automation</span>
            </div>
            <h1 className="hero-h1">
              Let&rsquo;s build your
              <span className="accent-line">smart <span className="ai-word">space</span>.</span>
            </h1>
            <p className="hero-sub">
              From a single retrofit switch to a fully automated home — our smart home experts recommend the right solution, then walk you through a live demo before you decide.
            </p>
            <div className="hero-actions">
              <a href="#get-started" className="btn-primary">
                Book a Free Demo
                <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
              </a>
              <a href="#how-it-works" className="btn-ghost">See How It Works</a>
            </div>
            <div className="hero-trust">
              <div className="trust-item">
                <span className="trust-check"><svg viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
                Free on-site demo
              </div>
              <div className="trust-item">
                <span className="trust-check"><svg viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
                Retrofit or full install
              </div>
              <div className="trust-item">
                <span className="trust-check"><svg viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
                2-year warranty
              </div>
            </div>
          </div>

          <div className="hero-visual">
            <HeroPanel />
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroPanel() {
  const items = [
    { l: 'Touch Panel Switches', v: 'Popular' },
    { l: 'Smart Door Locks', v: 'Popular' },
    { l: 'Smart Lights & Curtains', v: '' },
    { l: 'Video Door Phone', v: '' },
  ];
  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border-light)', borderRadius: 'var(--r24)', boxShadow: 'var(--shadow-xl)', padding: '26px', maxWidth: '380px', marginLeft: 'auto' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--p)', marginBottom: '16px' }}>
        Recommended for you
      </div>
      {items.map((it) => (
        <div key={it.l} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 0', borderBottom: '1px solid var(--border-light)' }}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>{it.l}</span>
          {it.v && <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--p)', background: 'rgba(217,72,30,0.08)', padding: '3px 10px', borderRadius: 'var(--r-full)' }}>{it.v}</span>}
        </div>
      ))}
      <div style={{ marginTop: '18px', padding: '14px', background: 'var(--bg)', borderRadius: 'var(--r12)', fontSize: '12.5px', color: 'var(--ink-soft)', lineHeight: 1.6 }}>
        Answer 6 quick questions and a Heseos advisor calls you within 24 hours with a tailored quote.
      </div>
    </div>
  );
}
