'use client';
// Client-side fetch wrapper for /team/leads/[id] — replaces the old server component that did
// `await getEmployee()` then `await dbGetById('leads', id)` sequentially (two DB round trips
// back to back before any HTML shipped, on every lead tap). Fetches from the existing
// /api/leads/[id] GET route the same way components/team/LeadDetailScreen.jsx already refetches
// after every action — then re-applies the exact same visibility rule the old server page used
// (pre-sales only ever sees leads assigned to them; a sales engineer sees leads already claimed
// by them, plus any open demo in their own city), PLUS any employee of any role viewing a lead
// they personally referred (addedByEmployeeId — Operations/Marketing/Management have no
// pipeline of their own, but still need to see the status of leads they added), so a shared
// link or a guessed URL still can't surface a lead outside an employee's own scope — and any
// lead sent by a partner this employee onboarded (partner.onboardedByEmployeeId, via
// /api/team/partners), which is how the Team-app partner dashboard links through to a lead's
// journey + details. Those are read-only for the onboarding employee: LeadDetailScreen only
// shows action buttons to the assigned pre-sales / sales engineer.
import { useEffect, useState } from 'react';
import { useEmployeeSession } from './ui';
import TeamLeadDetailScreen from './LeadDetailScreen';
import { ScreenHeader } from '@/components/partner/ui';

function norm(s) {
  return String(s || '').trim().toLowerCase();
}

function isVisible(employee, lead, partnerIds) {
  const isPresales = employee.role === 'presales';
  const isSE = employee.role === 'sales_engineer';
  return (
    (isPresales && lead.assignedTo === employee.id) ||
    (isSE && (lead.salesEngineerId === employee.id ||
      (lead.demoScheduledAt && !lead.salesEngineerId && norm(lead.city) === norm(employee.location)))) ||
    lead.addedByEmployeeId === employee.id ||
    (!!lead.partnerId && partnerIds.has(lead.partnerId))
  );
}

export default function LeadDetailClient({ id, fromPartner = null }) {
  const employee = useEmployeeSession();
  const [state, setState] = useState({ status: 'loading', lead: null });

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/leads/${id}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(async (lead) => {
        if (!lead) return { lead: null, ok: false };
        // Only look up this employee's onboarded partners when the lead isn't already visible
        // through the cheaper checks — saves a round trip on every ordinary lead open.
        let partnerIds = new Set();
        if (!isVisible(employee, lead, partnerIds) && lead.partnerId) {
          const partners = await fetch('/api/team/partners', { cache: 'no-store' })
            .then((r) => (r.ok ? r.json() : []))
            .catch(() => []);
          partnerIds = new Set((Array.isArray(partners) ? partners : []).map((p) => p.id));
        }
        return { lead, ok: isVisible(employee, lead, partnerIds) };
      })
      .then(({ lead, ok }) => {
        if (cancelled) return;
        if (!ok) {
          setState({ status: 'error', lead: null });
          return;
        }
        setState({ status: 'ready', lead });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error', lead: null });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, employee.id]);

  // Arrived from a partner dashboard -> Back returns there instead of the Leads tab.
  const backHref = fromPartner ? `/team/partners/${encodeURIComponent(fromPartner)}` : '/team/home?tab=leads';

  if (state.status === 'loading') {
    return (
      <>
        <ScreenHeader title="Lead Detail" backHref={backHref} />
        <div className="hp-empty"><div className="hp-empty-sub">Loading…</div></div>
      </>
    );
  }
  if (state.status === 'error') {
    return (
      <>
        <ScreenHeader title="Lead Detail" backHref={backHref} />
        <div className="hp-empty"><div className="hp-empty-sub">This lead couldn't be found.</div></div>
      </>
    );
  }
  return <TeamLeadDetailScreen employee={employee} lead={state.lead} backHref={fromPartner ? backHref : undefined} />;
}
