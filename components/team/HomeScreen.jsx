"use client";
// Team-app Home — role-scoped snapshot (mirrors DashboardScreen.jsx's shape: topbar, greeting,
// a small coverage chip instead of a wallet, a 4-card stat grid, and a recent-leads list) but
// backed by the SAME live-polling data model as the desktop PresalesPanel/SalesEngineerPanel,
// since sales-engineer "Available Leads" counts need to stay fresh (first-come-first-served).
import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { Avatar } from "@/components/partner/ui";
import { IconBell, IconLeads, IconGift, IconCheck, IconMapPin } from "@/components/partner/icons";
import { fmtDateTime } from "@/lib/date";
import { stageOf, displayStatus } from "@/lib/leadStage";
import { PROPERTY_TYPE } from "@/lib/formOptions";

const PT_LABEL = Object.fromEntries(PROPERTY_TYPE.map((p) => [p.v, p.l]));
function norm(s) { return String(s || "").trim().toLowerCase(); }

export default function TeamHomeScreen({ employee }) {
  const isPresales = employee.role === "presales";
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLeads = useCallback(async () => {
    try {
      const res = await fetch("/api/leads");
      if (res.ok) setLeads(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
    const t = setInterval(fetchLeads, isPresales ? 20000 : 15000);
    return () => clearInterval(t);
  }, [fetchLeads, isPresales]);

  const myCity = norm(employee.location);
  const available = useMemo(
    () => leads.filter((l) => l.demoScheduledAt && !l.salesEngineerId && myCity && norm(l.city) === myCity),
    [leads, myCity]
  );
  const mine = useMemo(
    () => leads.filter((l) => (isPresales ? l.assignedTo === employee.id : l.salesEngineerId === employee.id)),
    [leads, employee.id, isPresales]
  );

  const stats = useMemo(() => {
    if (isPresales) {
      let newC = 0, followupC = 0, demoC = 0, convC = 0;
      for (const l of mine) {
        const st = stageOf(l);
        if (st === "Converted") convC++;
        else if (st === "Demo Scheduled") demoC++;
        else if (l.contactStage === "follow_up") followupC++;
        else if (st === "New Lead") newC++;
      }
      return [
        { label: "New Leads", val: newC, icon: IconLeads },
        { label: "Follow-ups", val: followupC, icon: IconGift },
        { label: "Demo Scheduled", val: demoC, icon: IconGift },
        { label: "Converted", val: convC, icon: IconCheck },
      ];
    }
    let upcomingC = 0, quotedC = 0, convC = 0;
    for (const l of mine) {
      const st = stageOf(l);
      if (st === "Converted") convC++;
      else if (l.quotationSentAt) quotedC++;
      else if (l.demoScheduledAt) upcomingC++;
    }
    return [
      { label: `Available in ${employee.location || "your city"}`, val: available.length, icon: IconLeads },
      { label: "Upcoming Demos", val: upcomingC, icon: IconGift },
      { label: "Quotation Sent", val: quotedC, icon: IconGift },
      { label: "Converted", val: convC, icon: IconCheck },
    ];
  }, [isPresales, mine, available, employee.location]);

  const recent = useMemo(() => mine.slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 4), [mine]);
  const firstName = (employee.name || "there").split(" ")[0];
  const coverage = isPresales
    ? (Array.isArray(employee.cities) && employee.cities[0] === "ALL" ? "All Cities" : (employee.cities || []).join(", ") || employee.location || "—")
    : (employee.location || "No city set");

  return (
    <>
      <div className="hp-topbar">
        <img src="/brand/lockup-white.png" alt="Heseos — Lighting Ahead" className="hp-brand-logo hp-brand-logo-sm" />
        <div className="hp-topbar-right">
          <button className="hp-bell" aria-label="Notifications"><IconBell size={18} /></button>
          <Link href="/team/profile"><Avatar name={employee.name} /></Link>
        </div>
      </div>

      <div className="hp-greet-row">
        <div>
          <div className="hp-greet-title">Hi, {firstName}! 👋</div>
          <div className="hp-greet-sub">{isPresales ? "Here's your lead overview" : "Here's what needs you today"}</div>
        </div>
        <div className="hp-wallet-chip">
          <div>
            <div className="hp-wallet-label" style={{ display: "flex", alignItems: "center", gap: 4 }}><IconMapPin size={11} /> Coverage</div>
            <div className="hp-wallet-val" style={{ fontSize: 13 }}>{coverage}</div>
          </div>
        </div>
      </div>

      <div className="hp-stat-grid">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div className="hp-stat-card" key={s.label}>
              <div className="hp-stat-icon"><Icon size={16} /></div>
              <div className="hp-stat-val">{s.val}</div>
              <div className="hp-stat-label">{s.label}</div>
            </div>
          );
        })}
      </div>

      {!isPresales && !myCity && (
        <div className="hp-card" style={{ background: "var(--hp-warn-dim)", border: "1px solid var(--hp-warn)" }}>
          <div className="hp-summary-label" style={{ color: "var(--hp-warn)" }}>Your profile has no city set — ask an admin to set it so open demos in your city show up here.</div>
        </div>
      )}

      <div className="hp-section-head" style={{ marginTop: 0 }}>
        <div className="hp-section-title">Recent Leads</div>
        <Link className="hp-view-all" href="/team/leads">View All</Link>
      </div>

      {loading ? (
        <div className="hp-empty"><div className="hp-empty-sub">Loading…</div></div>
      ) : recent.length === 0 ? (
        <div className="hp-empty">
          <div className="hp-empty-icon"><IconLeads size={24} /></div>
          <div className="hp-empty-title">No leads yet</div>
          <div className="hp-empty-sub">{isPresales ? "New leads assigned to you will show up here." : "Claim an available demo to get started."}</div>
        </div>
      ) : (
        <div className="hp-lead-list">
          {recent.map((l) => {
            const status = displayStatus(l);
            return (
              <Link key={l.id} href={`/team/leads/${l.id}`} className="hp-lead-card">
                <Avatar name={l.name} />
                <div className="hp-lead-info">
                  <div className="hp-lead-name">{l.name}</div>
                  <div className="hp-lead-meta">{PT_LABEL[l.propertyType] || "Enquiry"} · {l.city}</div>
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

      <div className="hp-cta-block" style={{ paddingBottom: 24 }}>
        <Link href="/team/leads" className="hp-btn hp-btn-primary hp-btn-block">
          {isPresales ? "View My Leads" : available.length > 0 ? `View ${available.length} Available Lead${available.length === 1 ? "" : "s"}` : "View My Leads"}
        </Link>
      </div>
    </>
  );
}
