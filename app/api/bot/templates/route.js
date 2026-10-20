// Templates the Inbox "Template" button can send. Lists the tenant's approved templates straight
// from Meta when a WhatsApp Business Account ID is saved in Bot Configuration; otherwise (or if
// Meta can't be reached) falls back to the built-in Heseos catalogue so the picker is never empty.
import { getBotTenant } from '@/lib/auth';
import { fetchMetaTemplates, HESEOS_TEMPLATE_CATALOG, paramCount } from '@/lib/botTemplates';
import { getHeseosBotTenant } from '@/lib/attribution';
import { findOrderForChat } from '@/lib/installBooking';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const tenant = await getBotTenant();
  if (!tenant) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  // The "Book installation" button templates need the customer's order. Only HESEOS's own bot may use
  // them (orders are HESEOS data); for any other tenant they are listed as not sendable.
  const heseos = await getHeseosBotTenant();
  const isHeseos = !!heseos && heseos.id === tenant.id;
  const chat = new URL(request.url).searchParams.get('chat') || '';
  let context = null;
  if (isHeseos && chat) {
    const found = await findOrderForChat(chat);
    if (found) {
      const name = String(found.order.customerName || '').trim().split(/\s+/)[0];
      context = { orderId: found.order.id, firstName: name, blocked: found.blocked };
    } else {
      context = { orderId: '', firstName: '', blocked: 'No order found for this phone number.' };
    }
  }
  const gate = (t) => (t.bookingButton && !isHeseos ? { ...t, sendable: false, reason: 'Only available on the HESEOS account' } : t);

  const meta = await fetchMetaTemplates(tenant);
  if (meta.ok && meta.templates.length) return Response.json({ source: 'meta', templates: meta.templates.map(gate), context });

  const fallback = HESEOS_TEMPLATE_CATALOG.map((t) => gate({ ...t, params: paramCount(t.body), sendable: true, reason: '' }));
  const note = meta.error === 'no_waba'
    ? 'Showing the built-in HESEOS templates. Add your WhatsApp Business Account ID in Bot Configuration to list every approved template from Meta.'
    : meta.ok
      ? 'Meta returned no approved templates for this account — showing the built-in HESEOS templates.'
      : `Could not load templates from Meta (${meta.error}) — showing the built-in HESEOS templates.`;
  return Response.json({ source: 'builtin', note, templates: fallback, context });
}
