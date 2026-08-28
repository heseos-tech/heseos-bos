'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function FloatingCTA() {
  const pathname = usePathname();
  if (pathname !== '/') return null;

  return (
    <Link href="/become-a-partner" className="float-cta">
      <span className="float-cta-dot" />
      Become a Heseos Partner
      <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <path d="M5 12h14M12 5l7 7-7 7" />
      </svg>
    </Link>
  );
}
