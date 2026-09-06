// app/api/partner/profile/route.js — a partner's own account details (Profile → My Profile /
// Bank Details). Name and phone stay fixed here on purpose (phone is the login identifier and
// changing it is a support-desk action, not a self-service one) — this only ever touches the
// business-facing bits: business name, partner category (the same `type` field admin's
// Partners page filters and reports by, so setting it here shows up there too), and bank
// details for reference when a payout gets settled manually (see app/api/admin/payouts — there
// is no payment gateway anywhere in this app, so these fields are never used to move money,
// only so an admin has somewhere to look them up).
import { dbPatch } from '@/lib/db';
import { getPartner } from '@/lib/auth';
import { PARTNER_CATEGORY } from '@/lib/formOptions';

export const dynamic = 'force-dynamic';

const CATEGORY_VALUES = new Set(PARTNER_CATEGORY.map((c) => c.v));
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

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

  if (body.type !== undefined) {
    const type = String(body.type || '').trim();
    if (!CATEGORY_VALUES.has(type)) return Response.json({ error: 'Please choose a valid partner category' }, { status: 400 });
    patch.type = type;
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
  return Response.json(publicPartner(updated));
}
