'use client';
// Profile → Help & Support. Contact details as given by the business (phone, email, office
// address), plus a short FAQ covering the questions a partner is most likely to actually have —
// pulled from what this app can really do (QR claiming, lead tagging, payout timing) rather than
// generic filler.
import { useState } from 'react';
import { ScreenHeader } from './ui';
import { IconPhone, IconMail, IconMapPin, IconChevronDown } from './icons';

const CONTACT = {
  phone: '+91-88550 74471',
  phoneHref: 'tel:+918855074471',
  email: 'support@heseos.com',
  address: '201, Heseos Technologies Pvt. Ltd., Bootstart, Kharadi, Pune, MH, 411014',
};

const FAQS = [
  {
    q: 'How do I link the QR code I was given?',
    a: 'Go to Profile → QR Code and type in the code printed on your sticker under “Link a QR code”. Once linked, every scan of that code is credited to you — including any leads that came in before you linked it.',
  },
  {
    q: 'What’s the difference between my QR code and my referral link?',
    a: 'Both credit leads to you the same way. Your QR code is a physical sticker for your shop counter, printed and handed to you by our team; your referral link is a digital link you can share yourself over WhatsApp, SMS or social media from Profile → Referral Link.',
  },
  {
    q: 'When do I get paid?',
    a: 'We settle payouts periodically by bank transfer or UPI, based on the sales you’ve referred that converted. Add your bank details in Profile → Bank Details, and track every past settlement in Profile → Payout History.',
  },
  {
    q: 'Why doesn’t a lead show my customer’s name correctly?',
    a: 'Occasionally a customer re-opens the WhatsApp link instead of typing their answer, which can send us the link text again instead of their name. If that happens on one of your leads, message our support team below and we’ll get it corrected.',
  },
  {
    q: 'Can I refer more than one customer at a time?',
    a: 'Yes — there’s no limit. Every customer who messages us through your QR code or referral link becomes a separate lead tagged to you.',
  },
];

function FaqItem({ faq }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="hp-faq-item">
      <button type="button" className="hp-faq-q" onClick={() => setOpen((o) => !o)}>
        <span>{faq.q}</span>
        <span className={`hp-faq-chev${open ? ' open' : ''}`}><IconChevronDown size={16} /></span>
      </button>
      {open && <div className="hp-faq-a">{faq.a}</div>}
    </div>
  );
}

export default function HelpSupportScreen() {
  return (
    <>
      <ScreenHeader title="Help & Support" backHref="/partner/home?tab=profile" />

      <div style={{ padding: '0 16px' }}>
        <div className="hp-card">
          <div className="hp-card-title">Contact Us</div>
          <a className="hp-detail-line" href={CONTACT.phoneHref} style={{ padding: '0 0 14px' }}>
            <IconPhone size={16} /> {CONTACT.phone}
          </a>
          <a className="hp-detail-line" href={`mailto:${CONTACT.email}`} style={{ padding: '0 0 14px' }}>
            <IconMail size={16} /> {CONTACT.email}
          </a>
          <div className="hp-detail-line" style={{ padding: 0, alignItems: 'flex-start' }}>
            <IconMapPin size={16} style={{ marginTop: 2, flexShrink: 0 }} /> <span>{CONTACT.address}</span>
          </div>
        </div>

        <div className="hp-card">
          <div className="hp-card-title">Frequently Asked Questions</div>
          {FAQS.map((f, i) => <FaqItem key={i} faq={f} />)}
        </div>
      </div>
    </>
  );
}
