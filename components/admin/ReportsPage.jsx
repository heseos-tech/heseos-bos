'use client';
// Real Reports page — revenue rolled up from finalPrice on converted leads (never
// quotationAmount, which is pipeline/potential value, not booked revenue). Everything here is
// derived by lib/adminMetrics.js from the same /api/leads and /api/admin/employees data every
// other admin page already uses — nothing fabricated.
import { useState, useMemo } from 'react';
import {
  revenueOverview, revenueByMonth, revenueBySource, revenueByEngineer, revenueByCity, filterByRange,
} from '@/lib/adminMetrics';
import { StatCard, Donut, DonutLegend } from './ui';
import { IconConversions, IconQuotation, IconSalesEngineer, IconLeads, IconDownload } from './icons';
import { useApiResource } from '@/lib/useApiResource';

const RANGES = [
  { key: 'all', label: 'All Time' },
  { key: 'this_month', label: 'This Month' },
  { key: 'last_3_months', label: 'Last 3 Months' },
  { key: 'last_6_months', label: 'Last 6 Months' },
  { key: 'this_year', label: 'This Year' },
];

function inr(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

export default function ReportsPage() {
  // Shared with every other Admin tab via useApiResource (lib/useApiResource.js) — see
  // DashboardPage.jsx for why.
  const { data: leads, loading: leadsLoading } = useApiResource('/api/leads');
  const { data: employees, loading: employeesLoading } = useApiResource('/api/admin/employees');
  const loading = leadsLoading || employeesLoading;
  const [range, setRange] = useState('all');

  const scoped = useMemo(() => filterByRange(leads, range), [leads, range]);
  const overview = useMemo(() => revenueOverview(scoped), [scoped]);
  const trend = useMemo(() => revenueByMonth(leads, 6), [leads]); // always the real last-6-months rolling window
  const bySource = useMemo(() => revenueBySource(scoped), [scoped]);
  const byEngineer = useMemo(() => revenueByEngineer(scoped, employees), [scoped, employees]);
  const byCity = useMemo(() => revenueByCity(scoped), [scoped]);

  const trendMax = Math.max(1, ...trend.map((t) => t.revenue));

  function exportCsv() {
    const cols = ['id', 'name', 'city', 'source', 'salesEngineer', 'quotationAmount', 'quotationRevisions', 'finalPrice', 'convertedAt'];
    const engineerName = (id) => employees.find((e) => e.id === id)?.name || '';
    const rows = scoped.map((l) => [
      l.id, l.name, l.city, l.source, engineerName(l.salesEngineerId),
      l.quotationAmount ?? '', (l.quotationRevisions || []).length, l.finalPrice ?? '', l.convertedAt || '',
    ]);
    const csv = [cols.join(','), ...rows.map((r) => r.map((v) => `"${String(v ?? '')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'heseos-revenue-report.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="adm-page-head">
        <div><h1 className="adm-h1">Reports</h1><p className="adm-page-sub">Revenue booked from closed deals — quotations are pipeline, not revenue, until a lead converts</p></div>
        <div className="adm-page-head-actions">
          <select value={range} onChange={(e) => setRange(e.target.value)}>
            {RANGES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
          <button className="adm-btn-outline" onClick={exportCsv}><IconDownload size={15} /> Export</button>
        </div>
      </div>

      {loading ? (
        <div className="adm-card"><div className="adm-empty">Loading…</div></div>
      ) : (
        <>
          <div className="adm-stat-row">
            <StatCard label="Total Revenue" value={inr(overview.totalRevenue)} Icon={IconConversions} tone="green" />
            <StatCard label="Deals Closed" value={overview.dealsClosed} Icon={IconConversions} tone="orange" />
            <StatCard label="Avg Deal Size" value={inr(overview.avgDealSize)} Icon={IconSalesEngineer} tone="blue" />
            <StatCard label="Pipeline (Quoted)" value={inr(overview.totalQuoted)} Icon={IconQuotation} tone="purple" />
            <StatCard label="Conversion Rate" value={`${overview.conversionRate}%`} Icon={IconLeads} tone="teal" />
            <StatCard label="Avg Negotiated Down" value={`${overview.avgDiscountPct}%`} Icon={IconQuotation} tone="orange" />
          </div>

          <div className="adm-grid-2">
            <div className="adm-card">
              <div className="adm-card-title-row"><div className="adm-card-title">Revenue — Last 6 Months</div></div>
              <div className="adm-card-sub">Booked by conversion date, regardless of the filter above</div>
              <div className="adm-funnel">
                {trend.map((t) => (
                  <div className="adm-funnel-row" key={t.key}>
                    <span className="adm-funnel-label">{t.label}</span>
                    <div className="adm-funnel-track">
                      <div className="adm-funnel-bar" style={{ width: `${Math.max(t.revenue ? 4 : 0, (t.revenue / trendMax) * 100)}%`, background: 'var(--adm-orange)' }} />
                    </div>
                    <span className="adm-funnel-count">{inr(t.revenue)}</span>
                    <span className="adm-funnel-pct">{t.deals} deal{t.deals === 1 ? '' : 's'}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="adm-card">
              <div className="adm-card-title-row"><div className="adm-card-title">Revenue by Source</div></div>
              <div className="adm-card-sub">Share of booked revenue, not lead count</div>
              {bySource.length === 0 ? (
                <div className="adm-empty">No converted deals in this range yet.</div>
              ) : (
                <div className="adm-donut-row">
                  <Donut rows={bySource} centerLabel="Revenue" />
                  <DonutLegend rows={bySource.map((r) => ({ ...r, count: inr(r.count) }))} />
                </div>
              )}
            </div>
          </div>

          <div className="adm-grid-2">
            <div className="adm-card">
              <div className="adm-card-title-row"><div className="adm-card-title">Revenue by Sales Engineer</div></div>
              <div className="adm-card-sub">Closed deals credited to whoever claimed and converted them</div>
              <div className="adm-table-scroll">
                <table className="adm-table">
                  <thead><tr><th>Engineer</th><th>City</th><th>Deals Closed</th><th>Revenue</th><th>Avg Deal Size</th></tr></thead>
                  <tbody>
                    {byEngineer.length === 0 ? <tr><td colSpan={5} className="adm-empty">No sales engineers yet.</td></tr> : byEngineer.map((r) => (
                      <tr key={r.id}>
                        <td><div className="adm-lead-name">{r.name}</div></td>
                        <td>{r.location || '—'}</td>
                        <td>{r.deals}</td>
                        <td>{inr(r.revenue)}</td>
                        <td>{r.deals ? inr(r.avgDealSize) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="adm-card">
              <div className="adm-card-title-row"><div className="adm-card-title">Revenue by City</div></div>
              <div className="adm-card-sub">Where the business is actually coming from</div>
              <div className="adm-table-scroll">
                <table className="adm-table">
                  <thead><tr><th>City</th><th>Leads</th><th>Converted</th><th>Conv. Rate</th><th>Revenue</th></tr></thead>
                  <tbody>
                    {byCity.length === 0 ? <tr><td colSpan={5} className="adm-empty">No leads in this range.</td></tr> : byCity.map((r) => (
                      <tr key={r.city}>
                        <td><div className="adm-lead-name">{r.city}</div></td>
                        <td>{r.leads}</td>
                        <td>{r.converted}</td>
                        <td>{r.conversionRate}%</td>
                        <td>{inr(r.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
