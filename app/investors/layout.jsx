import './investors.css';

// What shows when the /investors link is shared (WhatsApp, LinkedIn, email, Slack…). Deliberately
// teaser-only — no figures or deal terms — since the proposal itself is behind the NDA gate.
// metadataBase makes the preview image URL absolute; set PUBLIC_BASE_URL to the BOS domain on Vercel.
const TITLE = 'Heseos — Investment Proposal';
const DESCRIPTION = 'Confidential. Accept the NDA and verify on WhatsApp to read the Heseos investment proposal.';

export const metadata = {
  metadataBase: new URL(process.env.PUBLIC_BASE_URL || 'https://bos.heseos.com'),
  title: TITLE,
  description: DESCRIPTION,
  robots: { index: false, follow: false, nocache: true },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: '/investors',
    siteName: 'Heseos',
    type: 'website',
    images: [{ url: '/og/investors.png', width: 1200, height: 630, alt: 'Heseos investment proposal — accept NDA, verify on WhatsApp, read the proposal' }],
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: ['/og/investors.png'] },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0a0a0b',
};

export default function InvestorsLayout({ children }) {
  return children;
}
