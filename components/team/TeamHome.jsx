"use client";
// The single Team-app landing page — Home, Leads and Profile all render here now, switched by
// ?tab= instead of a separate route each (mirrors components/admin/AdminHome.jsx). Same
// lazy-mount-then-keep-alive trick: the first time a tab is opened it mounts and fetches its
// own data exactly as before (HomeScreen/LeadsScreen already poll independently — that's
// unchanged), but after that it's kept mounted and just hidden, so switching back is instant
// with no refetch. Lead Detail (/team/leads/[id]) is a genuine per-item page and stays a
// separate route — it isn't a dashboard tab.
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import TeamHomeScreen from "./HomeScreen";
import TeamLeadsScreen from "./LeadsScreen";
import TeamProfileScreen from "./ProfileScreen";
import TeamRewardsScreen from "./RewardsScreen";

const KNOWN_TABS = new Set(["home", "leads", "rewards", "profile"]);

function renderTab(tab, employee) {
  switch (tab) {
    case "leads": return <TeamLeadsScreen employee={employee} />;
    case "rewards": return <TeamRewardsScreen employee={employee} />;
    case "profile": return <TeamProfileScreen employee={employee} />;
    default: return <TeamHomeScreen employee={employee} />;
  }
}

export default function TeamHome({ employee }) {
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
          {renderTab(tab, employee)}
        </div>
      ))}
    </>
  );
}
