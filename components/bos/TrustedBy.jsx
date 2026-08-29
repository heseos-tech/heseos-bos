// components/bos/TrustedBy.jsx
// "Trusted by forward-thinking partners" logo strip. Placeholder text-wordmarks
// stand in for real vendor logo files (Legrand, Schneider Electric, Orient
// Electric, Simero, Philips) — swap each span for an <Image> once the actual
// logo assets are supplied.

const LOGOS = ['Legrand', 'Schneider Electric', 'Orient Electric', 'SIMERO', 'PHILIPS'];

export default function TrustedBy() {
  return (
    <section className="bos-trustedby">
      <div className="container">
        <div className="bos-trustedby-label">Trusted by forward-thinking partners</div>
        <div className="bos-trustedby-row">
          {LOGOS.map((l) => (
            <span className="bos-trustedby-logo" key={l}>{l}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
