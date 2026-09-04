"use client";
// The single admin "page" — every sidebar section renders here, never as a separate route.
// Mirrors the MARG platform's single-page admin: clicking a tab never triggers a fresh page
// load or a fresh data fetch. Each section component is exactly the same component the old
// per-route pages used (DashboardPage, LeadsPage, etc.) — nothing about their internals
// changed. The only thing that's new is how they're mounted: the first time a tab is opened
// it mounts (and fetches its own data, same as before); after that it's kept mounted forever
// and just hidden with display:none, so switching back to it is instant and never refetches.
// The active tab lives in the URL (?tab=leads) so it's still bookmarkable/shareable and
// survives a refresh — it just no longer causes a full navigation between sections.
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import DashboardPage from "./DashboardPage";
import LeadsPage from "./LeadsPage";
import PartnersPage from "./PartnersPage";
import SalesEngineersPage from "./SalesEngineersPage";
import PresalesPage from "./PresalesPage";
import ReportsPage from "./ReportsPage";
import SettingsPage from "./SettingsPage";
import GrowthPage from "./GrowthPage";
import ProductsPage from "./ProductsPage";
import QuotationsPage from "./QuotationsPage";
import TasksPage from "./TasksPage";
import DemoSchedulePage from "./DemoSchedulePage";
import ConversionsPage from "./ConversionsPage";
import PayoutsPage from "./PayoutsPage";

function renderTab(tab, employee) {
  switch (tab) {
    case "dashboard": return <DashboardPage employee={employee} />;
    case "leads": return <Suspense fallback={<div className="adm-empty">Loading…</div>}><LeadsPage /></Suspense>;
    case "partners": return <PartnersPage />;
    case "sales-engineers": return <SalesEngineersPage />;
    case "presales": return <PresalesPage />;
    case "reports": return <ReportsPage />;
    case "settings": return <SettingsPage />;
    case "growth": return <GrowthPage />;
    case "products": return <ProductsPage />;
    case "quotations": return <QuotationsPage />;
    case "tasks": return <TasksPage />;
    case "demo-schedule": return <DemoSchedulePage />;
    case "conversions": return <ConversionsPage />;
    case "payouts": return <PayoutsPage />;
    default: return <DashboardPage employee={employee} />;
  }
}

const KNOWN_TABS = new Set(["dashboard", "leads", "partners", "sales-engineers", "presales", "reports", "settings", "growth", "products", "quotations", "tasks", "demo-schedule", "conversions", "payouts"]);

export default function AdminHome({ employee }) {
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab") || "dashboard";
  const active = KNOWN_TABS.has(rawTab) ? rawTab : "dashboard";

  // Every tab that's ever been opened stays in this set for the life of the page — that's the
  // whole caching mechanism. No cache invalidation, no timers: a hard refresh is the only way
  // to force a section to refetch, same as the old separate-route version did on every visit.
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
