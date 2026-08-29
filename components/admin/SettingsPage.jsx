'use client';
// Real Settings page — currently just the Meta Lead Ads connection, which is the one
// integration the admin asked to make self-service: connect a Page, then pick exactly which
// Lead Ad (Instant Form) forms are allowed to create leads.
import { useEffect, useState, useCallback } from 'react';

export default function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busyFormId, setBusyFormId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/meta');
    setSettings(res.ok ? await res.json() : null);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  function flash(msg) { setNotice(msg); setTimeout(() => setNotice(''), 3500); }

  async function connect() {
    setError(''); setConnecting(true);
    try {
      const res = await fetch('/api/admin/meta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pageAccessToken: token }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Could not connect.'); return; }
      setSettings(data); setToken('');
      flash(`Connected to ${data.pageName} — ${data.forms.length} lead form${data.forms.length === 1 ? '' : 's'} found`);
    } catch (e) {
      setError(e.message || 'Could not connect.');
    } finally { setConnecting(false); }
  }

  async function refreshForms() {
    setError(''); setRefreshing(true);
    try {
      const res = await fetch('/api/admin/meta', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'refresh' }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Could not refresh forms.'); return; }
      setSettings(data); flash('Lead forms refreshed');
    } finally { setRefreshing(false); }
  }

  async function toggleForm(form) {
    setBusyFormId(form.id); setError('');
    try {
      const res = await fetch('/api/admin/meta', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ formId: form.id, enabled: !form.enabled }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Could not update that form.'); return; }
      setSettings(data);
    } finally { setBusyFormId(null); }
  }

  async function disconnect() {
    if (!confirm('Disconnect this Meta Page? New leads will stop flowing in until you reconnect (or fall back to the server\'s META_LEAD_ACCESS_TOKEN, if one is set, capturing every form again).')) return;
    const res = await fetch('/api/admin/meta', { method: 'DELETE' });
    if (res.ok) { setSettings(await res.json()); flash('Disconnected from Meta'); }
  }

  return (
    <>
      <div className="adm-page-head">
        <div><h1 className="adm-h1">Settings</h1><p className="adm-page-sub">Organization, notification and integration settings</p></div>
      </div>

      {notice && <div className="adm-notice">{notice}</div>}

      <div className="adm-card adm-meta-card">
        <div className="adm-card-title-row">
          <div className="adm-card-title">Meta Lead Ads</div>
          {settings?.connected && <span className="adm-status-pill active">Connected</span>}
        </div>
        <p className="adm-card-sub">
          Pick exactly which Meta (Facebook &amp; Instagram) Instant Form ads should send leads into Heseos BOS. Only the forms you turn on below will create leads — everything else is ignored.
        </p>

        {loading ? (
          <div className="adm-empty">Loading…</div>
        ) : error ? (
          <div className="adm-notice adm-notice--error">{error}</div>
        ) : null}

        {!loading && !settings?.connected && (
          <div className="adm-meta-connect">
            <div className="lf-field">
              <label className="lf-label" htmlFor="meta-token">Page Access Token</label>
              <input
                id="meta-token"
                className="lf-input"
                type="password"
                autoComplete="off"
                placeholder="Paste your Page Access Token…"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </div>
            <p className="adm-meta-hint">
              Generate this for the Page running your lead ads (Meta Business Suite → System Users, or the Graph API Explorer) with the <code>leads_retrieval</code> and <code>pages_manage_ads</code> permissions.
              {settings?.usingEnvToken && ' Until you connect here, capture uses the META_LEAD_ACCESS_TOKEN set on the server — every form on the Page, no selection.'}
            </p>
            <button className="adm-btn-primary" disabled={connecting || !token.trim()} onClick={connect}>
              {connecting ? 'Connecting…' : 'Connect Page'}
            </button>
          </div>
        )}

        {!loading && settings?.connected && (
          <div>
            <div className="adm-meta-page-row">
              <div>
                <div className="adm-lead-name">{settings.pageName}</div>
                <div className="adm-lead-sub">Page ID {settings.pageId}{settings.connectedAt ? ` · connected ${new Date(settings.connectedAt).toLocaleDateString()}` : ''}</div>
              </div>
              <div className="adm-page-head-actions">
                <button className="adm-btn-outline" onClick={refreshForms} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh Forms'}</button>
                <button className="adm-btn-outline" onClick={disconnect}>Disconnect</button>
              </div>
            </div>

            <div className="adm-meta-forms">
              {(settings.forms || []).length === 0 ? (
                <div className="adm-empty">No lead forms found on this Page yet. Create one in Meta Ads Manager, then hit Refresh Forms.</div>
              ) : settings.forms.map((f) => (
                <div className="adm-meta-form-row" key={f.id}>
                  <div>
                    <div className="adm-lead-name">{f.name}</div>
                    <div className="adm-lead-sub">Form ID {f.id} · {f.status === 'ACTIVE' ? 'Active on Meta' : (f.status || 'Unknown status')}</div>
                  </div>
                  <label className={`adm-switch${f.enabled ? ' on' : ''}`}>
                    <input type="checkbox" checked={!!f.enabled} disabled={busyFormId === f.id} onChange={() => toggleForm(f)} />
                    <span className="adm-switch-track"><span className="adm-switch-thumb" /></span>
                  </label>
                </div>
              ))}
            </div>
            <p className="adm-meta-hint">A submission from a form that isn't toggled on is ignored entirely — it won't appear in Leads.</p>
          </div>
        )}
      </div>
    </>
  );
}
