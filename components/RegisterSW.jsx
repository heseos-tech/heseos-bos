'use client';
import { useEffect } from 'react';

// Registers the shared service worker (public/sw.js) — it only actively caches inside
// /employee and /partner (see the worker itself), so this is safe to mount in both layouts.
export default function RegisterSW() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);
  return null;
}
