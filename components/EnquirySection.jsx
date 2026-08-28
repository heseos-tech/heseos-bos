import LeadForm from './LeadForm';

const NEXT_STEPS = [
  {
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.5 10.8 19.79 19.79 0 01.46 2.18 2 2 0 012.43 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.1 6.1l.77-.77a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
    title: 'Call within 24 hours',
    desc: 'Our pre-sales team calls to understand your space and needs',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
    title: 'Free demo at your home',
    desc: 'A sales engineer visits and shows the system live, on your terms',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
        <path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <polyline points="22 4 12 14.01 9 11.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: 'You decide, we install',
    desc: 'No pressure — install when you’re ready',
  },
];

export default function EnquirySection() {
  return (
    <section id="get-started" className="eq-section">
      <div className="container eq-inner">
        <div className="eq-copy">
          <div className="section-label">Get Started</div>
          <h2 className="eq-title">
            Let&rsquo;s build your<br /><em>smart space.</em>
          </h2>
          <p className="eq-sub">
            Answer a few quick questions and our smart home experts will recommend the perfect automation solution — then book your free on-site demo.
          </p>

          <div className="eq-steps">
            {NEXT_STEPS.map((s, i) => (
              <div className="eq-step" key={i}>
                <div className="eq-step-icon">{s.icon}</div>
                <div>
                  <p className="eq-step-title">{s.title}</p>
                  <p className="eq-step-desc">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="eq-privacy">
            <svg viewBox="0 0 16 16" width="13" height="13" fill="none">
              <rect x="2" y="7" width="12" height="8" rx="2" stroke="currentColor" strokeWidth="1.3" />
              <path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            Your information is private and will never be shared without consent.
          </p>
        </div>

        <div>
          <LeadForm source="website" />
        </div>
      </div>
    </section>
  );
}
