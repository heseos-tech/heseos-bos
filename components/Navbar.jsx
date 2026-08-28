'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className={`nav${scrolled ? ' scrolled' : ''}`}>
      <div className="nav-inner">
        <Link href="/" className="nav-logo">
          <Image src="/brand/lockup-navy.png" alt="Heseos" width={282} height={64} priority style={{ height: 30, width: 'auto' }} />
        </Link>

        <div className="nav-links">
          <a href="#how-it-works" className="nav-link">How It Works</a>
          <a href="#products" className="nav-link">Products</a>
          <Link href="/become-a-partner" className="nav-link">Become a Partner</Link>
          <a href="#get-started" className="nav-cta">Book a Free Demo</a>
        </div>

        <button className="nav-hamburger" aria-label="Toggle menu" onClick={() => setMenuOpen(!menuOpen)}>
          <span style={menuOpen ? { transform: 'rotate(45deg) translate(5px, 5px)' } : {}} />
          <span style={menuOpen ? { opacity: 0 } : {}} />
          <span style={menuOpen ? { transform: 'rotate(-45deg) translate(5px, -5px)' } : {}} />
        </button>
      </div>

      {menuOpen && (
        <div style={{ background: 'rgba(248,250,251,0.98)', backdropFilter: 'blur(24px)', borderTop: '1px solid var(--border)', padding: '16px 20px 24px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <a href="#how-it-works" className="nav-link" onClick={() => setMenuOpen(false)} style={{ padding: '12px 8px', fontSize: '15px' }}>How It Works</a>
          <a href="#products" className="nav-link" onClick={() => setMenuOpen(false)} style={{ padding: '12px 8px', fontSize: '15px' }}>Products</a>
          <Link href="/become-a-partner" className="nav-link" onClick={() => setMenuOpen(false)} style={{ padding: '12px 8px', fontSize: '15px' }}>Become a Partner</Link>
          <a href="#get-started" className="nav-cta" onClick={() => setMenuOpen(false)} style={{ marginTop: '8px', width: '100%', borderRadius: '12px', textAlign: 'center', display: 'block' }}>
            Book a Free Demo
          </a>
        </div>
      )}
    </nav>
  );
}
