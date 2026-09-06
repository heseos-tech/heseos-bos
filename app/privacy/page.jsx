import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

// Public privacy policy — required by Google Play Console (App content → Privacy policy) and
// the App Store for the Partner/Team native app listings, and a reasonable thing to have at a
// stable URL regardless. Written to match how this codebase actually collects and uses data —
// not boilerplate — same approach as components/partner/TermsScreen.jsx. Starting point for the
// business, not legal advice; see the disclaimer at the bottom.
export const metadata = {
  title: 'Privacy Policy | Heseos',
  description: 'How Heseos Technologies Pvt. Ltd. collects, uses and protects data across the Heseos website, Partner app, Team app and Admin panel.',
};

const SECTIONS = [
  {
    title: '1. Who this applies to',
    body: 'This policy covers heseos.com and the Heseos platform generally, including the public website and lead enquiry forms, the Partner app and portal, the Team (Pre-sales / Sales Engineer) app, and the internal Admin panel. It applies whether you’re a customer submitting an enquiry, a Partner referring customers to us, or a Heseos employee using the internal tools.',
  },
  {
    title: '2. Information we collect',
    body: 'Customers/leads: name, phone number, city, property type, and details you share about your automation enquiry, whether submitted directly, via a Partner’s referral link/QR code, or via WhatsApp. Partners: name, business/partner name, phone, email, password (stored as a salted hash, never in plain text), partner category, address details, and bank details you provide for payout settlement. Employees: name, email, phone and role, used to operate the internal Team/Admin tools. We do not collect payment card numbers, government ID numbers, or other sensitive identifiers through this platform.',
  },
  {
    title: '3. How we use it',
    body: 'We use this information to respond to enquiries and run demos, to track and pay out Partner referrals as described in the Partner Program Terms, to let our Pre-sales and Sales Engineer team manage their assigned leads and tasks, and to let Admins operate and report on the business. We do not sell your information to third parties, and we do not use it for advertising or ad-targeting — this platform does not run ads and does not include any third-party analytics or advertising trackers.',
  },
  {
    title: '4. Cookies & sessions',
    body: 'The Partner, Team and Admin apps use a single signed session cookie to keep you logged in — it identifies your account and nothing else, expires on logout, and is not shared with or readable by any third party. We don’t use third-party tracking or advertising cookies on this platform.',
  },
  {
    title: '5. Native app permissions (Partner/Team app)',
    body: 'The Heseos Partner and Team apps are a native wrapper around this same website. They don’t request access to your contacts, location, camera, microphone, or photo library beyond what your device’s browser already provides for a web page you visit, and don’t collect any device data beyond standard, non-identifying technical information needed to load the app.',
  },
  {
    title: '6. Sharing & disclosure',
    body: 'Customer/lead information referred by a Partner is shared internally with our Pre-sales and Sales Engineer team so they can follow up — it is not shared back with other Partners or with third parties. We may disclose information where required by law, or to service providers who host our infrastructure (for example our cloud hosting and database providers) strictly to operate the platform on our behalf, under confidentiality obligations.',
  },
  {
    title: '7. Data retention',
    body: 'We retain account information for as long as your Partner, Team or Admin account is active, and lead/customer information for as long as reasonably needed to service the enquiry and maintain accurate business records. You can ask us to delete your Partner account and associated data by contacting support, subject to any records we’re required to keep for accounting or legal reasons.',
  },
  {
    title: '8. Your choices',
    body: 'You can review and update your own Partner profile details (including business/partner details, address and bank details) directly from the app’s My Profile screen at any time. For any other request — including account deletion — contact us using the details below.',
  },
  {
    title: '9. Security',
    body: 'Passwords are stored as salted cryptographic hashes, never in plain text. Sessions are authenticated with a signed, tamper-evident cookie. As with any online service, no method of transmission or storage is 100% secure, but we take reasonable measures to protect the information described in this policy.',
  },
  {
    title: '10. Changes to this policy',
    body: 'We may update this policy from time to time to reflect how the platform actually works; the current version is always available at this page.',
  },
  {
    title: '11. Contact us',
    body: 'Questions about this policy or your data: support@heseos.com, +91-88550 74471, or Heseos Technologies Pvt. Ltd., 201, Bootstart, Kharadi, Pune, Maharashtra, 411014.',
  },
];

export default function PrivacyPolicyPage() {
  return (
    <>
      <Navbar />
      <section style={{ paddingTop: '110px', paddingBottom: '80px' }}>
        <div className="container" style={{ maxWidth: '820px' }}>
          <div className="section-label">Legal</div>
          <h1 className="section-title" style={{ fontSize: '38px', marginBottom: '8px' }}>Privacy Policy</h1>
          <p style={{ fontSize: '13px', color: 'var(--ink-soft)', marginBottom: '36px' }}>Last updated: September 2026</p>

          {SECTIONS.map((s) => (
            <div key={s.title} style={{ marginBottom: '28px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--ink)', marginBottom: '8px' }}>{s.title}</h2>
              <p style={{ fontSize: '15px', color: 'var(--ink-soft)', lineHeight: 1.75 }}>{s.body}</p>
            </div>
          ))}

          <div style={{ marginTop: '40px', padding: '16px 18px', borderRadius: '12px', background: '#FFF7ED', border: '1px solid #FDBA74' }}>
            <p style={{ fontSize: '13px', color: '#9A5B1F', lineHeight: 1.6, margin: 0 }}>
              This is Heseos’s own privacy policy, written to describe how the platform works today — it’s a starting point, not legal advice. Please have it reviewed by a lawyer, particularly if you collect data from users in jurisdictions with specific requirements (e.g. GDPR, DPDP Act).
            </p>
          </div>
        </div>
      </section>
      <Footer />
    </>
  );
}
