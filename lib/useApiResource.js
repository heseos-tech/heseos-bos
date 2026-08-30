'use client';
// Shared client-side cache for GET API calls (leads, partners, employees, ...).
//
// Admin, Team and Partner are all single-page apps now (AdminHome/TeamHome/PartnerHome — every
// tab lazy-mounts once and then stays mounted, never unmounting). Before this hook, every tab
// component fetched its own data independently on mount: e.g. Admin's Dashboard, Leads,
// Pre-sales, Sales Engineers, Partners and Reports tabs each called GET /api/leads on their own
// — six separate full, unfiltered fetches of the same table as an admin visits each tab once —
// and several of them (Team's Home/Leads, the desktop employee panels) also poll independently
// every 15-20s, so simultaneously-mounted tabs duplicated that traffic too. That's what made
// "loading speed of data like leads" feel slow: switching to a not-yet-visited tab always meant
// a brand new network+DB round trip, even though a sibling tab had just fetched the exact same
// data moments earlier.
//
// This hook makes every consumer of the same URL share one in-memory cache, one in-flight
// request (concurrent callers dedupe into a single fetch), and one invalidation path — a tab
// switch to already-cached data is instant, and a mutation on one tab can refresh every other
// mounted tab watching the same URL instead of each waiting out its own poll interval.
import { useEffect, useState, useCallback } from 'react';

const cache = new Map(); // url -> last successful parsed response
const inFlight = new Map(); // url -> in-progress fetch promise, shared by concurrent callers
const subscribers = new Map(); // url -> Set<(data) => void>

function notify(url) {
  const set = subscribers.get(url);
  if (set) set.forEach((fn) => fn(cache.get(url)));
}

function load(url) {
  if (inFlight.has(url)) return inFlight.get(url);
  const p = fetch(url)
    .then((r) => (r.ok ? r.json() : []))
    .then((data) => {
      cache.set(url, data);
      notify(url);
      return data;
    })
    .catch(() => cache.get(url) || [])
    .finally(() => inFlight.delete(url));
  inFlight.set(url, p);
  return p;
}

// pollMs: re-fetches this URL on an interval while this component is mounted. Concurrent
// pollers for the same URL (e.g. Team's Home and Leads tabs both open, both wanting /api/leads)
// dedupe into one request per tick instead of two — see load() above.
export function useApiResource(url, { pollMs } = {}) {
  const [data, setData] = useState(() => cache.get(url));
  const [loading, setLoading] = useState(() => !cache.has(url));

  useEffect(() => {
    let set = subscribers.get(url);
    if (!set) { set = new Set(); subscribers.set(url, set); }
    const onUpdate = (d) => { setData(d); setLoading(false); };
    set.add(onUpdate);
    if (cache.has(url)) onUpdate(cache.get(url));
    else load(url);
    return () => { set.delete(onUpdate); };
  }, [url]);

  useEffect(() => {
    if (!pollMs) return undefined;
    const t = setInterval(() => load(url), pollMs);
    return () => clearInterval(t);
  }, [url, pollMs]);

  const refresh = useCallback(() => load(url), [url]);
  return { data: data || [], loading, refresh };
}

// Call after a mutation (status change, assignment, claim, a new lead/partner/employee saved)
// so every mounted screen watching that URL — not just the one that made the change — picks up
// the update right away instead of waiting for its own next poll.
export function invalidate(url) {
  return load(url);
}
