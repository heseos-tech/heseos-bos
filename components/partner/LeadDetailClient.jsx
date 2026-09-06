'use client';
// Client-side fetch wrapper for /partner/leads/[id] — replaces the old server component that
// did `await getPartner()` then `await dbGetById('leads', id)` sequentially before sending any
// HTML (two DB round trips, back to back, on every single lead tap). The existing
// /api/leads/[id] GET route already does its own server-side auth + ownership check (see that
// route), so this just calls it from the client the way every other screen in this app already
// fetches its data — the shell (header, back button) paints instantly and only the lead body
// waits on the network.
import { useEffect, useState } from 'react';
import LeadDetailScreen from './LeadDetailScreen';
import { ScreenHeader } from './ui';

export default function LeadDetailClient({ id }) {
  const [state, setState] = useState({ status: 'loading', lead: null });

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/leads/${id}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((lead) => {
        if (!cancelled) setState({ status: 'ready', lead });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error', lead: null });
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (state.status === 'loading') {
    return (
      <>
        <ScreenHeader title="Lead Detail" backHref="/partner/home?tab=leads" />
        <div className="hp-empty"><div className="hp-empty-sub">Loading…</div></div>
      </>
    );
  }
  if (state.status === 'error') {
    return (
      <>
        <ScreenHeader title="Lead Detail" backHref="/partner/home?tab=leads" />
        <div className="hp-empty"><div className="hp-empty-sub">This lead couldn't be found.</div></div>
      </>
    );
  }
  return <LeadDetailScreen lead={state.lead} />;
}
