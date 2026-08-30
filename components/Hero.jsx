import Image from 'next/image';
import { IconArrowRight } from './bos/icons';

export default function Hero() {
  return (
    <section className="bos-hero">
      <div className="container bos-hero-inner">
        <div className="bos-hero-copy">
          <div className="bos-eyebrow">HESEOS BOS</div>
          <h1 className="bos-h1">
            Business<br />Operating<br />System
          </h1>
          <p className="bos-hero-sub">
            One system to capture, manage and convert more leads. Across every channel. Every team.
          </p>
          <a href="/#get-started" className="bos-btn-primary">
            Request Demo
            <IconArrowRight size={15} />
          </a>
        </div>

        <div className="bos-hero-visual">
          <Image
            src="/hero-device-mockup.webp"
            alt="HESEOS BOS dashboard on a laptop, showing the Leads list, next to a phone punching in a new lead"
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
