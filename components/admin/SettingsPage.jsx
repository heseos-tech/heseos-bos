'use client';
// Real Settings page — currently just the Meta Lead Ads connection, which is the one
// integration the admin asked to make self-service: connect a Page, then pick exactly which
// Lead Ad (Instant Form) forms are allowed to create leads.
import { useEffect, useState, useCallback } from 'react';
import { IconSearch, IconPartners, IconPresales, IconLeads, IconTrash, IconInfo } from './icons';
import { invalidate } from '@/lib/useApiResource';
import { normalizeConfig, PAYOUT_CATEGORIES, PAYOUT_CATEGORY_META } from '@/lib/payout';

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
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [formsPage, setFormsPage] = useState(1);
  const [formSearch, setFormSearch] = useState('');

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

  async function syncLeads() {
    setError(''); setSyncResult(null); setSyncing(true);
    try {
      const res = await fetch('/api/admin/meta', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'sync_leads' }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Could not sync leads.'); return; }
      setSettings(data); setSyncResult(data.syncResult);
      const { inserted } = data.syncResult || {};
      flash(inserted > 0 ? `Sync complete — ${inserted} new lead${inserted === 1 ? '' : 's'} pulled in` : 'Sync complete — nothing new, you\'re already up to date');
    } finally { setSyncing(false); }
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

  const rawForms = settings?.forms || [];
  const formSearchTerm = formSearch.trim().toLowerCase();
  const allForms = formSearchTerm
    ? rawForms.filter((f) => (f.name || '').toLowerCase().includes(formSearchTerm) || String(f.id).includes(formSearchTerm))
    : rawForms;
  const totalFormsPages = Math.max(1, Math.ceil(allForms.length / FORMS_PER_PAGE));
  const safeFormsPage = Math.min(formsPage, totalFormsPages);
  const pagedForms = allForms.slice((safeFormsPage - 1) * FORMS_PER_PAGE, safeFormsPage * FORMS_PER_PAGE);

  useEffect(() => { if (formsPage !== safeFormsPage) setFormsPage(safeFormsPage); }, [safeFormsPage, formsPage]);
  useEffect(() => { setFormsPage(1); }, [formSearchTerm]);

  return (
    <>
      <div className="adm-page-head">
        <div><h1 className="adm-h1">Settings</h1><p className="adm-page-sub">Organization, notification and integration settings</p></div>
      </div>

      {notice && <div className="adm-notice">{notice}</div>}

      <BotSignupsCard />

      <PayoutSettingsCard />

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
                <button className="adm-btn-outline" onClick={syncLeads} disabled={syncing}>{syncing ? 'Syncing…' : 'Sync Leads Now'}</button>
                <button className="adm-btn-outline" onClick={disconnect}>Disconnect</button>
              </div>
            </div>

            <div className="adm-lead-sub adm-meta-sync-note">
              {settings.lastSyncedAt
                ? `Last manual sync: ${new Date(settings.lastSyncedAt).toLocaleString()}${typeof settings.lastSyncInserted === 'number' ? ` · ${settings.lastSyncInserted} lead${settings.lastSyncInserted === 1 ? '' : 's'} pulled in that run` : ''}.`
                : 'Never manually synced — pulls every enabled form\'s full lead history straight from Meta, in case the webhook missed anything.'}
            </div>

            {syncResult && (
              <div className="adm-meta-sync-result">
                <div className="adm-lead-name">Sync result: {syncResult.inserted} new lead{syncResult.inserted === 1 ? '' : 's'} inserted, {syncResult.skipped} already up to date</div>
                {syncResult.forms.some((f) => f.error) && (
                  <div className="adm-lead-sub adm-lead-sub--warn">
                    {syncResult.forms.filter((f) => f.error).map((f) => `${f.name}: ${f.error}`).join(' · ')}
                  </div>
                )}
              </div>
            )}

            {rawForms.length > 0 && (
              <div className="adm-search adm-search--inline adm-meta-forms-search">
                <IconSearch size={16} />
                <input
                  placeholder="Search forms by name or form ID…"
                  value={formSearch}
                  onChange={(e) => setFormSearch(e.target.value)}
                />
              </div>
            )}

            <div className="adm-meta-forms">
              {rawForms.length === 0 ? (
                <div className="adm-empty">No lead forms found on this Page yet. Create one in Meta Ads Manager, then hit Refresh Forms.</div>
              ) : allForms.length === 0 ? (
                <div className="adm-empty">No forms match "{formSearch}".</div>
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

      <WebsiteLeadsCard />
      <GoogleAdsLeadsCard />
    </>
  );
}

const CATEGORY_ICON = { partner: IconPartners, employee: IconPresales, customer: IconLeads };

function emptyCategories() {
  return Object.fromEntries(PAYOUT_CATEGORIES.map((k) => [k, { enabled: true, tiers: [] }]));
}

// Converts the numeric config (from normalizeConfig, or straight off a save response) into the
// string-valued shape the tier inputs edit.
function toEditState(categories) {
  return Object.fromEntries(PAYOUT_CATEGORIES.map((k) => {
    const cat = categories?.[k];
    return [k, {
      enabled: cat ? cat.enabled !== false : true,
      tiers: (cat?.tiers || []).map((t) => ({ upTo: t.upTo == null ? '' : String(t.upTo), rate: String(t.rate) })),
    }];
  }));
}

// The lower bound of tier `i` is always "one more than the previous tier's upper bound" (₹0 for
// the first tier) — never independently editable, so tiers can never end up with a gap or an
// overlap. Purely a display computation.
function tierFromLabel(tiers, i) {
  if (i === 0) return '0';
  const prevUpTo = tiers[i - 1]?.upTo;
  const n = prevUpTo === '' || prevUpTo == null ? 0 : Number(prevUpTo) + 1;
  return Number.isFinite(n) ? n.toLocaleString('en-IN') : '0';
}

// Payout period is fixed to monthly — there's no admin-facing choice here (Settings no longer
// offers a Monthly/Quarterly toggle). lib/payout.js still supports a 'quarterly' period
// internally (periodBounds/periodLabel), so nothing downstream breaks if this is ever revisited.
const PAYOUT_PERIOD = 'monthly';

function PayoutSettingsCard() {
  const [categories, setCategories] = useState(emptyCategories);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    const res = await fetch('/api/payout-settings');
    const raw = res.ok ? await res.json() : null;
    const config = normalizeConfig(raw);
    setCategories(toEditState(config.categories));
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  function flash(msg) { setNotice(msg); setTimeout(() => setNotice(''), 3000); }

  function toggleCategory(key) {
    setCategories((c) => ({ ...c, [key]: { ...c[key], enabled: !c[key].enabled } }));
  }
  function addTier(key) {
    setCategories((c) => ({ ...c, [key]: { ...c[key], tiers: [...c[key].tiers, { upTo: '', rate: '' }] } }));
  }
  function removeTier(key, i) {
    setCategories((c) => ({ ...c, [key]: { ...c[key], tiers: c[key].tiers.filter((_, idx) => idx !== i) } }));
  }
  function updateTier(key, i, field, val) {
    setCategories((c) => ({ ...c, [key]: { ...c[key], tiers: c[key].tiers.map((row, idx) => (idx === i ? { ...row, [field]: val } : row)) } }));
  }

  async function save() {
    setError(''); setSaving(true);
    try {
      const payload = {
        period: PAYOUT_PERIOD,
        categories: Object.fromEntries(PAYOUT_CATEGORIES.map((k) => [k, {
          enabled: categories[k].enabled,
          tiers: categories[k].tiers.map((t) => ({ upTo: t.upTo === '' ? null : Number(t.upTo), rate: Number(t.rate) || 0 })),
        }])),
      };
      const res = await fetch('/api/payout-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Could not save payout settings.'); return; }
      const config = normalizeConfig(data);
      setCategories(toEditState(config.categories));
      invalidate('/api/payout-settings');
      flash('Payout settings saved');
    } finally { setSaving(false); }
  }

  return (
    <div className="adm-card adm-meta-card" style={{ marginBottom: 18, maxWidth: 'none' }}>
      <div className="adm-card-title-row">
        <div className="adm-card-title">Lead Conversion Payout</div>
      </div>
      <p className="adm-card-sub">
        Set tier-wise payout % for conversion based on total converted sale value this month — independently for partner referrals, employee-added leads, and customer referrals. Changing this updates everyone's payout in that category immediately — there's no per-person override.
      </p>

      {notice && <div className="adm-notice">{notice}</div>}
      {error && <div className="adm-notice adm-notice--error">{error}</div>}

      {loading ? (
        <div className="adm-empty">Loading…</div>
      ) : (
        <>
          <div className="adm-payout-grid">
            {PAYOUT_CATEGORIES.map((key) => {
              const cat = categories[key];
              const meta = PAYOUT_CATEGORY_META[key];
              const Icon = CATEGORY_ICON[key];
              return (
                <div className="adm-payout-card" key={key}>
                  <div className={`adm-payout-card-head adm-payout-card-head--${key}`}>
                    <div className="adm-payout-card-head-left">
                      <div className={`adm-payout-icon adm-payout-icon--${key}`}><Icon size={20} /></div>
                      <div>
                        <div className="adm-payout-card-title">{meta.title}</div>
                        <div className="adm-payout-card-sub">{meta.sub}</div>
                      </div>
                    </div>
                    <label className={`adm-switch adm-switch--green${cat.enabled ? ' on' : ''}`}>
                      <input type="checkbox" checked={cat.enabled} onChange={() => toggleCategory(key)} />
                      <span className="adm-switch-track"><span className="adm-switch-thumb" /></span>
                    </label>
                  </div>

                  <div className="adm-payout-body">
                    <div className="adm-payout-col-headers"><span>Tier (Sale Value)</span><span>Payout %</span></div>
                    <div className="adm-payout-tiers">
                      {cat.tiers.length === 0 && <div className="adm-empty" style={{ padding: '10px 0' }}>No tiers yet — payout will be ₹0 until you add at least one.</div>}
                      {cat.tiers.map((t, i) => (
                        <div className="adm-tier-row" key={i}>
                          <span className="adm-tier-label">₹</span>
                          <input className="adm-tier-input adm-tier-input--readonly" readOnly value={tierFromLabel(cat.tiers, i)} aria-label="Tier starts at" />
                          <span className="adm-tier-label">to</span>
                          <input
                            className="adm-tier-input"
                            type="number"
                            min="0"
                            placeholder={i === cat.tiers.length - 1 ? 'No Limit' : 'e.g. 50000'}
                            value={t.upTo}
                            onChange={(e) => updateTier(key, i, 'upTo', e.target.value)}
                          />
                          <input
                            className="adm-tier-input adm-tier-input--rate"
                            type="number"
                            min="0"
                            step="0.1"
                            placeholder="e.g. 2.5"
                            value={t.rate}
                            onChange={(e) => updateTier(key, i, 'rate', e.target.value)}
                          />
                          <span className="adm-tier-label">%</span>
                          <button type="button" className="adm-tier-remove" aria-label="Remove tier" onClick={() => removeTier(key, i)}><IconTrash size={14} /></button>
                        </div>
                      ))}
                    </div>
                    <button type="button" className="adm-payout-add-tier" onClick={() => addTier(key)}>+ Add Tier</button>
                  </div>

                  <div className={`adm-payout-card-note adm-payout-card-note--${key}`}>
                    <IconInfo size={14} />
                    <span>Payout % applies to the total converted sale value within the payout period.</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="adm-payout-foot-note">
            <IconInfo size={16} />
            <span>The payout is calculated on the total converted sale value each calendar month. There is no per-person override.</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="adm-btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Payout Settings'}</button>
          </div>
        </>
      )}
    </div>
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


function WebsiteLeadsCard() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/website-leads');
    setSettings(res.ok ? await res.json() : null);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  function copy(label, value) {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(''), 1800);
    });
  }

  async function generate() {
    setError(''); setGenerating(true);
    try {
      const res = await fetch('/api/admin/website-leads', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Could not generate a key.'); return; }
      setSettings(data);
    } finally { setGenerating(false); }
  }

  async function regenerate() {
    if (!confirm("Regenerate the API key? The old key stops working immediately \u2014 you'll need to update it wherever your website form uses it.")) return;
    setError(''); setRegenerating(true);
    try {
      const res = await fetch('/api/admin/website-leads', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'regenerate' }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Could not regenerate the key.'); return; }
      setSettings(data);
    } finally { setRegenerating(false); }
  }

  async function toggleEnabled() {
    setError(''); setToggling(true);
    try {
      const res = await fetch('/api/admin/website-leads', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: !settings.enabled }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Could not update that.'); return; }
      setSettings(data);
    } finally { setToggling(false); }
  }

  return (
    <div className="adm-card adm-meta-card" style={{ marginBottom: 18 }}>
      <div className="adm-card-title-row">
        <div className="adm-card-title">Website Lead Form</div>
        {settings?.connected && (
          <span className={`adm-status-pill${settings.enabled ? ' active' : ' pending'}`}>{settings.enabled ? 'Enabled' : 'Disabled'}</span>
        )}
      </div>
      <p className="adm-card-sub">
        Generate an API key so your own website's contact/enquiry form can send leads straight into Heseos BOS — hand the key and endpoint below to whoever builds or maintains that form. No code changes here needed on your side.
      </p>

      {error && <div className="adm-notice adm-notice--error">{error}</div>}

      {loading ? (
        <div className="adm-empty">Loading…</div>
      ) : !settings?.connected ? (
        <button className="adm-btn-primary" onClick={generate} disabled={generating}>{generating ? 'Generating\u2026' : 'Generate API Key'}</button>
      ) : (
        <>
          <div className="adm-reveal-row">
            <span>Endpoint</span>
            <code>{settings.endpointUrl}</code>
            <button className="adm-btn-outline" onClick={() => copy('endpoint', settings.endpointUrl)}>{copied === 'endpoint' ? 'Copied' : 'Copy'}</button>
          </div>
          <div className="adm-reveal-row">
            <span>API Key</span>
            <code>{settings.apiKey}</code>
            <button className="adm-btn-outline" onClick={() => copy('key', settings.apiKey)}>{copied === 'key' ? 'Copied' : 'Copy'}</button>
          </div>

          <p className="adm-meta-hint">
            POST JSON to the endpoint above with header <code>X-Api-Key: &lt;the key&gt;</code> and a body of at least <code>{'{ "name": "…", "phone": "…" }'}</code> — <code>email</code>, <code>city</code> and <code>message</code> are optional. Every submission lands in Leads tagged "Website (API)", auto-assigned by city same as any other channel.
          </p>

          <div className="adm-page-head-actions">
            <button className="adm-btn-outline" onClick={toggleEnabled} disabled={toggling}>{toggling ? 'Updating\u2026' : settings.enabled ? 'Disable Capture' : 'Enable Capture'}</button>
            <button className="adm-btn-outline" onClick={regenerate} disabled={regenerating}>{regenerating ? 'Regenerating\u2026' : 'Regenerate Key'}</button>
          </div>
        </>
      )}
    </div>
  );
}

function GoogleAdsLeadsCard() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/google-ads');
    setSettings(res.ok ? await res.json() : null);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  function copy(label, value) {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(''), 1800);
    });
  }

  async function generate() {
    setError(''); setGenerating(true);
    try {
      const res = await fetch('/api/admin/google-ads', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Could not generate a key.'); return; }
      setSettings(data);
    } finally { setGenerating(false); }
  }

  async function regenerate() {
    if (!confirm("Regenerate the webhook key? The old key stops working immediately \u2014 you'll need to update it in every Google Ads Lead Form asset's Delivery settings.")) return;
    setError(''); setRegenerating(true);
    try {
      const res = await fetch('/api/admin/google-ads', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'regenerate' }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Could not regenerate the key.'); return; }
      setSettings(data);
    } finally { setRegenerating(false); }
  }

  async function toggleEnabled() {
    setError(''); setToggling(true);
    try {
      const res = await fetch('/api/admin/google-ads', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: !settings.enabled }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Could not update that.'); return; }
      setSettings(data);
    } finally { setToggling(false); }
  }

  return (
    <div className="adm-card adm-meta-card" style={{ marginBottom: 18 }}>
      <div className="adm-card-title-row">
        <div className="adm-card-title">Google Ads Lead Form</div>
        {settings?.connected && (
          <span className={`adm-status-pill${settings.enabled ? ' active' : ' pending'}`}>{settings.enabled ? 'Enabled' : 'Disabled'}</span>
        )}
      </div>
      <p className="adm-card-sub">
        Generate a webhook key, then paste the URL and key below into each Lead Form asset's Delivery settings in Google Ads (Assets → Lead form → Webhook integration). Unlike Meta, Google has no API for us to register this automatically — it's a one-time paste per form, done in Google Ads' own screens.
      </p>

      {error && <div className="adm-notice adm-notice--error">{error}</div>}

      {loading ? (
        <div className="adm-empty">Loading…</div>
      ) : !settings?.connected ? (
        <button className="adm-btn-primary" onClick={generate} disabled={generating}>{generating ? 'Generating\u2026' : 'Generate Webhook Key'}</button>
      ) : (
        <>
          <div className="adm-reveal-row">
            <span>Webhook URL</span>
            <code>{settings.webhookUrl}</code>
            <button className="adm-btn-outline" onClick={() => copy('url', settings.webhookUrl)}>{copied === 'url' ? 'Copied' : 'Copy'}</button>
          </div>
          <div className="adm-reveal-row">
            <span>Key</span>
            <code>{settings.webhookKey}</code>
            <button className="adm-btn-outline" onClick={() => copy('key', settings.webhookKey)}>{copied === 'key' ? 'Copied' : 'Copy'}</button>
          </div>

          <p className="adm-meta-hint">
            In Google Ads: open the Lead form asset → Delivery → add a Webhook integration → paste the URL and key above. Every submission lands in Leads tagged "Google Ads Lead Form", auto-assigned by city same as any other channel — test leads from Google's own Preview/Test tool are captured too, clearly marked so pre-sales can tell them apart.
          </p>
          {settings.leadsReceived > 0 && (
            <p className="adm-meta-hint">{settings.leadsReceived} lead{settings.leadsReceived === 1 ? '' : 's'} received so far{settings.lastLeadAt ? ` · last at ${new Date(settings.lastLeadAt).toLocaleString()}` : ''}.</p>
          )}

          <div className="adm-page-head-actions">
            <button className="adm-btn-outline" onClick={toggleEnabled} disabled={toggling}>{toggling ? 'Updating\u2026' : settings.enabled ? 'Disable Capture' : 'Enable Capture'}</button>
            <button className="adm-btn-outline" onClick={regenerate} disabled={regenerating}>{regenerating ? 'Regenerating\u2026' : 'Regenerate Key'}</button>
          </div>
        </>
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

  // Heseos Bot = trusted to write into the shared Leads CRM and reuse Heseos's own QR/referral
  // system; White Label = a client's own bot, isolated to their own bot_chats. Only one tenant
  // can be Heseos's own at a time — promoting one here silently demotes whoever held it before,
  // which the server reports back via demotedId so both rows stay in sync without a reload.
  async function setBotKind(id, botKind, confirmMsg) {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setBusyId(id); setError('');
    try {
      const res = await fetch(`/api/admin/bot-tenants/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'set_bot_kind', botKind }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || 'Could not change that bot type.'); return; }
      const { demotedId, ...tenant } = data;
      setTenants((prev) => prev.map((t) => {
        if (t.id === id) return tenant;
        if (demotedId && t.id === demotedId) return { ...t, botKind: 'white_label', linkToHeseosLeads: false };
        return t;
      }));
    } finally {
      setBusyId(null);
    }
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
                    {(() => {
                      const kind = t.botKind === 'heseos' || t.linkToHeseosLeads === true ? 'heseos' : 'white_label';
                      return (
                        <div className="adm-botkind-toggle">
                          <button type="button" className={`adm-botkind-btn${kind === 'heseos' ? ' active' : ''}`} disabled={busy} onClick={() => setBotKind(t.id, 'heseos', `Mark ${t.businessName} as Heseos's own in-house bot? It'll get access to the shared Leads CRM and Heseos's QR/referral system — and whichever account currently has that role will be switched back to White Label.`)}>Heseos Bot</button>
                          <button type="button" className={`adm-botkind-btn${kind === 'white_label' ? ' active' : ''}`} disabled={busy} onClick={() => setBotKind(t.id, 'white_label')}>White Label</button>
                        </div>
                      );
                    })()}
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
