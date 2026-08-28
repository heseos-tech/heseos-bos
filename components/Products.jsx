import { PRODUCT_INTEREST } from '@/lib/formOptions';

const DESC = {
  touch_panel_switches: 'Elegant glass touch panels that replace your existing switchboards — no rewiring of the wall.',
  smart_door_locks: 'Fingerprint, PIN and app-based access. Know who came in and when.',
  smart_lights: 'Dim, schedule and scene-control every light from your phone or voice.',
  smart_curtains: 'Motorised curtain and blind control, on a schedule or a tap.',
  video_door_phone: 'See and speak to visitors from anywhere, even when you’re not home.',
  scene_controller: 'One button for "Good Night", "Movie Time" or "Leaving Home" — every device, one scene.',
  full_package: 'A single system that ties lighting, access, curtains and security together.',
  not_sure: 'Not sure what you need? Our advisors will recommend a solution after a quick call.',
};

export default function Products() {
  return (
    <section id="products" className="different">
      <div className="container">
        <div className="section-label">Products</div>
        <h2 className="section-title">What we automate</h2>
        <p className="section-desc">Pick what interests you on the enquiry form below — we&rsquo;ll tailor the demo around it.</p>

        <div className="diff-wrap">
          {PRODUCT_INTEREST.filter((p) => p.v !== 'not_sure').map((p) => (
            <div className="diff-card" key={p.v}>
              <div className="dc-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 8v4l3 2" /></svg>
              </div>
              <div className="dc-title">{p.l}</div>
              <div className="dc-desc">{DESC[p.v]}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
