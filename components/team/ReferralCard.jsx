'use client';
// One row of the Team-app referral feed (Home "Recent Referrals" + /team/referrals).
import Link from 'next/link';
import { Avatar } from '@/components/partner/ui';
import { fmtDateTime } from '@/lib/date';
import { displayStatus } from '@/lib/leadStage';
import { PROPERTY_TYPE } from '@/lib/formOptions';

const PT_LABEL = Object.fromEntries(PROPERTY_TYPE.map((p) => [p.v, p.l]));

// origin: "Added by you" or "via <partner>" — set by the caller from the partner map.
export default function ReferralCard({ lead, origin }) {
  const status = displayStatus(lead);
  return (
    <Link href={`/team/leads/${lead.id}`} className="hp-lead-card">
      <Avatar name={lead.name} />
      <div className="hp-lead-info">
        <div className="hp-lead-name">{lead.name}</div>
        <div className="hp-lead-meta">{PT_LABEL[lead.propertyType] || 'Enquiry'}{lead.city ? ` · ${lead.city}` : ''}</div>
        {origin ? <div className="hp-lead-meta">{origin}</div> : null}
      </div>
      <div className="hp-lead-right">
        <span className="hp-badge" style={{ color: status.c, background: status.bg }}><span className="hp-badge-dot" />{status.label}</span>
        <span className="hp-lead-time">{fmtDateTime(lead.createdAt)}</span>
      </div>
    </Link>
  );
}
