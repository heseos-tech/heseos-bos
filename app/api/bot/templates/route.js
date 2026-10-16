// Templates the Inbox "Template" button can send. Lists the tenant's approved templates straight
// from Meta when a WhatsApp Business Account ID is saved in Bot Configuration; otherwise (or if
// Meta can't be reached) falls back to the built-in Heseos catalogue so the picker is never empty.
import { getBotTenant } from '@/lib/auth';
import { fetchMetaTemplates, HESEOS_TEMPLATE_CATALOG, paramCount } from '@/lib/botTemplates';

export const dynamic = 'force-dynamic';

export async function GET() {
  const tenant = await getBotTenant();
  if (!tenant) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const meta = await fetchMetaTemplates(tenant);
  if (meta.ok && meta.templates.length) return Response.json({ source: 'meta', templates: meta.templates });

  const fallback = HESEOS_TEMPLATE_CATALOG.map((t) => ({ ...t, params: paramCount(t.body), sendable: true, reason: '' }));
  const note = meta.error === 'no_waba'
    ? 'Showing the built-in HESEOS templates. Add your WhatsApp Business Account ID in Bot Configuration to list every approved template from Meta.'
    : meta.ok
      ? 'Meta returned no approved templates for this account — showing the built-in HESEOS templates.'
      : `Could not load templates from Meta (${meta.error}) — showing the built-in HESEOS templates.`;
  return Response.json({ source: 'builtin', note, templates: fallback });
}
