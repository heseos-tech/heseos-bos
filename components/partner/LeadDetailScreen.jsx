'use client';
import { useState } from 'react';
import { Avatar, StatusBadge, ScreenHeader, Button } from './ui';
import { IconPhone, IconMapPin, IconBuilding, IconLayers, IconWallet, IconCalendar, IconSource, IconNote, IconShare, IconCheck } from './icons';
import { fmtDateTime } from '@/lib/date';
import { partnerStatusOf, PROPERTY_TYPE_LABEL, CONFIGURATION_LABEL, TIMELINE_LABEL, REFERRAL_SOURCE_LABEL, budgetLabel } from '@/lib/partnerMock';

export default function LeadDetailScreen({ lead }) {
  const [shared, setShared] = useState(false);
  const status = partnerStatusOf(lead);
  const history = Array.isArray(lead.history) && lead.history.length ? lead.history : [{ at: lead.createdAt, event: 'Lead Punched', by: 'You', note: '' }];

  async function share() {
    const text = `Heseos Lead ${lead.id}\n${lead.name} · ${lead.phone}\n${PROPERTY_TYPE_LABEL[lead.propertyType] || ''} — ${lead.city}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `Lead ${lead.id}`, text });
      } else {
        await navigator.clipboard.writeText(text);
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      }
    } catch { /* user cancelled share sheet — nothing to do */ }
  }

  const summary = [
    { icon: <IconBuilding size={16} />, label: 'Property Type', val: PROPERTY_TYPE_LABEL[lead.propertyType] || '—' },
    { icon: <IconLayers size={16} />, label: 'Configuration', val: CONFIGURATION_LABEL[lead.configuration] || '—' },
    { icon: <IconWallet size={16} />, label: 'Budget Range', val: budgetLabel(lead.propertyType, lead.budget) },
    { icon: <IconCalendar size={16} />, label: 'Timeline', val: TIMELINE_LABEL[lead.timeline] || '—' },
    { icon: <IconSource size={16} />, label: 'Source', val: REFERRAL_SOURCE_LABEL[lead.referralSource] || '—' },
  ];

  return (
    <>
      <ScreenHeader title="Lead Details" backHref="/partner/home?tab=leads" />

      <div className="hp-detail-hero">
        <Avatar name={lead.name} size="lg" />
        <div style={{ flex: 1 }}>
          <div className="hp-detail-name">{lead.name}</div>
          <div className="hp-detail-id">Lead ID: {lead.id}</div>
          <div style={{ marginTop: 6 }}><StatusBadge status={status} /></div>
        </div>
      </div>

      <div className="hp-detail-line"><IconPhone size={16} /> {lead.phone}{lead.altPhone ? ` · ${lead.altPhone}` : ''}</div>
      <div className="hp-detail-line"><IconMapPin size={16} /> {lead.city}{lead.postcode ? ` — ${lead.postcode}` : ''}</div>

      <div className="hp-card" style={{ marginTop: 18 }}>
        <div className="hp-card-title">Requirement Summary</div>
        {summary.map((s) => (
          <div key={s.label} className="hp-summary-row">
            <span className="hp-summary-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{s.icon} {s.label}</span>
            <span className="hp-summary-val">{s.val}</span>
          </div>
        ))}
      </div>

      {lead.notes && (
        <div className="hp-card">
          <div className="hp-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}><IconNote size={16} /> Notes</div>
          <div className="hp-summary-label" style={{ lineHeight: 1.6 }}>{lead.notes}</div>
        </div>
      )}

      <div className="hp-card">
        <div className="hp-card-title">Activity Timeline</div>
        <div className="hp-timeline">
          {history.map((h, i) => (
            <div key={i} className="hp-timeline-item">
              <div className="hp-timeline-rail">
                <span className={`hp-timeline-dot${i === 0 ? ' done' : ''}`} />
                <span className="hp-timeline-line" />
              </div>
              <div>
                <div className="hp-timeline-event">{h.event}</div>
                <div className="hp-timeline-meta">{fmtDateTime(h.at)}</div>
                {h.note && <div className="hp-timeline-note">{h.note}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="hp-cta-block" style={{ paddingBottom: 24 }}>
        <Button block variant="outline" onClick={share}>
          {shared ? <><IconCheck size={16} /> Copied to clipboard</> : <><IconShare size={16} /> Share Lead</>}
        </Button>
      </div>
    </>
  );
}
