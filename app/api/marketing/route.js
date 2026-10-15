// Marketing Studio backend (Admin -> Marketing Studio, Partner app -> Marketing Studio).
//
//   GET  ?admin=1        admin/marketing staff: every creative (hidden ones too), light metadata + thumb
//   GET  (no params)     partner or staff: active creatives only, light metadata + thumb
//        ?category=x       …filtered to one category
//   GET  ?id=…           one creative WITH its full-size image (partner or staff)
//   POST {action:'track', id, kind:'share'|'download'}   partner: bump the usage counters
//   POST {action:'toggle'|'delete', id}                  admin/marketing staff
//   POST {category,title,full,thumb,bandPct,textColor,accent}   admin/marketing staff: publish
//
// Images are base64 JPEG data URLs produced client-side (resized + re-encoded, same approach as
// the Products catalogue — no external file storage is wired up). The full-size image lives in its
// own table (marketing_images) so listing the gallery never drags megabytes of artwork along.
import { dbInsert, dbList, dbGetById, dbPatch, dbDelete } from '@/lib/db';
import { getEmployee, getPartner } from '@/lib/auth';
import { CREATIVE_CAT_KEYS, BAND_MIN, BAND_MAX, BAND_DEFAULT, TEXT_LIGHT, TEXT_DARK } from '@/lib/marketing';

export const dynamic = 'force-dynamic';

const MAX_FULL = 3_500_000;   // ~2.6 MB of JPEG once base64-decoded
const MAX_THUMB = 150_000;
const DATA_URL_RE = /^data:image\/(jpeg|png|webp);base64,/;

async function staff() {
  const e = await getEmployee();
  return e && (e.role === 'admin' || e.role === 'marketing') ? e : null;
}

export async function GET(request) {
  const url = new URL(request.url);
  const s = await staff();
  const employee = s || (await getEmployee());
  const partner = employee ? null : await getPartner();
  if (!employee && !partner) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const id = url.searchParams.get('id');
  if (id) {
    const meta = await dbGetById('marketing_creatives', id);
    if (!meta || (meta.active === false && !employee)) return Response.json({ error: 'Not found' }, { status: 404 });
    const img = await dbGetById('marketing_images', id);
    if (!img?.full) return Response.json({ error: 'Image missing' }, { status: 404 });
    return Response.json({ creative: { ...meta, full: img.full } });
  }

  let rows = await dbList('marketing_creatives');
  if (!(url.searchParams.get('admin') === '1' && s)) rows = rows.filter((r) => r.active !== false);
  const category = url.searchParams.get('category');
  if (category && category !== 'all') rows = rows.filter((r) => r.category === category);
  rows.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return Response.json({ creatives: rows });
}

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid request' }, { status: 400 }); }
  const action = body.action;

  if (action === 'track') {
    const partner = await getPartner();
    if (!partner) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const field = body.kind === 'download' ? 'downloads' : body.kind === 'share' ? 'shares' : null;
    const meta = field && body.id ? await dbGetById('marketing_creatives', String(body.id)) : null;
    if (!meta) return Response.json({ ok: false }, { status: 400 });
    await dbPatch('marketing_creatives', meta.id, { [field]: (meta[field] || 0) + 1 });
    return Response.json({ ok: true });
  }

  const admin = await staff();
  if (!admin) return Response.json({ error: 'Only Heseos staff can manage creatives' }, { status: 403 });

  if (action === 'toggle' || action === 'delete') {
    const meta = body.id ? await dbGetById('marketing_creatives', String(body.id)) : null;
    if (!meta) return Response.json({ error: 'Not found' }, { status: 404 });
    if (action === 'delete') {
      await dbDelete('marketing_creatives', meta.id);
      await dbDelete('marketing_images', meta.id);
      return Response.json({ ok: true });
    }
    await dbPatch('marketing_creatives', meta.id, { active: meta.active === false });
    return Response.json({ ok: true });
  }

  // Create
  const title = String(body.title || '').trim().slice(0, 80);
  if (!title) return Response.json({ error: 'Give the creative a title' }, { status: 400 });
  const full = String(body.full || '');
  const thumb = String(body.thumb || '');
  if (!DATA_URL_RE.test(full) || !DATA_URL_RE.test(thumb)) return Response.json({ error: 'Upload a JPG or PNG image' }, { status: 400 });
  if (full.length > MAX_FULL) return Response.json({ error: 'Image is too large — try a smaller file' }, { status: 413 });
  if (thumb.length > MAX_THUMB) return Response.json({ error: 'Thumbnail is too large' }, { status: 413 });

  const category = CREATIVE_CAT_KEYS.includes(body.category) ? body.category : CREATIVE_CAT_KEYS[0];
  const bandPct = Math.min(BAND_MAX, Math.max(BAND_MIN, Number(body.bandPct) || BAND_DEFAULT));
  const id = `MKT${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 900 + 100)}`;
  const meta = {
    id,
    category,
    title,
    thumb,
    bandPct,
    textColor: body.textColor === TEXT_DARK ? TEXT_DARK : TEXT_LIGHT,
    accent: body.accent !== false,
    active: true,
    shares: 0,
    downloads: 0,
    createdAt: new Date().toISOString(),
    createdBy: admin.id,
  };
  await dbInsert('marketing_images', id, { id, full });
  await dbInsert('marketing_creatives', id, meta);
  return Response.json({ creative: meta });
}
