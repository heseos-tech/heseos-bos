// Files that travel through the Bot Inbox — images and PDFs the team sends to a customer, and
// ones the customer sends in. The bytes live in their own `bot_media` table (base64, tenant-scoped)
// rather than inside bot_messages, so loading a chat thread stays light; the message row only keeps
// a small descriptor { id, type, filename, mime, size } and the browser fetches the file from the
// authenticated /api/bot/media/<id> route.

import { dbInsert } from '@/lib/db';

// What the team may send out (WhatsApp accepts JPG/PNG images up to 5 MB and documents up to 100 MB,
// but the request body to Vercel is capped near 4.5 MB, so uploads are held to 4 MB here).
export const MAX_SEND_BYTES = 4 * 1024 * 1024;
export const SEND_IMAGE_MIMES = ['image/jpeg', 'image/png'];
export const SEND_DOC_MIMES = ['application/pdf'];
// Inbound files bigger than this are not stored (the thread shows "file too large to preview").
export const MAX_RECEIVE_BYTES = 6 * 1024 * 1024;

export function mediaTypeForMime(mime) {
  const m = String(mime || '').toLowerCase();
  return m.startsWith('image/') ? 'image' : 'document';
}

export function safeFilename(name, fallback) {
  const clean = String(name || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim().slice(0, 120);
  return clean || fallback;
}

// Stores the bytes and returns the descriptor to put on the message row.
export async function saveBotMedia(tenantId, { buffer, mime, filename, type }) {
  const id = `BM${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
  const t = type || mediaTypeForMime(mime);
  const name = safeFilename(filename, t === 'image' ? 'image' : 'document');
  await dbInsert('bot_media', id, {
    id, tenantId, mime: mime || (t === 'image' ? 'image/jpeg' : 'application/octet-stream'),
    filename: name, size: buffer.length, createdAt: new Date().toISOString(),
    base64: Buffer.from(buffer).toString('base64'),
  });
  return { id, type: t, filename: name, mime: mime || '', size: buffer.length };
}
