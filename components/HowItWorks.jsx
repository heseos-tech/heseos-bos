const STEPS = [
  {
    name: 'Share Your Details',
    desc: 'Tell us about your space, budget and timeline — takes under a minute.',
    icon: <path d="M12 2a5 5 0 015 5v2a5 5 0 01-10 0V7a5 5 0 015-5zM5 20a7 7 0 0114 0" />,
  },
  {
    name: 'We Call & Qualify',
    desc: 'Our lead nurturing team calls you, understands your needs, and books a free demo.',
    icon: <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.5 10.8 19.79 19.79 0 01.46 2.18 2 2 0 012.43 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.1 6.1l.77-.77a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />,
  },
  {
    name: 'Live Demo At Home',
    desc: 'A Heseos sales engineer visits your home or office and demonstrates the system live.',
    icon: <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />,
  },
  {
    name: 'You Decide',
    desc: 'Love it? We install. Not ready? We follow up whenever suits you.',
    icon: <path d="M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3" />,
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="hiw">
      <div className="container">
        <div className="hiw-head">
          <div className="section-label centered">How It Works</div>
          <h2 className="section-title">From enquiry to installed, in four steps</h2>
          <p className="section-desc">Every step is logged with a timestamp, so you — and our team — always know exactly where things stand.</p>
        </div>

        <div className="journey-track">
          {STEPS.map((s, i) => (
            <div className="journey-step" key={s.name}>
              <div className="js-icon">
                <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">{s.icon}</svg>
              </div>
              <div className="js-num">Step {i + 1}</div>
              <div className="js-name">{s.name}</div>
              <div className="js-desc">{s.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
