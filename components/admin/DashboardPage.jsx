'use client';
import { useMemo } from 'react';
import Link from 'next/link';
import { fmtDateTime } from '@/lib/date';
import { IconLeads, IconPresales, IconDemo, IconQuotation, IconPartners, IconConversions, IconArrowUp } from './icons';
import { StatCard, Funnel, Donut, DonutLegend } from './ui';
import { funnelData, sourceBreakdown, recentActivity, windowDelta } from '@/lib/adminMetrics';
import { useApiResource } from '@/lib/useApiResource';

export default function DashboardPage({ employee }) {
  // Shared with every other Admin tab via useApiResource (lib/useApiResource.js) — since
  // Admin's tabs all stay mounted after their first visit (AdminHome), visiting Dashboard after
  // Leads (or vice versa) now reuses the already-cached /api/leads response instead of
  // re-fetching the whole table again.
  const { data: leads, loading: leadsLoading } = useApiResource('/api/leads');
  const { data: partners, loading: partnersLoading } = useApiResource('/api/admin/partners');
  const loading = leadsLoading || partnersLoading;

  const funnel = useMemo(() => funnelData(leads), [leads]);
  const bySource = useMemo(() => sourceBreakdown(leads), [leads]);
  const activity = useMemo(() => recentActivity(leads, 6), [leads]);

  const dTotal = useMemo(() => windowDelta(leads, 'createdAt'), [leads]);
  const dContacted = useMemo(() => windowDelta(leads, 'contactStageAt'), [leads]);
  const dDemo = useMemo(() => windowDelta(leads, 'demoScheduledAt'), [leads]);
  const dQuote = useMemo(() => windowDelta(leads, 'quotationSentAt'), [leads]);

  const contactedTotal = leads.filter((l) => l.contactStageAt).length;
  const demoTotal = leads.filter((l) => l.demoScheduledAt).length;
  const quoteTotal = leads.filter((l) => l.quotationSentAt).length;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = (employee.name || employee.email || '').split(' ')[0];
  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <>
      <div className="adm-page-head">
        <div>
          <h1 className="adm-greeting">{greeting}, {firstName} 👋</h1>
          <p className="adm-page-sub">Here&rsquo;s what&rsquo;s happening with your leads today.</p>
        </div>
        <div className="adm-date-chip">{today}</div>
      </div>

      <div className="adm-stat-row">
        <StatCard label="Total Leads" value={leads.length.toLocaleString('en-IN')} delta={dTotal.pct} Icon={IconLeads} tone="orange" />
        <StatCard label="Contacted" value={contactedTotal.toLocaleString('en-IN')} delta={dContacted.pct} Icon={IconPresales} tone="blue" />
        <StatCard label="Demo Scheduled" value={demoTotal.toLocaleString('en-IN')} delta={dDemo.pct} Icon={IconDemo} tone="purple" />
        <StatCard label="Quotations Sent" value={quoteTotal.toLocaleString('en-IN')} delta={dQuote.pct} Icon={IconQuotation} tone="teal" />
      </div>

      <div className="adm-grid-2">
        <div className="adm-card">
          <div className="adm-card-title">Lead Funnel</div>
          <div className="adm-card-sub">From inquiry to conversion</div>
          {loading ? <div className="adm-empty">Loading…</div> : <Funnel rows={funnel} />}
        </div>

        <div className="adm-card">
          <div className="adm-card-title">Leads by Source</div>
          {loading ? <div className="adm-empty">Loading…</div> : bySource.length === 0 ? <div className="adm-empty">No leads yet</div> : (
            <div className="adm-donut-row">
              <Donut rows={bySource} centerLabel="Total Leads" />
              <DonutLegend rows={bySource} />
            </div>
          )}
        </div>
      </div>

      <div className="adm-grid-2">
        <div className="adm-card">
          <div className="adm-card-title-row">
            <div className="adm-card-title">Recent Activity</div>
            <Link href="/admin?tab=leads" className="adm-link">View All</Link>
          </div>
          {loading ? <div className="adm-empty">Loading…</div> : activity.length === 0 ? <div className="adm-empty">Nothing yet — new leads will show up here.</div> : (
            <div className="adm-activity-list">
              {activity.map((a, i) => (
                <div className="adm-activity-row" key={i}>
                  <span className="adm-activity-icon"><IconArrowUp size={14} /></span>
                  <div className="adm-activity-body">
                    <div className="adm-activity-event">{a.event}</div>
                    <div className="adm-activity-lead">{a.leadName}{a.city ? ` • ${a.city}` : ''}</div>
                  </div>
                  <span className="adm-activity-time">{fmtDateTime(a.at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="adm-card">
          <div className="adm-card-title">Quick Actions</div>
          <div className="adm-quick-grid">
            <Link href="/admin?tab=partners" className="adm-quick-tile"><span className="adm-quick-icon"><IconPartners size={18} /></span><div><div className="adm-quick-title">Add Partner</div><div className="adm-quick-sub">Onboard new partners</div></div></Link>
            <Link href="/admin?tab=leads" className="adm-quick-tile"><span className="adm-quick-icon"><IconLeads size={18} /></span><div><div className="adm-quick-title">View Leads</div><div className="adm-quick-sub">Manage all leads</div></div></Link>
            <Link href="/admin?tab=leads&bucket=in_progress" className="adm-quick-tile"><span className="adm-quick-icon"><IconDemo size={18} /></span><div><div className="adm-quick-title">Schedule Demo</div><div className="adm-quick-sub">Assign to sales engineer</div></div></Link>
            <Link href="/admin?tab=leads&bucket=demo" className="adm-quick-tile"><span className="adm-quick-icon"><IconQuotation size={18} /></span><div><div className="adm-quick-title">Send Quotation</div><div className="adm-quick-sub">Follow up on demos</div></div></Link>
          </div>
        </div>
      </div>
    </>
  );
}
