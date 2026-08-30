'use client';
import { useEffect, useState } from 'react';

// Plays once per real "app open" — this lives inside AppShell/TeamAppShell, which only mounts
// fresh when a partner/employee actually lands on /partner/home or /team/home (post-login, or a
// cold PWA launch); it does NOT remount when switching bottom-nav tabs, since those are just
// ?tab= changes inside the same already-mounted PartnerHome/TeamHome (see PartnerHome.jsx /
// TeamHome.jsx). Sequence: the bare icon glows in, then crossfades into the full "HESEOS"
// lockup, then the whole overlay fades away to reveal the app underneath.
const TO_LOCKUP_MS = 1000;
const TO_FADE_MS = 1650;
const TO_DONE_MS = 2050;

export default function SplashScreen() {
  const [stage, setStage] = useState(0); // 0 icon-glow, 1 lockup, 2 fading out, 3 gone

  useEffect(() => {
    const timers = [
      setTimeout(() => setStage(1), TO_LOCKUP_MS),
      setTimeout(() => setStage(2), TO_FADE_MS),
      setTimeout(() => setStage(3), TO_DONE_MS),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  if (stage === 3) return null;

  const cls = ['hp-splash', stage >= 1 && 'hp-splash-lockup', stage >= 2 && 'hp-splash-out'].filter(Boolean).join(' ');

  return (
    <div className={cls} aria-hidden="true">
      <img src="/brand/icon.png" alt="" className="hp-splash-icon" />
      <img src="/brand/lockup-white.png" alt="" className="hp-splash-lockup-img" />
    </div>
  );
}
