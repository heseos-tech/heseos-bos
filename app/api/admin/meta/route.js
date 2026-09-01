// Admin-only settings API for the self-service Meta Lead Ads connection: connect a Page,
// list its Lead Ad forms, and toggle which forms are allowed to create leads. See lib/metaAds.js.
import { getEmployee } from '@/lib/auth';
import { getMetaSettings, saveMetaSettings, fetchPageInfo, fetchLeadForms, fetchFormLeads, subscribePageToApp, registerAppWebhook, activeAccessToken } from '@/lib/metaAds';
import { dbInsert, dbGetById } from '@/lib/db';
import { istDateStr } from '@/lib/date';
import { pushHistory } from '@/lib/leadStage';
import { mapMetaLead } from '@/lib/metaLeadMap';
import { autoAssignByCity } from '@/lib/leadAssign';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const employee = await getEmployee();
  if (!employee || employee.role !== 'admin') return null;
  return employee;
}

// Never ship the raw access token back to the browser — only whether one is stored.
function publicSettings(settings) {
  if (!settings || !settings.pageAccessToken) {
    return {
      connected: false,
      pageId: settings?.pageId || null,
      pageName: settings?.pageName || null,
      forms: settings?.forms || [],
      usingEnvToken: !!process.env.META_LEAD_ACCESS_TOKEN,
    };
  }
  const { pageAccessToken, ...rest } = settings;
  return { ...rest, connected: true, usingEnvToken: false };
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const settings = await getMetaSettings();
  return Response.json(publicSettings(settings));
}

// Connect (or reconnect) a Page: validate the pasted token, pull its lead forms, and save.
export async function POST(request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const token = String(body?.pageAccessToken || '').trim();
  if (!token) return Response.json({ error: 'Paste a Page Access Token to connect.' }, { status: 400 });

  const { data: page, error: pageErr } = await fetchPageInfo(token);
  if (pageErr) return Response.json({ error: pageErr }, { status: 400 });

  const { data: forms, error: formsErr } = await fetchLeadForms(page.id, token);
  if (formsErr) return Response.json({ error: formsErr }, { status: 400 });

  // Keep whatever enabled/disabled choices the admin already made for forms that still exist.
  const existing = await getMetaSettings();
  const prevById = new Map((existing?.forms || []).map((f) => [f.id, f]));
  const mergedForms = forms.map((f) => ({ id: f.id, name: f.name, status: f.status, enabled: prevById.get(f.id)?.enabled ?? false }));

  let settings = await saveMetaSettings({
    pageAccessToken: token,
    pageId: page.id,
    pageName: page.name,
    forms: mergedForms,
    connectedAt: existing?.connectedAt || new Date().toISOString(),
    connectedBy: admin.id,
  });

  // Auto-subscribe the Page to this app's webhook — the step that otherwise has to be done
  // by hand in Meta's dashboard every time a Page is (re)connected.
  const { error: subError } = await subscribePageToApp(page.id, token);
  settings = await saveMetaSettings({ subscribed: !subError, subscribeError: subError || null, subscribedAt: new Date().toISOString() });

  return Response.json(publicSettings(settings));
}

