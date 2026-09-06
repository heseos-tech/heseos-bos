'use client';
// Profile → How It Works. A static walk-through of the referral program end to end — written
// once here rather than scattered as tooltips, since a partner usually wants the whole picture
// the first time, not a hint per screen. Kept in terms of what's actually true in this codebase
// (QR/referral link → WhatsApp lead → tiered payout on conversion) rather than any invented
// numbers — the live rate always lives on the Rewards tab since it's admin-configurable.
import { ScreenHeader } from './ui';
import { IconQrCode, IconLeads, IconWallet, IconBank, IconCheck } from './icons';

const STEPS = [
  {
    icon: IconQrCode,
    title: '1. Share your QR code or referral link',
    body: 'Stick your pre-printed Heseos QR code at your counter, or share your personal referral link from Profile → Referral Link. Either one works the same way — a customer scans or taps it and it opens straight into WhatsApp with Heseos, already tagged to you.',
  },
  {
    icon: IconLeads,
    title: '2. The customer chats with us on WhatsApp',
    body: 'Our WhatsApp assistant asks a few quick questions — what they need, their property type, budget and timeline — and the moment they reply, a lead shows up in your Leads tab, tagged with your name automatically.',
  },
  {
    icon: IconCheck,
    title: '3. Our team follows up and closes the sale',
    body: 'A Heseos sales engineer takes it from there — demo, quotation, and closing the sale. You can track every stage of that lead right from your Leads tab, no need to chase anyone for an update.',
  },
  {
    icon: IconWallet,
    title: '4. You earn on every converted sale',
    body: 'Once a lead you referred converts, it counts toward your payout for that period at your current tier — the more you convert, the higher your rate climbs. Check Rewards & Earnings any time to see this period’s numbers and tier ladder.',
  },
  {
    icon: IconBank,
    title: '5. Get paid',
    body: 'We settle payouts periodically by bank transfer or UPI — add your bank details once from Profile → Bank Details so there’s no back-and-forth when it’s time to pay you, then track every settlement in Profile → Payout History.',
  },
];

export default function HowItWorksScreen() {
  return (
    <>
      <ScreenHeader title="How It Works" backHref="/partner/home?tab=profile" />

      <div style={{ padding: '0 16px' }}>
        <div className="hp-card">
          <div style={{ fontSize: 13, color: 'var(--hp-text-soft)', lineHeight: 1.6 }}>
            The Heseos Partner Program turns the customers walking into your shop — or asking you for a recommendation — into smart-home automation sales you get paid for, without you having to do the selling yourself.
          </div>
        </div>

        {STEPS.map((s, i) => {
          const Icon = s.icon;
          return (
            <div className="hp-card" key={i}>
              <div className="hp-review-item" style={{ alignItems: 'flex-start', marginBottom: 10 }}>
                <div className="hp-review-icon"><Icon size={17} /></div>
                <div className="hp-card-title" style={{ margin: 0 }}>{s.title}</div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--hp-text-soft)', lineHeight: 1.6 }}>{s.body}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}
