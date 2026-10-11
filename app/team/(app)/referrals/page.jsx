'use client';
import ReferralsScreen from '@/components/team/ReferralsScreen';

// Reuses TeamAppShell's auth guard (../layout.jsx) — ReferralsScreen reads the signed-in
// employee from its session context.
export default function TeamReferralsPage() {
  return <ReferralsScreen backHref="/team/home" />;
}