// PATCH { action: 'refresh' } → re-pull the form list from Meta (new forms show up as off).
// PATCH { formId, enabled } → toggle one form's capture state.
export async function PATCH(request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));

  // App-level, one-time setup — doesn't need a Page connected yet, so this runs before the
  // "connect a Page first" guard below.
  if (body.action === 'register_webhook') {
    const { data, error } = await registerAppWebhook();
    if (error) return Response.json({ error }, { status: 400 });
    const settings = await saveMetaSettings({ webhookRegistered: true, webhookRegisteredAt: new Date().toISOString(), webhookCallbackUrl: data.callbackUrl });
    return Response.json(publicSettings(settings));
  }

  const existing = await getMetaSettings();
  if (!existing || !existing.pageAccessToken) {
    return Response.json({ error: 'Connect a Meta Page first.' }, { status: 400 });
  }

  if (body.action === 'refresh') {
    const { data: forms, error } = await fetchLeadForms(existing.pageId, existing.pageAccessToken);
    if (error) return Response.json({ error }, { status: 400 });
    const prevById = new Map((existing.forms || []).map((f) => [f.id, f]));
    const mergedForms = forms.map((f) => ({ id: f.id, name: f.name, status: f.status, enabled: prevById.get(f.id)?.enabled ?? false }));
    // Re-confirm the Page subscription too — cheap, and catches the case where it lapsed.
    const { error: subError } = await subscribePageToApp(existing.pageId, existing.pageAccessToken);
    const settings = await saveMetaSettings({ forms: mergedForms, subscribed: !subError, subscribeError: subError || null, subscribedAt: new Date().toISOString() });
    return Response.json(publicSettings(settings));
  }

  // PATCH { action: 'sync_leads' } → pull every enabled form's full lead history straight from
  // Meta's Graph API and insert anything missing — the manual safety net for whatever the
  // webhook hasn't (yet, or ever) captured on its own. Safe to run any time: every lead is
  // looked up by its deterministic id before inserting, so nothing is ever duplicated.
  if (body.action === 'sync_leads') {
    const token = activeAccessToken(existing);
    const enabledForms = (existing.forms || []).filter((f) => f && f.enabled);
    if (!token) return Response.json({ error: 'No access token available to sync with.' }, { status: 400 });
    if (enabledForms.length === 0) return Response.json({ error: 'No forms are toggled on — turn at least one on before syncing.' }, { status: 400 });

    let inserted = 0;
    let skipped = 0;
    const formResults = [];
    for (const form of enabledForms) {
      const { leads, error: fetchError } = await fetchFormLeads(form.id, token);
      if (fetchError) { formResults.push({ id: form.id, name: form.name, error: fetchError }); continue; }

      let formInserted = 0;
      for (const lead of leads) {
        const id = `META${lead.id}`;
        const already = await dbGetById('leads', id);
        if (already) { skipped++; continue; }

        const { mapped, rawMetaFields } = mapMetaLead(lead.field_data || []);
        if (!mapped.name || !mapped.phone) { skipped++; continue; }

        const createdAt = lead.created_time || new Date().toISOString();
        const { assignedTo, salesEngineerId } = await autoAssignByCity(mapped.city);
        const record = {
          id,
          createdAt,
          date: istDateStr(createdAt),
          status: 'new',
          name: mapped.name,
          phone: mapped.phone,
          email: mapped.email,
          city: mapped.city,
          postcode: mapped.postcode,
          productInterest: mapped.productInterest,
          propertyType: mapped.propertyType,
          budget: mapped.budget,
          timeline: mapped.timeline,
          persona: mapped.persona,
          source: 'meta_lead_form',
          partnerId: null,
          metaLeadgenId: lead.id,
          metaFormId: form.id,
          metaAdId: lead.ad_id || null,
          rawMetaFields,
          contactStage: null,
          demoOutcome: null,
          assignedTo,
          salesEngineerId,
          history: [],
        };
        record.history = pushHistory(record, { event: 'Lead Submitted', by: 'meta_lead_form', note: 'Meta Instant Form' });
        record.history = pushHistory(record, { event: 'Synced', by: 'admin', note: "Pulled directly from Meta's Graph API — wasn't captured by the webhook yet." });
        if (assignedTo) record.history = pushHistory(record, { event: 'Auto-assigned by city', by: 'system', note: (mapped.city || '') + ' · pre-sales matched' });

        await dbInsert('leads', id, record);
        inserted++; formInserted++;
      }
      formResults.push({ id: form.id, name: form.name, total: leads.length, inserted: formInserted });
    }

    const settings = await saveMetaSettings({ lastSyncedAt: new Date().toISOString(), lastSyncInserted: inserted });
    return Response.json({ ...publicSettings(settings), syncResult: { inserted, skipped, forms: formResults } });
  }

  if (body.formId) {
    const nextForms = (existing.forms || []).map((f) => (f.id === body.formId ? { ...f, enabled: !!body.enabled } : f));
    const settings = await saveMetaSettings({ forms: nextForms });
    return Response.json(publicSettings(settings));
  }

  return Response.json({ error: 'Nothing to update.' }, { status: 400 });
}

// Disconnect the Page — clears the stored token so capture falls back to META_LEAD_ACCESS_TOKEN
// (all forms) if that env var is still set, or stops until reconnected.
export async function DELETE() {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const settings = await saveMetaSettings({ pageAccessToken: null, pageId: null, pageName: null, forms: [] });
  return Response.json(publicSettings(settings));
}
