'use client';
// Top bar for the BOS home page — this is Heseos's own internal system, not a product being sold, so the
// bar only offers "what is BOS", "who uses it" and Sign in (no demo / pricing style links).
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { IconArrowRight } from './icons';

const LINKS = [
  { label: 'How BOS works', href: '#how' },
  { label: 'Who uses it', href: '#teams' },
  { label: 'Sign in', href: '#signin' },
];

export default function InternalNav() {
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
        <Link href="/" className="nav-logo" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Image src="/brand/lockup-navy.png" alt="Heseos" width={282} height={64} priority style={{ height: 28, width: 'auto' }} />
          <span className="bos-internal-pill">BOS · Internal</span>
        </Link>

        <div className="bos-nav-links">
          {LINKS.map((l) => <a href={l.href} className="bos-nav-link" key={l.label}>{l.label}</a>)}
        </div>

        <a href="#signin" className="bos-nav-cta">
          Sign in
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
          {LINKS.map((l) => <a href={l.href} className="bos-nav-mobile-link" key={l.label} onClick={() => setMenuOpen(false)}>{l.label}</a>)}
        </div>
      )}
    </nav>
  );
}
