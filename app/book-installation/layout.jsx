import '../partner/partner-app.css';

// Public, no-login "Book your installation" page a customer opens from the button on the
// order-delivered WhatsApp message (lib/installBooking.js). Same dark .hp-* look as the apps.
export const metadata = {
  title: 'Book your installation | Heseos',
  robots: { index: false, follow: false },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#060f1c',
};

export default function BookInstallationLayout({ children }) {
  return children;
}
