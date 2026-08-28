import { handleInbound } from '@/lib/waInbound';

export const dynamic = 'force-dynamic';

// GET — Meta's webhook verification handshake. Enter WHATSAPP_VERIFY_TOKEN in the Meta App
// dashboard's webhook config as the "Verify token", and this URL as the callback URL.
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');
  if (mode === 'subscribe' && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge || '', { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }
  return new Response('Forbidden', { status: 403 });
}

// POST — every inbound WhatsApp message + delivery status lands here.
export async function POST(req) {
  const payload = await req.json().catch(() => ({}));
  await handleInbound(payload);
  return Response.json({ received: true });
}
