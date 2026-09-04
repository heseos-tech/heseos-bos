import CatalogueScreen from '@/components/partner/CatalogueScreen';

// Reuses Partner's CatalogueScreen (components/partner/CatalogueScreen.jsx) rather than forking
// it — the Team App already reuses Partner's ui.jsx/icons.jsx for exactly this reason (same
// hp-* design system, both apps load the same app/partner/partner-app.css). Only backHref
// differs, since Team's home route is /team/home, not /partner/home.
export default function TeamCataloguePage() {
  return <CatalogueScreen backHref="/team/home" />;
}
