"use client";
// The single Partner-app landing page — Home, Leads, Rewards and Profile all render here now,
// switched by ?tab= instead of a separate route each (mirrors components/team/TeamHome.jsx /
// components/admin/AdminHome.jsx). Same lazy-mount-then-keep-alive trick: the first time a tab
// is opened it mounts and fetches its own data (DashboardScreen/MyLeadsScreen/RewardsScreen each
// self-fetch /api/leads now — see their own files), but after that it's kept mounted and just
// hidden, so switching back is instant with no refetch. Add Lead (/partner/leads/new) and Lead
// Detail (/partner/leads/[id]) are genuine wizard/per-item pages and stay separate routes — they
// aren't dashboard tabs.
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import DashboardScreen from "./DashboardScreen";
import MyLeadsScreen from "./MyLeadsScreen";
import RewardsScreen from "./RewardsScreen";
import ProfileScreen from "./ProfileScreen";

const KNOWN_TABS = new Set(["home", "leads", "rewards", "profile"]);

function renderTab(tab, partner) {
  switch (tab) {
    case "leads": return <MyLeadsScreen />;
    case "rewards": return <RewardsScreen />;
    case "profile": return <ProfileScreen partner={partner} />;
    default: return <DashboardScreen partner={partner} />;
  }
}

export default function PartnerHome({ partner }) {
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab") || "home";
  const active = KNOWN_TABS.has(rawTab) ? rawTab : "home";

  const [visited, setVisited] = useState(() => new Set([active]));
  useEffect(() => {
    setVisited((prev) => (prev.has(active) ? prev : new Set(prev).add(active)));
  }, [active]);

  return (
    <>
      {[...visited].map((tab) => (
        <div key={tab} style={{ display: tab === active ? "block" : "none" }}>
          {renderTab(tab, partner)}
        </div>
      ))}
    </>
  );
}
