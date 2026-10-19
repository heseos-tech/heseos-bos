import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import DeleteAccountForm from '@/components/DeleteAccountForm';

// Public account-deletion page — the "Delete account URL" Google Play requires for apps that let
// people create an account (Heseos Partner and Heseos Installer apps). Keep what it says in sync
// with lib/accountDeletion.js and the privacy policy (§7–8).
export const metadata = {
  title: 'Delete your account | Heseos',
  description: 'Request deletion of your Heseos Partner or Installer account and its associated data.',
};

const li = { fontSize: 15, color: 'var(--ink-soft)', lineHeight: 1.75, marginBottom: 6 };

export default function DeleteAccountPage() {
  return (
    <>
      <Navbar />
      <section style={{ paddingTop: '110px', paddingBottom: '80px' }}>
        <div className="container" style={{ maxWidth: '820px' }}>
          <div className="section-label">Account</div>
          <h1 className="section-title" style={{ fontSize: '38px', marginBottom: '8px' }}>Delete your Heseos account</h1>
          <p style={{ fontSize: '15px', color: 'var(--ink-soft)', lineHeight: 1.75, marginBottom: '28px' }}>
            This page is for people with a <strong>Heseos Partner</strong> or <strong>Heseos Installer</strong> account who want their account and associated data deleted. You can also do this inside either app: Profile → Delete Account.
          </p>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>What gets deleted</h2>
          <ul style={{ margin: '0 0 24px', paddingLeft: 20 }}>
            <li style={li}>Your name, business name, mobile number, password, address, city and GST number.</li>
            <li style={li}>Your bank / UPI details.</li>
            <li style={li}>Your QR code and referral link stop working, and any installation jobs you claimed but did not finish go back to other installers.</li>
          </ul>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>What we keep</h2>
          <ul style={{ margin: '0 0 24px', paddingLeft: 20 }}>
            <li style={li}>Leads you referred and the payout and order records linked to them — these are Heseos’s own customer and accounting records. They stay, but show as “Deleted partner” with none of your personal details.</li>
            <li style={li}>If you still have unpaid earnings we can’t delete the account yet, because the bank details needed to pay you are deleted with it. Once they are settled you can delete it, or email support@heseos.com and we will settle first.</li>
          </ul>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', marginBottom: 12 }}>Delete my account</h2>
          <DeleteAccountForm />

          <p style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.75, marginTop: 28 }}>
            Forgot your password or can’t use this form? Email <a href="mailto:support@heseos.com" style={{ color: 'var(--accent, #FF6B00)' }}>support@heseos.com</a> from your registered details or call +91-88550 74471 and we will delete the account for you.
          </p>
        </div>
      </section>
      <Footer />
    </>
  );
}
