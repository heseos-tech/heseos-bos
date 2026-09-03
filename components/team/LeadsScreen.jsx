"use client";
// Team-app "My Leads" — same tab groupings as the desktop PresalesPanel / SalesEngineerPanel
// (New/Follow-ups/Demo Scheduled/Converted/Rejected for pre-sales; Available/Upcoming/Needs
// Reschedule/Quoted/Converted/Lost for sales engineers), rendered as mobile cards instead of a
// table. Tapping a card opens the Lead Detail screen, where all the actions live.
import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Avatar } from "@/components/partner/ui";
import { IconLeads } from "@/components/partner/icons";
import { fmtDate, fmtDateTime } from "@/lib/date";
import { stageOf, displayStatus, isFollowUpLead, needsReschedule } from "@/lib/leadStage";
import { PROPERTY_TYPE } from "@/lib/formOptions";
import { useApiResource } from "@/lib/useApiResource";

const PT_LABEL = Object.fromEntries(PROPERTY_TYPE.map((p) => [p.v, p.l]));
function norm(s) { return String(s || "").trim().toLowerCase(); }

export default function TeamLeadsScreen({ employee }) {
  const isPresales = employee.role === "presales";
  const searchParams = useSearchParams();
  // Shared with HomeScreen (and, once visited, the desktop panels) via useApiResource
  // (lib/useApiResource.js) — Home and Leads both stay mounted together in TeamHome, so this
  // avoids two independent fetch-then-poll loops hitting /api/leads for the same data.
  const { data: leads, loading } = useApiResource("/api/leads", { pollMs: isPresales ? 20000 : 15000 });
  const [tab, setTab] = useState(searchParams.get("status") || (isPresales ? "new" : "available"));

  // LeadsScreen stays mounted after the first visit (see TeamHome), so a fresh navigation here —
  // e.g. a Home stat-card linking to ?tab=leads&status=followup — no longer remounts this
  // component. Without this, the tab filter above (set once from the URL at mount) would never
  // pick up a later change. React to it explicitly instead (mirrors admin/LeadsPage.jsx's bucket sync).
  useEffect(() => {
    const s = searchParams.get("status");
    if (s) setTab(s);
  }, [searchParams]);

  const myCity = norm(employee.location);
  const available = useMemo(
    () => leads.filter((l) => l.demoScheduledAt && !l.salesEngineerId && myCity && norm(l.city) === myCity),
    [leads, myCity]
  );
  const mine = useMemo(
    () => leads.filter((l) => (isPresales ? l.assignedTo === employee.id : l.salesEngineerId === employee.id)),
    [leads, employee.id, isPresales]
  );

  const TABS = useMemo(() => {
    if (isPresales) {
      const g = { new: [], followup: [], demo: [], converted: [], rejected: [] };
      for (const l of mine) {
        const st = stageOf(l);
        if (st === "Rejected") g.rejected.push(l);
        else if (st === "Converted") g.converted.push(l);
        else if (st === "Demo Scheduled") g.demo.push(l);
        else if (isFollowUpLead(l)) g.followup.push(l);
        else g.new.push(l);
      }
      return [
        { key: "new", label: "New", list: g.new },
        { key: "followup", label: "Follow-ups", list: g.followup },
        { key: "demo", label: "Demo Scheduled", list: g.demo },
        { key: "converted", label: "Converted", list: g.converted },
        { key: "rejected", label: "Rejected", list: g.rejected },
        { key: "all", label: "All Mine", list: mine },
      ];
    }
    const g = { upcoming: [], reschedule: [], quoted: [], converted: [], lost: [] };
    for (const l of mine) {
      const st = stageOf(l);
      if (st === "Rejected") g.lost.push(l);
      else if (st === "Converted") g.converted.push(l);
      else if (needsReschedule(l)) g.reschedule.push(l);
      else if (l.quotationSentAt) g.quoted.push(l);
      else if (l.demoScheduledAt) g.upcoming.push(l);
    }
    return [
      { key: "available", label: "Available", list: available },
      { key: "upcoming", label: "Upcoming", list: g.upcoming },
      { key: "reschedule", label: "Reschedule", list: g.reschedule },
      { key: "quoted", label: "Quoted", list: g.quoted },
      { key: "converted", label: "Converted", list: g.converted },
      { key: "lost", label: "Lost", list: g.lost },
      { key: "all", label: "All Mine", list: mine },
    ];
  }, [isPresales, mine, available]);

  const active = TABS.find((t) => t.key === tab) || TABS[0];

  return (
    <>
      <div className="hp-header" style={{ paddingBottom: 4 }}>
        <div className="hp-header-title" style={{ fontSize: 21, fontWeight: 800 }}>{isPresales ? "My Leads" : "My Demos"}</div>
      </div>

      <div className="hp-tabs">
        {TABS.map((t) => (
          <button key={t.key} className={`hp-tab${tab === t.key ? " active" : ""}`} onClick={() => setTab(t.key)}>
            {t.label} ({t.list.length})
          </button>
        ))}
      </div>

      {!isPresales && tab === "available" && !myCity && (
        <div className="hp-card" style={{ background: "var(--hp-warn-dim)", border: "1px solid var(--hp-warn)" }}>
          <div className="hp-summary-label" style={{ color: "var(--hp-warn)" }}>Your profile has no city set — ask an admin to set it so open demos show up here.</div>
        </div>
      )}

      {loading ? (
        <div className="hp-empty"><div className="hp-empty-sub">Loading…</div></div>
      ) : active.list.length === 0 ? (
        <div className="hp-empty">
          <div className="hp-empty-icon"><IconLeads size={24} /></div>
          <div className="hp-empty-title">Nothing here</div>
          <div className="hp-empty-sub">{tab === "available" ? "No open demos in your city right now." : "Try a different tab."}</div>
        </div>
      ) : (
        <div className="hp-lead-list">
          {active.list.map((l) => {
            const status = tab === "available" ? { label: "Open — unclaimed", c: "#38bdf8", bg: "var(--hp-info-dim)" } : displayStatus(l);
            return (
              <Link key={l.id} href={`/team/leads/${l.id}`} className="hp-lead-card">
                <Avatar name={l.name} />
                <div className="hp-lead-info">
                  <div className="hp-lead-name">{l.name}</div>
                  <div className="hp-lead-meta">{PT_LABEL[l.propertyType] || "Enquiry"} · {l.city}</div>
                  {l.demoDate && <div className="hp-lead-meta">{fmtDate(l.demoDate)} · {l.demoTime}</div>}
                </div>
                <div className="hp-lead-right">
                  <span className="hp-badge" style={{ color: status.c, background: status.bg }}><span className="hp-badge-dot" />{status.label}</span>
                  <span className="hp-lead-time">{fmtDateTime(l.createdAt)}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
