// Team-app "referrals" feed — every OPEN lead an employee has brought into the system, newest
// first: leads they added themselves (addedByEmployeeId) PLUS leads sent by any partner they
// onboarded (partner.onboardedByEmployeeId — /api/team/partners). Closed leads — Converted (won)
// or Rejected (lost/dead) — are dropped, since this feed is for what's still live in the pipeline.
// Used by the Home "Recent Referrals" section and the full /team/referrals list.
import { isLeadClosed } from '@/lib/leadStage';

export function activeReferrals(leads, employeeId, partnerIds) {
  return (leads || [])
    .filter((l) => (l.addedByEmployeeId === employeeId || (l.partnerId && partnerIds.has(l.partnerId))) && !isLeadClosed(l))
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

// 'self' = added by the employee directly; 'partner' = arrived through one of their partners.
export function referralKind(lead, partnerIds) {
  return lead.partnerId && partnerIds.has(lead.partnerId) ? 'partner' : 'self';
}
