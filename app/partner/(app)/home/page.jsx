import PartnerHome from '@/components/partner/PartnerHome';

// The single Partner-app route — Home, Leads, Rewards and Profile all render inside PartnerHome
// now, switched by ?tab= instead of a separate page each. See components/partner/PartnerHome.jsx.
//
// No server-side auth check here any more — that used to mean every navigation blocked on a DB
// round trip (via the (app) layout's getPartner()) before any HTML could be sent. AppShell (see
// ../layout.jsx) now checks the session client-side instead, so this page can ship instantly and
// PartnerHome reads the signed-in partner from context (usePartnerSession()) once the check
// resolves — see components/partner/ui.jsx's useSessionGate for the full reasoning.
export default function PartnerHomePage() {
  return <PartnerHome />;
}
