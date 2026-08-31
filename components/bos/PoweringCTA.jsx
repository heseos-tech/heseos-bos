// components/bos/PoweringCTA.jsx
// "Powering smart home businesses to grow smarter, together." split CTA.
// The right-hand image is a CSS gradient standing in for a real dusk-exterior
// house photo (placeholder decision) — swap .bos-power-photo's background for
// a real <Image> once one is supplied.

export default function PoweringCTA() {
  return (
    <section className="bos-power">
      <div className="container">
        <div className="bos-power-box">
          <div className="bos-power-copy">
            <div className="bos-eyebrow">All in One. Always in Sync.</div>
            <h2 className="bos-power-title">Powering smart home businesses to grow smarter, together.</h2>
            <a href="/get-started" className="bos-btn-primary">
              Request Demo
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            </a>
          </div>
          <div className="bos-power-photo" role="img" aria-label="A modern smart home lit up at dusk">
            <span className="bos-power-glow bos-power-glow-1" />
            <span className="bos-power-glow bos-power-glow-2" />
            <span className="bos-power-glow bos-power-glow-3" />
          </div>
        </div>
      </div>
    </section>
  );
}
