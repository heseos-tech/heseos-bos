// The QR entry point. Print a QR code (any free QR generator) that points to
// https://<yourdomain>/wa/<partnerId-or-SHOP> — scanning it opens WhatsApp with a pre-filled
// message tagging that shop/partner, so lib/waInbound.js can attribute the resulting lead.
// `ref` can be a real partner id (ties the lead to that distribution partner) or a plain shop
// label like "SHOP-KORAMANGALA" if you just want to know which physical location drove it.

const HESEOS_NUMBER = process.env.WHATSAPP_BUSINESS_NUMBER; // e.g. 919876543210, digits only

export async function GET(request, { params }) {
  const { ref } = await params;
  const safeRef = String(ref || 'shop').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);

  if (!HESEOS_NUMBER) {
    return new Response(
      'WhatsApp QR entry point is not configured yet — set WHATSAPP_BUSINESS_NUMBER in your environment.',
      { status: 503, headers: { 'Content-Type': 'text/plain' } }
    );
  }

  const text = `Hi Heseos! I'm interested in smart home automation. (ref:${safeRef})`;
  const url = `https://wa.me/${HESEOS_NUMBER}?text=${encodeURIComponent(text)}`;

  return Response.redirect(url, 302);
}
