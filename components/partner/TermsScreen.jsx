'use client';
// Profile → Terms & Conditions. Heseos's own Partner Program terms — written to match how this
// program actually works in this codebase (QR/referral-link leads, admin-set tiered payouts,
// manual settlement, no payment gateway) rather than boilerplate copied from elsewhere. This is
// a starting point for the business, not legal advice — see the disclaimer at the bottom.
import { ScreenHeader } from './ui';

const SECTIONS = [
  {
    title: '1. The Partner Program',
    body: 'By joining the Heseos Partner Program (“the Program”), you (“Partner”) agree to refer prospective customers to Heseos Technologies Pvt. Ltd. (“Heseos”, “we”, “us”) for smart home automation products and services, using the QR code and/or referral link assigned to your account, in exchange for a referral payout on qualifying converted sales as described below.',
  },
  {
    title: '2. Your Account',
    body: 'You must provide accurate business and contact details when registering and keep them up to date, including your partner category and bank details where relevant. Each business may hold one Partner account. Heseos may suspend or deactivate an account it reasonably believes is fraudulent, abusive, or in breach of these terms.',
  },
  {
    title: '3. Referrals & Leads',
    body: 'A referral must be a genuine prospective customer contacted through your assigned QR code or referral link — mass messaging, spam, or referring yourself or your own existing customers under false pretences is not permitted. Once a referral results in a lead, that lead and the resulting customer relationship belong to Heseos; you earn a payout on it as set out in Section 4, but you don’t own or control how it’s handled afterwards. Any customer information collected through your referral is used only to follow up on that referral and is not sold to third parties.',
  },
  {
    title: '4. Payouts',
    body: 'Your payout is calculated as a percentage of converted sale value, per the tiered schedule shown in your Rewards & Earnings tab, which Heseos may revise from time to time — the rate that applies is always the one in effect when a sale converts. Payouts are settled periodically outside this app (bank transfer, UPI, or another method Heseos chooses) once a sale is confirmed converted; there is no fixed payout date and no guarantee of any minimum amount. You are responsible for the accuracy of the bank details you provide and for any taxes applicable to payouts you receive.',
  },
  {
    title: '5. QR Codes & Marketing Materials',
    body: 'Your physical QR code sticker and any marketing materials we provide remain the property of Heseos and are licensed to you for display at your business only. You may not reproduce, resell, or transfer them to another person or location. If your account is terminated, any QR code linked to it is deactivated and stops crediting new referrals to you.',
  },
  {
    title: '6. Code of Conduct',
    body: 'When referring customers, you must not misrepresent Heseos, its products, pricing, or your relationship with Heseos, and must comply with all applicable laws. Heseos may decline to pay out, or may terminate your account, where a referral was obtained through misrepresentation or in breach of this section.',
  },
  {
    title: '7. Term & Termination',
    body: 'You may stop participating at any time by contacting support. Heseos may suspend or terminate your account at any time for a breach of these terms, or on reasonable notice for any other reason. Payouts already earned on converted sales as of the termination date will still be settled; no further referrals are credited to a deactivated account.',
  },
  {
    title: '8. Limitation of Liability',
    body: 'The Program is provided on an as-is basis. Heseos is not liable for indirect or consequential losses arising from your participation in the Program, including delays in referrals, changes to payout tiers, or technical issues with the app, to the maximum extent permitted by law.',
  },
  {
    title: '9. Governing Law',
    body: 'These terms are governed by the laws of India, and any dispute arising from them is subject to the exclusive jurisdiction of the courts in Pune, Maharashtra.',
  },
  {
    title: '10. Changes to These Terms',
    body: 'Heseos may update these terms from time to time; the current version is always available here. Continuing to participate in the Program after an update means you accept the revised terms.',
  },
];

export default function TermsScreen() {
  return (
    <>
      <ScreenHeader title="Terms & Conditions" backHref="/partner/home?tab=profile" />

      <div style={{ padding: '0 16px' }}>
        <div className="hp-card">
          <div style={{ fontSize: 11.5, color: 'var(--hp-text-faint)', marginBottom: 6 }}>Last updated: September 2026</div>
          <div style={{ fontSize: 13, color: 'var(--hp-text-soft)', lineHeight: 1.6 }}>
            These are the terms of the Heseos Partner Program, covering how referrals, QR codes and payouts work between you and Heseos Technologies Pvt. Ltd.
          </div>
        </div>

        {SECTIONS.map((s) => (
          <div className="hp-card" key={s.title}>
            <div className="hp-card-title" style={{ fontSize: 14.5 }}>{s.title}</div>
            <div style={{ fontSize: 13, color: 'var(--hp-text-soft)', lineHeight: 1.6 }}>{s.body}</div>
          </div>
        ))}

        <div className="hp-card" style={{ background: 'var(--hp-warn-dim)', border: '1px solid var(--hp-warn)' }}>
          <div style={{ fontSize: 12, color: 'var(--hp-warn)', lineHeight: 1.6 }}>
            These are Heseos’s own Partner Program terms, written to describe how the program works today — they’re a starting point, not legal advice. Please have them reviewed by a lawyer before relying on them as binding legal terms.
          </div>
        </div>
      </div>
    </>
  );
}
