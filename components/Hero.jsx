import Image from 'next/image';
import { IconArrowRight } from './bos/icons';

export default function Hero() {
  return (
    <section className="bos-hero">
      <div className="container bos-hero-inner">
        <div className="bos-hero-copy">
          <div className="bos-eyebrow">HESEOS BOS · Internal</div>
          <h1 className="bos-h1">
            Business<br />Operating<br />System
          </h1>
          <p className="bos-hero-sub" style={{ maxWidth: 380 }}>
            Heseos&rsquo;s own system for running the business — leads, demos, quotes, orders, installations and payouts, in one place for our team and partners.
          </p>
          <div className="bos-hero-actions">
            <a href="#signin" className="bos-btn-primary">
              Sign in
              <IconArrowRight size={15} />
            </a>
            <a href="#how" className="bos-btn-ghost">How BOS works</a>
          </div>
        </div>

        <div className="bos-hero-visual">
          <Image
            src="/hero-device-mockup.webp"
            alt="HESEOS BOS on a laptop, showing the Leads list, next to a phone punching in a new lead"
            width={1200}
            height={800}
            priority
            className="bos-hero-device"
          />
        </div>
      </div>
    </section>
  );
}
