'use client';
// Real Settings page — currently just the Meta Lead Ads connection, which is the one
// integration the admin asked to make self-service: connect a Page, then pick exactly which
// Lead Ad (Instant Form) forms are allowed to create leads.
import { useEffect, useState, useCallback } from 'react';

const FORMS_PER_PAGE = 10;

export default function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busyFormId, setBusyFormId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [registeringWebhook, setRegisteringWebhook] = useState(false);
  const [formsPage, setFormsPage] = useState(1);

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

  async function registerWebhook() {
    setError(''); setRegisteringWebhook(true);
    try {
      const res = await fetch('/api/admin/meta', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'register_webhook' }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Could not register the webhook.'); return; }
      setSettings(data); flash('Webhook registered with Meta');
    } finally { setRegisteringWebhook(false); }
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

  const allForms = settings?.forms || [];
  const totalFormsPages = Math.max(1, Math.ceil(allForms.length / FORMS_PER_PAGE));
  const safeFormsPage = Math.min(formsPage, totalFormsPages);
  const pagedForms = allForms.slice((safeFormsPage - 1) * FORMS_PER_PAGE, safeFormsPage * FORMS_PER_PAGE);

  useEffect(() => { if (formsPage !== safeFormsPage) setFormsPage(safeFormsPage); }, [safeFormsPage, formsPage]);

  return (
    <>
      <div className="adm-page-head">
        <div><h1 className="adm-h1">Settings</h1><p className="adm-page-sub">Organization, notification and integration settings</p></div>
      </div>

      {notice && <div className="adm-notice">{notice}</div>}

      <BotSignupsCard />

      <CitiesCard />

      <div className="adm-card adm-meta-card">
        <div className="adm-card-title-row">
          <div className="adm-card-title">Meta Lead Ads</div>
          {settings?.connected && <span className="adm-status-pill active">Connected</span>}
        </div>
        <p className="adm-card-sub">
          Pick exactly which Meta (Facebook &amp; Instagram) Instant Form ads should send leads into Heseos BOS. Only the forms you turn on below will create leads — everything else is ignored.
        </p>

        {!loading && (
          <div className="adm-meta-webhook-row">
            <div>
              <div className="adm-lead-name">Webhook {settings?.webhookRegistered ? '— registered with Meta' : '— not registered yet'}</div>
              <div className="adm-lead-sub">
                {settings?.webhookRegistered
                  ? `Meta will call ${settings.webhookCallbackUrl || 'this app'} for new leads${settings.webhookRegisteredAt ? ` · set up ${new Date(settings.webhookRegisteredAt).toLocaleDateString()}` : ''}.`
                  : 'One-time, app-wide setup — tells Meta where to send lead events. Needs META_APP_ID, META_APP_SECRET, META_LEAD_VERIFY_TOKEN and PUBLIC_BASE_URL set on the server.'}
              </div>
            </div>
            <button className="adm-btn-outline" onClick={registerWebhook} disabled={registeringWebhook}>
              {registeringWebhook ? 'Registering…' : settings?.webhookRegistered ? 'Re-register' : 'Register Webhook'}
            </button>
          </div>
        )}

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
                <div className={`adm-lead-sub${settings.subscribed ? '' : ' adm-lead-sub--warn'}`}>
                  {settings.subscribed ? 'Page subscribed to leadgen events ✓' : `⚠ Page not subscribed yet${settings.subscribeError ? ` — ${settings.subscribeError}` : ''}. Try Refresh Forms.`}
                </div>
              </div>
              <div className="adm-page-head-actions">
                <button className="adm-btn-outline" onClick={refreshForms} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh Forms'}</button>
                <button className="adm-btn-outline" onClick={disconnect}>Disconnect</button>
              </div>
            </div>

            <div className="adm-meta-forms">
              {allForms.length === 0 ? (
                <div className="adm-empty">No lead forms found on this Page yet. Create one in Meta Ads Manager, then hit Refresh Forms.</div>
              ) : pagedForms.map((f) => (
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

            {totalFormsPages > 1 && (
              <div className="adm-forms-pagination">
                <button className="adm-btn-outline" onClick={() => setFormsPage((p) => Math.max(1, p - 1))} disabled={safeFormsPage === 1}>Prev</button>
                <span className="adm-forms-pagination-label">Page {safeFormsPage} of {totalFormsPages} · {allForms.length} forms</span>
                <button className="adm-btn-outline" onClick={() => setFormsPage((p) => Math.min(totalFormsPages, p + 1))} disabled={safeFormsPage === totalFormsPages}>Next</button>
              </div>
            )}

            <p className="adm-meta-hint">A submission from a form that isn't toggled on is ignored entirely — it won't appear in Leads.</p>
          </div>
        )}
      </div>
    </>
  );
}

function CitiesCard() {
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/cities');
    const data = res.ok ? await res.json() : { cities: [] };
    setCities(data.cities || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function addCity() {
    const city = input.trim();
    if (!city) return;
    setError(''); setAdding(true);
    try {
      const res = await fetch('/api/admin/cities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ city }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Could not add city.'); return; }
      setCities(data.cities); setInput('');
    } finally { setAdding(false); }
  }

  async function removeCityChip(city) {
    setRemoving(city); setError('');
    try {
      const res = await fetch('/api/admin/cities', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ city }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Could not remove city.'); return; }
      setCities(data.cities);
    } finally { setRemoving(null); }
  }

  return (
    <div className="adm-card adm-meta-card" style={{ marginBottom: 18 }}>
      <div className="adm-card-title-row">
        <div className="adm-card-title">Cities</div>
      </div>
      <p className="adm-card-sub">
        The cities Heseos operates in. Only these show up in the City dropdown when adding a partner or sales engineer, and pre-sales pick which of these (or all of them) they cover — this is also what powers automatic lead assignment by city.
      </p>

      {error && <div className="adm-notice adm-notice--error">{error}</div>}

      <div className="adm-city-add">
        <input
          className="lf-input"
          placeholder="Add a city, e.g. Pune"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addCity()}
        />
        <button className="adm-btn-primary" onClick={addCity} disabled={adding || !input.trim()}>{adding ? 'Adding…' : 'Add City'}</button>
      </div>

      {loading ? (
        <div className="adm-empty">Loading…</div>
      ) : cities.length === 0 ? (
        <div className="adm-empty">No cities added yet.</div>
      ) : (
        <div className="adm-city-chips">
          {cities.map((c) => (
            <span className="adm-city-chip" key={c}>
              {c}
              <button aria-label={`Remove ${c}`} onClick={() => removeCityChip(c)} disabled={removing === c}>×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}


const DANGER_BTN_STYLE = { color: '#c0392b', borderColor: '#f3c6c6' };

function BotSignupsCard() {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [reveal, setReveal] = useState({}); // { [tenantId]: freshly-generated plaintext password }
  const [copiedId, setCopiedId] = useState('');

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/bot-tenants');
    setTenants(res.ok ? await res.json() : []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function decide(id, action, confirmMsg) {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setBusyId(id); setError('');
    try {
      const res = await fetch(`/api/admin/bot-tenants/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || 'Could not update that signup.'); return; }
      const { tempPassword, ...tenant } = data;
      setTenants((prev) => prev.map((t) => (t.id === id ? tenant : t)));
      if (tempPassword) setReveal((prev) => ({ ...prev, [id]: tempPassword }));
    } finally {
      setBusyId(null);
    }
  }

  function dismissReveal(id) {
    setReveal((prev) => { const next = { ...prev }; delete next[id]; return next; });
  }

  function copyPassword(id, value) {
    navigator.clipboard?.writeText(value).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(''), 1800);
    });
  }

  async function removeTenant(id, businessName) {
    if (!confirm(`Permanently delete ${businessName || 'this account'} and all of their bot data (conversations, messages)? This cannot be undone.`)) return;
    setBusyId(id); setError('');
    try {
      const res = await fetch(`/api/admin/bot-tenants/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || 'Could not delete that account.'); return; }
      setTenants((prev) => prev.filter((t) => t.id !== id));
      dismissReveal(id);
    } finally {
      setBusyId(null);
    }
  }

  const pending = tenants.filter((t) => (t.approvalStatus || 'approved') === 'pending');
  const visible = showAll ? tenants : pending;

  return (
    <div className="adm-card adm-meta-card" style={{ marginBottom: 18 }}>
      <div className="adm-card-title-row">
        <div className="adm-card-title">Bot Signups</div>
        {pending.length > 0 && <span className="adm-status-pill pending">{pending.length} pending</span>}
      </div>
      <p className="adm-card-sub">
        Anyone can submit the self-service Bot Console signup form, but a new account can't log in or use any compute until
        you approve it here — that's what keeps a flood of random signups from costing you anything beyond one small row
        each. Approving seeds their demo Inbox and lets them sign in; rejecting keeps the account permanently locked out.
        Once approved, you can deactivate, reset the password for, or permanently delete an account at any time.
      </p>

      {error && <div className="adm-notice adm-notice--error">{error}</div>}

      {loading ? (
        <div className="adm-empty">Loading…</div>
      ) : visible.length === 0 ? (
        <div className="adm-empty">{showAll ? 'No bot signups yet.' : 'No signups waiting on approval.'}</div>
      ) : (
        <div className="adm-meta-forms">
          {visible.map((t) => {
            const status = t.approvalStatus || 'approved';
            const isActive = t.active !== false;
            const busy = busyId === t.id;
            const deleteBtn = (
              <button className="adm-btn-outline" style={DANGER_BTN_STYLE} disabled={busy} onClick={() => removeTenant(t.id, t.businessName)}>Delete</button>
            );
            return (
              <div key={t.id}>
                <div className="adm-meta-form-row">
                  <div>
                    <div className="adm-lead-name">
                      {t.businessName}
                      <span className={`adm-status-pill${status === 'approved' ? ' active' : status === 'pending' ? ' pending' : ''}`} style={{ marginLeft: 8 }}>{status}</span>
                      {status !== 'pending' && !isActive && <span className="adm-status-pill" style={{ marginLeft: 6 }}>deactivated</span>}
                    </div>
                    <div className="adm-lead-sub">
                      {t.contactName} · {t.email || 'no email'} · {t.industry} · login ID <strong>{t.loginId}</strong> · signed up {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : ''}
                    </div>
                  </div>

                  {status === 'pending' ? (
                    <div className="adm-page-head-actions">
                      <button className="adm-btn-outline" disabled={busy} onClick={() => decide(t.id, 'reject')}>Reject</button>
                      <button className="adm-btn-primary" disabled={busy} onClick={() => decide(t.id, 'approve')}>{busy ? 'Approving…' : 'Approve'}</button>
                      {deleteBtn}
                    </div>
                  ) : status === 'rejected' ? (
                    <div className="adm-page-head-actions">
                      <button className="adm-btn-outline" disabled={busy} onClick={() => decide(t.id, 'approve')}>Approve anyway</button>
                      {deleteBtn}
                    </div>
                  ) : (
                    <div className="adm-page-head-actions">
                      {isActive ? (
                        <button className="adm-btn-outline" disabled={busy} onClick={() => decide(t.id, 'deactivate', `Deactivate ${t.businessName}'s bot? It will stop responding on WhatsApp and they won't be able to sign in until you reactivate them.`)}>Deactivate</button>
                      ) : (
                        <button className="adm-btn-primary" disabled={busy} onClick={() => decide(t.id, 'activate')}>Activate</button>
                      )}
                      <button className="adm-btn-outline" disabled={busy} onClick={() => decide(t.id, 'reset_password', `Generate a new password for ${t.businessName}? Their current password stops working immediately.`)}>Reset Password</button>
                      {deleteBtn}
                    </div>
                  )}
                </div>

                {reveal[t.id] && (
                  <div className="adm-reveal-row">
                    <span>New password for <strong>{t.businessName}</strong>:</span>
                    <code>{reveal[t.id]}</code>
                    <button className="adm-btn-outline" onClick={() => copyPassword(t.id, reveal[t.id])}>{copiedId === t.id ? 'Copied' : 'Copy'}</button>
                    <button className="adm-btn-outline" onClick={() => dismissReveal(t.id)}>Done</button>
                    <span style={{ flexBasis: '100%', fontSize: 11.5 }}>Shown once — copy it now and share it with them directly. It won't be shown again.</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tenants.length > pending.length && (
        <button className="adm-btn-outline" style={{ marginTop: 14 }} onClick={() => setShowAll((s) => !s)}>
          {showAll ? 'Show pending only' : `Show all ${tenants.length} signups`}
        </button>
      )}
    </div>
  );
}
