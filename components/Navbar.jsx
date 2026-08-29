'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { IconChevronDown, IconArrowRight } from './bos/icons';

// "Product", "Solutions" and "Resources" are visual-only dropdown triggers for
// now (no menu content defined yet) — Platform and About Us are real links.
const NAV_ITEMS = [
  { label: 'Product', dropdown: true },
  { label: 'Platform', href: '/' },
  { label: 'Solutions', dropdown: true },
  { label: 'Resources', dropdown: true },
  { label: 'About Us', href: '/#footer' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className={`nav bos-nav${scrolled ? ' scrolled' : ''}`}>
      <div className="nav-inner">
        <Link href="/" className="nav-logo">
          <Image src="/brand/lockup-navy.png" alt="Heseos" width={282} height={64} priority style={{ height: 28, width: 'auto' }} />
        </Link>

        <div className="bos-nav-links">
          {NAV_ITEMS.map((item) =>
            item.dropdown ? (
              <span className="bos-nav-link bos-nav-link--drop" key={item.label}>
                {item.label}
                <IconChevronDown size={13} />
              </span>
            ) : (
              <Link href={item.href} className="bos-nav-link" key={item.label}>{item.label}</Link>
            )
          )}
        </div>

        <a href="/#get-started" className="bos-nav-cta">
          Request Demo
          <IconArrowRight size={14} />
        </a>

        <button className="nav-hamburger" aria-label="Toggle menu" onClick={() => setMenuOpen(!menuOpen)}>
          <span style={menuOpen ? { transform: 'rotate(45deg) translate(5px, 5px)' } : {}} />
          <span style={menuOpen ? { opacity: 0 } : {}} />
          <span style={menuOpen ? { transform: 'rotate(-45deg) translate(5px, -5px)' } : {}} />
        </button>
      </div>

      {menuOpen && (
        <div className="bos-nav-mobile">
          {NAV_ITEMS.map((item) =>
            item.dropdown ? (
              <span className="bos-nav-mobile-link bos-nav-mobile-link--drop" key={item.label}>{item.label}</span>
            ) : (
              <Link href={item.href} className="bos-nav-mobile-link" key={item.label} onClick={() => setMenuOpen(false)}>{item.label}</Link>
            )
          )}
          <a href="/#get-started" className="bos-nav-cta bos-nav-cta--mobile" onClick={() => setMenuOpen(false)}>
            Request Demo
            <IconArrowRight size={14} />
          </a>
        </div>
      )}
    </nav>
  );
}
