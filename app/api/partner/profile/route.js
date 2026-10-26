// app/api/partner/profile/route.js — a partner's own account details (Profile → My Profile /
// Bank Details). Name and phone stay fixed here on purpose (phone is the login identifier and
// changing it is a support-desk action, not a self-service one) — everything else here is
// self-service: `businessName` (labelled "Partner Name" in the UI — kept as this pre-existing
// field name since Admin → Partners and elsewhere already read it), `shopName` ("Partner
// Business Name" — a separate, genuinely new field for partners whose shop/company name isn't
// their own), partner category (the same `type` field admin's Partners page filters and reports
// by), address (addressLine/pincode/city/state — city and pincode are the same flat fields
// Admin → Partners' City column already reads, just never populated until now), and bank
// details for reference when a payout gets settled manually (see app/api/admin/payouts — there
// is no payment gateway anywhere in this app, so these fields are never used to move money,
// only so an admin has somewhere to look them up), and an optional GSTIN (`gstNumber`) for
// partners who are registered businesses — validated for format when provided, but never
// required.
import { dbPatch } from '@/lib/db';
import { getPartner, invalidateAccountCache } from '@/lib/auth';
import { PARTNER_CATEGORY } from '@/lib/formOptions';
import { resolveServiceArea } from '@/lib/pincodeLookup';

export const dynamic = 'force-dynamic';

const CATEGORY_VALUES = new Set(PARTNER_CATEGORY.map((c) => c.v));
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const PINCODE_RE = /^\d{6}$/;
const GST_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z\d]$/;

// Never hand the password hash (or anything else internal) to the client.
function publicPartner(p) {
  const { password, ...rest } = p;
  return rest;
}

export async function GET() {
  const partner = await getPartner();
  if (!partner) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  return Response.json(publicPartner(partner));
}

export async function PATCH(request) {
  const partner = await getPartner();
  if (!partner) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const patch = {};

  if (body.businessName !== undefined) {
    const businessName = String(body.businessName || '').trim();
    if (!businessName) return Response.json({ error: 'Business name cannot be empty' }, { status: 400 });
    patch.businessName = businessName;
  }

  // An Installation Partner's category is fixed — it decides which app they use and which jobs they see, so it
  // can't be changed here (any `type` sent is ignored), and nobody can switch themselves INTO installer either:
  // those accounts are only created through the Installer app's sign-up or by Admin.
  if (body.type !== undefined && partner.type !== 'installer') {
    const type = String(body.type || '').trim();
    if (!CATEGORY_VALUES.has(type) || type === 'installer') return Response.json({ error: 'Please choose a valid partner category' }, { status: 400 });
    patch.type = type;
  }

  if (body.shopName !== undefined) {
    patch.shopName = String(body.shopName || '').trim();
  }

  if (body.addressLine !== undefined) {
    patch.addressLine = String(body.addressLine || '').trim();
  }

  // City and state are never self-entered — they follow the pincode (India Post lookup). Any `city` /
  // `state` in the request is ignored. The pincode can't be blank; it's only re-resolved when it changes,
  // so an older installer with several coverage cities keeps them until they actually change pincode.
  if (body.pincode !== undefined) {
    const pincode = String(body.pincode || '').trim();
    if (!PINCODE_RE.test(pincode)) return Response.json({ error: 'Pincode must be 6 digits' }, { status: 400 });
    if (pincode !== String(partner.pincode || '')) {
      const area = await resolveServiceArea(pincode);
      if (!area.ok) return Response.json({ error: area.error }, { status: area.status });
      patch.pincode = area.pincode;
      patch.city = area.city;
      patch.state = area.state;
    }
  }

  if (body.gstNumber !== undefined) {
    const gstNumber = String(body.gstNumber || '').trim().toUpperCase();
    if (gstNumber && !GST_RE.test(gstNumber)) return Response.json({ error: 'That doesn\u2019t look like a valid GSTIN (e.g. 22AAAAA0000A1Z5)' }, { status: 400 });
    patch.gstNumber = gstNumber;
  }

  if (body.bankDetails !== undefined) {
    const b = body.bankDetails || {};
    const accountHolderName = String(b.accountHolderName || '').trim();
    const bankName = String(b.bankName || '').trim();
    const accountNumber = String(b.accountNumber || '').replace(/\s+/g, '');
    const ifsc = String(b.ifsc || '').trim().toUpperCase();
    const upiId = String(b.upiId || '').trim();

    // Every field is optional on its own (a partner may only have a UPI ID, say), but bank
    // transfer needs enough to actually be usable once someone looks it up to pay — if any one
    // of the three bank-transfer fields is filled in, require all three.
    const anyBankField = accountHolderName || bankName || accountNumber || ifsc;
    if (anyBankField && (!accountHolderName || !accountNumber || !ifsc)) {
      return Response.json({ error: 'Account holder name, account number and IFSC code are all needed for bank transfer' }, { status: 400 });
    }
    if (ifsc && !IFSC_RE.test(ifsc)) {
      return Response.json({ error: 'That doesn’t look like a valid IFSC code (e.g. HDFC0001234)' }, { status: 400 });
    }
    patch.bankDetails = { accountHolderName, bankName, accountNumber, ifsc, upiId };
  }

  if (Object.keys(patch).length === 0) return Response.json({ error: 'Nothing to update' }, { status: 400 });

  const updated = await dbPatch('partners', partner.id, patch);
  if (!updated) return Response.json({ error: 'Not found' }, { status: 404 });
  invalidateAccountCache('partners', partner.id);
  return Response.json(publicPartner(updated));
}
