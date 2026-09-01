'use client';
// Flow Builder's landing screen — every flow a tenant has built, with quick enable/duplicate/
// delete actions, and a "+ New Flow" button that creates a blank one and jumps straight into its
// canvas (components/bot/FlowBuilderScreen.jsx). Triggers are summarised as badges here so a
// tenant can see at a glance what fires each flow without opening it — see
// lib/botFlowEngine.js's pickFlow() for the actual matching logic those triggers drive.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Topbar } from './ConsoleShell';
import { Badge, Switch } from './ui';
import { IconFlow, IconPlus, IconEdit, IconCopy, IconTrash } from './icons';

function triggerSummary(flow) {
  const t = flow.triggers || {};
  const items = [];
  if ((t.attribution || []).includes('qr')) items.push({ tone: 'teal', label: 'QR scan' });
  if ((t.attribution || []).includes('referral')) items.push({ tone: 'amber', label: 'Referral' });
  if ((t.keywords || []).length) items.push({ tone: 'gray', label: `${t.keywords.length} keyword${t.keywords.length === 1 ? '' : 's'}` });
  if (t.isDefault) items.push({ tone: 'green', label: 'Fallback' });
  return items;
}

export default function FlowListScreen({ tenant, flows: initialFlows }) {
  const router = useRouter();
  const [flows, setFlows] = useState(initialFlows || []);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [armedDelete, setArmedDelete] = useState('');

  async function createFlow() {
    setCreating(true);
    try {
      const res = await fetch('/api/bot/flow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Untitled Flow' }),
      });
      const flow = await res.json().catch(() => ({}));
      if (res.ok && flow?.id) router.push(`/bot/console/flow-builder/${flow.id}`);
    } finally {
      setCreating(false);
    }
  }

  async function duplicateFlow(flow) {
    setBusyId(flow.id);
    try {
      const res = await fetch('/api/bot/flow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `Copy of ${flow.name || 'Untitled Flow'}`, nodes: flow.nodes, edges: flow.edges, triggers: flow.triggers }),
      });
      const copy = await res.json().catch(() => ({}));
      if (res.ok && copy?.id) setFlows((fs) => [...fs, copy]);
    } finally {
      setBusyId('');
    }
  }

  // Sends only `enabled` — the PUT route keeps every other field (nodes, edges, name,
  // triggers) exactly as saved when it's omitted from the body, so a quick toggle from this list
  // can never clobber edits made in the canvas (components/bot/FlowBuilderScreen.jsx) that this
  // list's own cached copy of the flow hasn't seen yet.
  async function toggleEnabled(flow) {
    setBusyId(flow.id);
    try {
      const res = await fetch(`/api/bot/flow/${flow.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !flow.enabled }),
      });
      const updated = await res.json().catch(() => ({}));
      if (res.ok) setFlows((fs) => fs.map((f) => (f.id === flow.id ? updated : f)));
    } finally {
      setBusyId('');
    }
  }

  async function deleteFlow(flow) {
    if (armedDelete !== flow.id) {
      setArmedDelete(flow.id);
      setTimeout(() => setArmedDelete((v) => (v === flow.id ? '' : v)), 3500);
      return;
    }
    setBusyId(flow.id);
    try {
      await fetch(`/api/bot/flow/${flow.id}`, { method: 'DELETE' });
      setFlows((fs) => fs.filter((f) => f.id !== flow.id));
    } finally {
      setBusyId('');
      setArmedDelete('');
    }
  }

  return (
    <>
      <Topbar title="Flow Builder" />
      <div className="bc-page">
        <div className="fb-list-head">
          <div>
            <div className="fb-list-title">Your flows</div>
            <div className="bc-card-sub" style={{ marginBottom: 0 }}>Build a self-service conversation the bot follows for chats that match its triggers — QR scans, referral links, a keyword, or a fallback for everything else.</div>
          </div>
          <button type="button" className="bc-btn bc-btn-primary bc-btn-sm" onClick={createFlow} disabled={creating}><IconPlus size={14} /> New Flow</button>
        </div>

        {flows.length === 0 && (
          <div className="bc-card fb-list-empty">
            <IconFlow size={28} />
            <div className="fb-list-empty-title">No flows yet</div>
            <div className="fb-list-empty-sub">Flows are optional — until you build one and switch it on, your bot keeps using the Welcome Message and Quick Menu from Bot Configuration.</div>
          </div>
        )}

        {flows.map((flow) => {
          const badges = triggerSummary(flow);
          return (
            <div key={flow.id} className="bc-card fb-list-row">
              <div className="fb-list-row-main">
                <Link href={`/bot/console/flow-builder/${flow.id}`} className="fb-list-row-name">{flow.name || 'Untitled Flow'}</Link>
                <div className="fb-list-row-meta">
                  <span className={`fb-status-pill ${flow.enabled ? 'on' : 'off'}`}>{flow.enabled ? 'Live' : 'Draft'}</span>
                  {badges.map((b, i) => <Badge key={i} tone={b.tone}>{b.label}</Badge>)}
                  {badges.length === 0 && <span className="bc-hint" style={{ margin: 0 }}>No triggers set — won't run automatically</span>}
                </div>
              </div>
              <div className="fb-list-row-actions">
                <Switch checked={!!flow.enabled} onChange={() => toggleEnabled(flow)} label={`${flow.enabled ? 'Disable' : 'Enable'} ${flow.name || 'flow'}`} />
                <Link href={`/bot/console/flow-builder/${flow.id}`} className="bc-icon-btn" aria-label="Edit flow"><IconEdit size={15} /></Link>
                <button type="button" className="bc-icon-btn" onClick={() => duplicateFlow(flow)} disabled={busyId === flow.id} aria-label="Duplicate flow"><IconCopy size={15} /></button>
                <button
                  type="button"
                  className={`bc-icon-btn${armedDelete === flow.id ? ' fb-danger' : ''}`}
                  onClick={() => deleteFlow(flow)}
                  disabled={busyId === flow.id}
                  aria-label="Delete flow"
                  title={armedDelete === flow.id ? 'Click again to confirm delete' : 'Delete flow'}
                >
                  <IconTrash size={15} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
