'use client';
// Installer app -> Jobs. "Available" works like claiming demos in the Team app: every job in your
// city that Operations has given a date and a fee shows here, first to claim gets it. Claimed jobs
// move to "My jobs" with the customer's phone and full address; "Completed" shows what you've
// finished and whether the fee has been paid out yet.
import { useMemo, useState } from 'react';
import { ScreenHeader } from '@/components/partner/ui';
import { IconOrders } from '@/components/admin/icons';
import { IconPhone, IconMapPin, IconCalendar, IconCheck } from '@/components/partner/icons';
import { useJobs, jobAction, money, telHref, waHref, mapsHref, fmtDate, dueTag, stageLabel, kindLabel } from './jobUtils';

const TABS = [
  { key: 'available', label: 'Available' },
  { key: 'mine', label: 'My jobs' },
  { key: 'done', label: 'Completed' },
];
const PAYOUT = { pending: ['Payout pending', 'due'], processing: ['Payout processing', 'due'], paid: ['Paid', 'paid'] };

export default function JobsScreen({ partner, embedded = false }) {
  const { available, mine, loading } = useJobs();
  const [tab, setTab] = useState('available');
  const [busy, setBusy] = useState('');
  const [toast, setToast] = useState('');
  const active = useMemo(() => mine.filter((j) => !j.done), [mine]);
  const done = useMemo(() => mine.filter((j) => j.done), [mine]);
  const lists = { available, mine: active, done };
  const counts = { available: available.length, mine: active.length, done: done.length };
  const rows = lists[tab];

  function flash(msg) { setToast(msg); setTimeout(() => setToast(''), 3500); }

  async function run(action, job, confirmMsg, okMsg) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(`${job.kind}:${job.id}`);
    const r = await jobAction(action, job);
    setBusy('');
    if (r.ok) { flash(okMsg); if (action === 'claim') setTab('mine'); } else flash(r.error);
  }

  const noCity = !String(partner?.city || '').trim();

  return (
    <>
      {embedded
        ? <div className="hp-header" style={{ paddingBottom: 4 }}><div className="hp-header-title" style={{ fontSize: 21, fontWeight: 800 }}>Installation Jobs</div></div>
        : <ScreenHeader title="Installation Jobs" backHref="/installer/home" />}

      <div className="hp-tabs">
        {TABS.map((t) => (
          <button key={t.key} type="button" className={`hp-tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label} <span className="ops-count">{counts[t.key]}</span>
          </button>
        ))}
      </div>

      {noCity && tab === 'available' && (
        <div className="ops-banner"><IconMapPin size={16} /><span>Your profile has no city yet — ask Heseos to set it so jobs in your city show up here.</span></div>
      )}

      {loading ? (
        <div className="hp-empty"><div className="hp-empty-sub">Loading…</div></div>
      ) : rows.length === 0 ? (
        <div className="hp-empty">
          <div className="hp-empty-icon"><IconOrders size={24} /></div>
          <div className="hp-empty-title">{tab === 'available' ? 'No jobs available right now' : tab === 'mine' ? 'No active jobs' : 'Nothing completed yet'}</div>
          <div className="hp-empty-sub">{tab === 'available' ? 'New installations in your city appear here as soon as Heseos schedules them.' : tab === 'mine' ? 'Claim a job from the Available tab.' : 'Jobs you finish will show up here with their payout status.'}</div>
        </div>
      ) : (
        <div className="ops-list">
          {rows.map((j) => (
            <JobCard
              key={`${j.kind}:${j.id}`}
              job={j}
              mode={tab}
              busy={busy === `${j.kind}:${j.id}`}
              onClaim={() => run('claim', j, `Claim this installation on ${fmtDate(j.installDate)}? You'll earn ${money(j.fee)} once it's completed.`, 'Job claimed — it is now in My jobs')}
              onRelease={() => run('release', j, 'Give this job back? It becomes available to other installers again.', 'Job released')}
              onComplete={() => run('complete', j, `Mark this installation complete? Your fee of ${money(j.fee)} is added to your payouts.`, 'Marked complete — your fee is now pending payout')}
            />
          ))}
        </div>
      )}

      {toast && <div className="hp-toast">{toast}</div>}
    </>
  );
}

function JobCard({ job: j, mode, busy, onClaim, onRelease, onComplete }) {
  const due = j.installDate && !j.done ? dueTag(j.installDate) : '';
  const payout = j.done ? PAYOUT[j.payoutStatus] || PAYOUT.pending : null;
  return (
    <div className="ops-card">
      <div className="ops-card-top">
        <div>
          <div className="ops-id">{kindLabel(j)} · {j.ref}</div>
          <div className="ops-name">{mode === 'available' ? (j.area || 'Your city') : (j.customerName || 'Customer')}</div>
        </div>
        <div className="ins-fee">
          <span className="ins-fee-label">{j.done ? 'Earned' : 'You earn'}</span>
          <span className="ins-fee-val">{money(j.fee)}</span>
        </div>
      </div>

      <div className={`ops-install ${due}`}>
        <IconCalendar size={14} />
        <span>{fmtDate(j.installDate)}{j.installSlot ? ` · ${j.installSlot}` : ''}{due === 'overdue' ? ' · overdue' : due === 'today' ? ' · today' : ''}</span>
      </div>

      {j.items.length > 0 && (
        <div className="ins-items">
          <div className="ins-items-title">Products to install</div>
          {j.items.map((it, i) => <div key={i} className="ins-item"><span>{it.name}</span><strong>× {it.qty}</strong></div>)}
        </div>
      )}
      {stageLabel(j) && <div className="ops-line">{stageLabel(j)}</div>}

      {mode !== 'available' && (
        <>
          {j.address && <div className="ops-line" style={{ color: '#fff' }}>{j.address}</div>}
          {!j.done && (
            <div className="ops-contact">
              <a className="ops-contact-btn" href={telHref(j.phone)}><IconPhone size={15} /> Call</a>
              <a className="ops-contact-btn" href={waHref(j.phone)} target="_blank" rel="noreferrer">WhatsApp</a>
              {j.address && <a className="ops-contact-btn" href={mapsHref(j.address)} target="_blank" rel="noreferrer"><IconMapPin size={15} /> Map</a>}
            </div>
          )}
          {j.notes ? <div className="ops-line">Note: {j.notes}</div> : null}
        </>
      )}

      {payout && <div className="ops-meta"><span className={`ops-pay ${payout[1]}`}>{payout[0]}</span></div>}

      <div className="ops-actions">
        {mode === 'available' && <button type="button" className="hp-btn hp-btn-primary hp-btn-sm" disabled={busy} onClick={onClaim}>{busy ? 'Claiming…' : 'Claim this job'}</button>}
        {mode === 'mine' && (
          <>
            <button type="button" className="hp-btn hp-btn-primary hp-btn-sm" disabled={busy} onClick={onComplete}><IconCheck size={14} /> {busy ? 'Saving…' : 'Mark installed'}</button>
            <button type="button" className="hp-btn hp-btn-outline hp-btn-sm" disabled={busy} onClick={onRelease}>Release</button>
          </>
        )}
      </div>
    </div>
  );
}
