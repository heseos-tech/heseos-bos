"use client";
// The single Installer-app landing page — Home, Jobs, Earnings, Profile (and My Leads / Referral
// Rewards, reached from cards) switched by ?tab=. Same lazy-mount-then-keep-alive trick as the
// Partner and Team apps, so switching tabs is instant after the first visit.
import { useEffect, useState } from "react";
import { useDashboardTab } from "@/components/partner/ui";
import { useInstallerSession } from "./ui";
import InstallerDashboard from "./InstallerDashboard";
import JobsScreen from "./JobsScreen";
import EarningsScreen from "./EarningsScreen";
import MyLeadsScreen from "@/components/partner/MyLeadsScreen";
import RewardsScreen from "@/components/partner/RewardsScreen";
import ProfileScreen from "@/components/partner/ProfileScreen";

const KNOWN_TABS = new Set(["home", "jobs", "earnings", "leads", "referrals", "profile"]);

function renderTab(tab, partner) {
  switch (tab) {
    case "jobs": return <JobsScreen partner={partner} embedded />;
    case "earnings": return <EarningsScreen />;
    case "leads": return <MyLeadsScreen />;
    case "referrals": return <RewardsScreen />;
    case "profile": return <ProfileScreen partner={partner} />;
    default: return <InstallerDashboard partner={partner} />;
  }
}

export default function InstallerHome() {
  const partner = useInstallerSession();
  const { tab: rawTab } = useDashboardTab();
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
