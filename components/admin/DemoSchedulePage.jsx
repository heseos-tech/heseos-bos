'use client';
// components/admin/DemoSchedulePage.jsx — Admin -> Demo Schedule: a day-grouped view of every
// scheduled demo, filterable by sales engineer and date scope. No new table — this is purely a
// derived read view (mirrors DashboardPage/ReportsPage) over the same demoDate/demoTime/
// demoAddress/salesEngineerId fields the desktop Pre-sales/Sales Engineer panels already write
// on each lead via app/api/leads. The first of the four remaining "coming soon" stubs to ship,
// picked first because it needed no schema decisions (Conversions and Payouts do).
import { useMemo, useState } from 'react';
import { fmtDate } from '@/lib/date';
import { displayStatus, needsReschedule } from '@/lib/leadStage';
import { PRODUCT_INTEREST } from '@/lib/formOptions';
import { StatCard, StatusBadge } from './ui';
import { IconDemo, IconSearch, IconLeads, IconConversions } from './icons';
import { useApiResource } from '@/lib/useApiResource';

const PI_LABEL = Object.fromEntries(PRODUCT_INTEREST.map((p) => [p.v, p.l]));
const DAY = 24 * 60 * 60 * 1000;

function dateKey(d) { return new Date(d).toDateString(); }

export default function DemoSchedulePage() {
  const { data: leads, loading: leadsLoading } = useApiResource('/api/leads');
  const { data: employees, loading: employeesLoading } = useApiResource('/api/admin/employees');
  const loading = leadsLoading || employeesLoading;
  const [scope, setScope] = useState('upcoming'); // upcoming | today | reschedule | past | all
  const [engineerId, setEngineerId] = useState('all');
  const [q, setQ] = useState('');

  const engineers = useMemo(() => employees.filter((e) => e.role === 'sales_engineer'), [employees]);
  const engineerName = (id) => employees.find((e) => e.id === id)?.name || null;

  // Every lead that has ever had a demo date set — includes rescheduled, completed and lost
  // demos, not just ones still pending; the scope filter below narrows that down.
  const demos = useMemo(() => leads.filter((l) => l.demoDate), [leads]);

  const todayKey = new Date().toDateString();
  const startOfToday = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }, []);

  const todayCount = useMemo(() => demos.filter((l) => dateKey(l.demoDate) === todayKey).length, [demos, todayKey]);
  const weekCount = useMemo(() => demos.filter((l) => {
    const t = new Date(l.demoDate).getTime();
    return t >= startOfToday && t < startOfToday + 7 * DAY;
  }).length, [demos, startOfToday]);
  const rescheduleCount = useMemo(() => demos.filter(needsReschedule).length, [demos]);
  const unclaimedCount = useMemo(() => demos.filter((l) => !l.salesEngineerId).length, [demos]);

  const filtered = useMemo(() => demos
    .filter((l) => {
      if (engineerId !== 'all' && l.salesEngineerId !== engineerId) return false;
      if (scope === 'today' && dateKey(l.demoDate) !== todayKey) return false;
      if (scope === 'upcoming' && new Date(l.demoDate).setHours(0, 0, 0, 0) < startOfToday) return false;
      if (scope === 'past' && new Date(l.demoDate).setHours(0, 0, 0, 0) >= startOfToday) return false;
      if (scope === 'reschedule' && !needsReschedule(l)) return false;
      if (q.trim()) {
        const s = q.trim().toLowerCase();
        if (!(`${l.name} ${l.phone} ${l.city}`.toLowerCase().includes(s))) return false;
      }
      return true;
    })
    .sort((a, b) => new Date(`${a.demoDate}T${a.demoTime || '00:00'}`) - new Date(`${b.demoDate}T${b.demoTime || '00:00'}`)),
  [demos, engineerId, scope, q, todayKey, startOfToday]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const l of filtered) {
      const k = dateKey(l.demoDate);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(l);
    }
    return [...map.entries()];
  }, [filtered]);

  return (
    <>
      <div className="adm-page-head">
        <div><h1 className="adm-h1">Demo Schedule</h1><p className="adm-page-sub">Every scheduled demo, by date and sales engineer</p></div>
      </div>

      <div className="adm-stat-row">
        <StatCard label="Today" value={todayCount} Icon={IconDemo} tone="orange" />
        <StatCard label="This Week" value={weekCount} Icon={IconDemo} tone="blue" />
        <StatCard label="Needs Reschedule" value={rescheduleCount} Icon={IconConversions} tone="purple" />
        <StatCard label="Unclaimed" value={unclaimedCount} Icon={IconLeads} tone="teal" />
      </div>

      <div className="adm-card">
        <div className="adm-toolbar">
          <div className="adm-search adm-search--inline"><IconSearch size={16} /><input placeholder="Search by lead, phone or city…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <select value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="upcoming">Upcoming</option>
            <option value="today">Today</option>
            <option value="reschedule">Needs Reschedule</option>
            <option value="past">Past</option>
            <option value="all">All</option>
          </select>
          <select value={engineerId} onChange={(e) => setEngineerId(e.target.value)}>
            <option value="all">All Engineers</option>
            {engineers.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="adm-empty">Loading…</div>
        ) : grouped.length === 0 ? (
          <div className="adm-empty">No demos match these filters.</div>
        ) : (
          <div className="demo-schedule-list">
            {grouped.map(([day, rows]) => (
              <div className="demo-day-group" key={day}>
                <div className="demo-day-label">{day === todayKey ? 'Today' : fmtDate(rows[0].demoDate)}</div>
                {rows.map((l) => {
                  const status = displayStatus(l);
                  const engName = engineerName(l.salesEngineerId);
                  return (
                    <div className="demo-row" key={l.id}>
                      <div className="demo-row-time">{l.demoTime || '—'}</div>
                      <div className="demo-row-body">
                        <div className="demo-row-name">{l.name} <span className="demo-row-city">· {l.city}</span></div>
                        <div className="demo-row-meta">{(l.productInterest || []).map((p) => PI_LABEL[p] || p).join(', ') || '—'}{l.demoAddress ? ` · ${l.demoAddress}` : ''}</div>
                      </div>
                      <div className="demo-row-engineer">{engName || <span className="demo-row-unclaimed">Unclaimed</span>}</div>
                      <StatusBadge status={status} />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
