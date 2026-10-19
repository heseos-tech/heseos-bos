// lib/accountDeletion.js — self-service deletion of a Partner / Installer account (required by
// Google Play for any app that lets people create an account). Used by
// app/api/partner/delete-account, which re-checks the password first.
//
// What happens:
//   • the account row is REPLACED by an anonymised tombstone — name, phone, password hash, bank
//     details, address, city, GSTIN … are all gone; only the id (+ type, created date, who
//     onboarded them) stays so the leads / orders / payout rows that point at this id still make
//     sense ("Deleted partner") and Heseos' business/accounting records stay intact.
//   • the mobile number is freed, so it can be used to sign up again later.
//   • their QR / referral links are switched off.
//   • installation jobs they claimed but haven't completed go back to the open pool.
//   • BLOCKED while money is still owed (pending/processing payouts) — those need to be paid out
//     first, because the bank details needed to pay them are deleted with the account.
// Leads they referred are Heseos' own customer records and are kept (see privacy policy §7).

import { dbWhere, dbInsert, dbPatch } from '@/lib/db';
import { invalidateAccountCache } from '@/lib/auth';
import { listJobsForInstaller, releaseJob } from '@/lib/installJobs';

const OPEN_PAYOUT = new Set(['pending', 'processing']);

export async function deletePartnerAccount(partner) {
  const payouts = await dbWhere('payouts', 'partnerId', partner.id);
  const owed = payouts
    .filter((p) => OPEN_PAYOUT.has(p.status))
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  if (owed > 0) {
    return {
      ok: false,
      status: 409,
      error: `You still have ₹${owed.toLocaleString('en-IN')} in unpaid earnings. We can delete your account once they are settled — or email support@heseos.com and we will settle them first.`,
    };
  }

  // Give back any claimed-but-unfinished installation jobs.
  if (partner.type === 'installer') {
    try {
      const { mine } = await listJobsForInstaller(partner);
      for (const j of mine.filter((x) => !x.done)) {
        await releaseJob(partner, j.kind, j.id);
      }
    } catch (e) {
      console.error('[accountDeletion] releasing jobs failed:', e.message);
    }
  }

  // Switch off their QR / referral links so new scans are no longer credited to a deleted account.
  try {
    const links = await dbWhere('attribution_links', 'partnerId', partner.id);
    for (const l of links) {
      await dbPatch('attribution_links', l.id, { active: false });
    }
  } catch (e) {
    console.error('[accountDeletion] disabling links failed:', e.message);
  }

  const now = new Date().toISOString();
  await dbInsert('partners', partner.id, {
    id: partner.id,
    name: 'Deleted partner',
    businessName: 'Deleted partner',
    phone: '',
    type: partner.type,
    active: false,
    deleted: true,
    deletedAt: now,
    createdAt: partner.createdAt,
    ...(partner.onboardedByEmployeeId ? {
      onboardedByEmployeeId: partner.onboardedByEmployeeId,
      onboardedByEmployeeAt: partner.onboardedByEmployeeAt,
      onboardedVia: partner.onboardedVia,
    } : {}),
  });
  invalidateAccountCache('partners', partner.id);
  return { ok: true };
}
