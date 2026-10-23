import './investors.css';

export const metadata = {
  title: 'Heseos — Investment Proposal',
  description: 'Confidential. Access requires accepting the Heseos NDA.',
  robots: { index: false, follow: false, nocache: true },
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
