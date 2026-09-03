"use client";
// Team-app Home — role-scoped snapshot (mirrors DashboardScreen.jsx's shape: topbar, greeting,
// a small coverage chip instead of a wallet, a 4-card stat grid, and a recent-leads list) but
// backed by the SAME live-polling data model as the desktop PresalesPanel/SalesEngineerPanel,
// since sales-engineer "Available Leads" counts need to stay fresh (first-come-first-served).
import { useMemo } from "react";
import Link from "next/link";
import { Avatar } from "@/components/partner/ui";
import { IconBell, IconLeads, IconGift, IconCheck, IconMapPin, IconWallet } from "@/components/partner/icons";
import { fmtDateTime } from "@/lib/date";
import { stageOf, displayStatus } from "@/lib/leadStage";
import { PROPERTY_TYPE } from "@/lib/formOptions";
import { useApiResource } from "@/lib/useApiResource";
import { payoutFor } from "@/lib/payout";

const PT_LABEL = Object.fromEntries(PROPERTY_TYPE.map((p) => [p.v, p.l]));
function norm(s) { return String(s || "").trim().toLowerCase(); }

export default function TeamHomeScreen({ employee }) {
  const isPresales = employee.role === "presales";
  // Shared with LeadsScreen (and, once visited, the desktop panels) via useApiResource
  // (lib/useApiResource.js) — Home and Leads both stay mounted together in TeamHome, so this
  // avoids two independent fetch-then-poll loops hitting /api/leads for the same data.
  const { data: leads, loading } = useApiResource("/api/leads", { pollMs: isPresales ? 20000 : 15000 });
  const { data: payoutConfig } = useApiResource("/api/payout-settings");

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
        { key: "new", label: "New Leads", val: newC, icon: IconLeads },
        { key: "followup", label: "Follow-ups", val: followupC, icon: IconGift },
        { key: "demo", label: "Demo Scheduled", val: demoC, icon: IconGift },
        { key: "converted", label: "Converted", val: convC, icon: IconCheck },
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
      { key: "available", label: `Available in ${employee.location || "your city"}`, val: available.length, icon: IconLeads },
      { key: "upcoming", label: "Upcoming Demos", val: upcomingC, icon: IconGift },
      { key: "quoted", label: "Quotation Sent", val: quotedC, icon: IconGift },
      { key: "converted", label: "Converted", val: convC, icon: IconCheck },
    ];
  }, [isPresales, mine, available, employee.location]);

  const recent = useMemo(() => mine.slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 4), [mine]);
  // Leads THIS employee personally added via the Team App's Add Lead wizard (addedByEmployeeId
  // — see app/api/leads/route.js), not leads merely assigned/claimed for them to work
  // (assignedTo/salesEngineerId, used above for `mine`). Same shared tiered ladder as Partner
  // Rewards and Settings → Lead Conversion Payout — lib/payout.js.
  const myReferrals = useMemo(() => leads.filter((l) => l.addedByEmployeeId === employee.id), [leads, employee.id]);
  const payout = useMemo(() => payoutFor(myReferrals, payoutConfig, 'employee'), [myReferrals, payoutConfig]);
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
          <Link href="/team/home?tab=profile"><Avatar name={employee.name} /></Link>
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

      <div className="hp-promo">
        <div className="hp-promo-img" style={{ backgroundImage: "url('/User-home-screen.webp')" }} />
        <div className="hp-promo-fade" />
        <div className="hp-promo-text">
          <div className="hp-h3">Smart homes.<br /><span className="hp-accent-text">Brighter results.</span></div>
          <div className="hp-sub-sm">Let&rsquo;s close together.</div>
        </div>
      </div>

      {(payout.hasTiers || myReferrals.length > 0) && (
        <Link href="/team/leads/new" className="hp-earn-hero" style={{ display: "block" }}>
          <div className="hp-earn-icon"><IconWallet size={20} /></div>
          {/* This is REFERRAL payout — leads this employee added (addedByEmployeeId), paid out
              regardless of who ends up working/converting them. It has nothing to do with the
              demos/leads a sales engineer or presales person is personally assigned to work —
              that's a separate "job" concern with no incentive plan defined yet, so the label
              stays "Referral" for both roles rather than following the Lead/Demo role split. */}
          <div className="hp-earn-label">Referral Payout — This {payout.period === "quarterly" ? "Quarter" : "Month"}</div>
          <div className="hp-earn-val">₹{payout.payout.toLocaleString("en-IN")}</div>
          <div className="hp-earn-period">
            {payout.hasTiers ? `${payout.rate}% of ₹${payout.totalValue.toLocaleString("en-IN")} converted · Add Lead →` : "Set up in Settings by an admin · Add Lead →"}
          </div>
        </Link>
      )}

      <div className="hp-stat-grid">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Link href={`/team/home?tab=leads&status=${s.key}`} className="hp-stat-card" key={s.label}>
              <div className="hp-stat-icon"><Icon size={16} /></div>
              <div className="hp-stat-val">{s.val}</div>
              <div className="hp-stat-label">{s.label}</div>
            </Link>
          );
        })}
      </div>

      {!isPresales && !myCity && (
        <div className="hp-card" style={{ background: "var(--hp-warn-dim)", border: "1px solid var(--hp-warn)" }}>
          <div className="hp-summary-label" style={{ color: "var(--hp-warn)" }}>Your profile has no city set — ask an admin to set it so open demos in your city show up here.</div>
        </div>
      )}

      <div className="hp-section-head" style={{ marginTop: 0 }}>
        <div className="hp-section-title">{isPresales ? "Recent Leads" : "Recent Demos"}</div>
        <Link className="hp-view-all" href="/team/home?tab=leads">View All</Link>
      </div>

      {loading ? (
        <div className="hp-empty"><div className="hp-empty-sub">Loading…</div></div>
      ) : recent.length === 0 ? (
        <div className="hp-empty">
          <div className="hp-empty-icon"><IconLeads size={24} /></div>
          <div className="hp-empty-title">{isPresales ? "No leads yet" : "No demos yet"}</div>
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
        <Link href="/team/home?tab=leads" className="hp-btn hp-btn-primary hp-btn-block">
          {isPresales ? "View My Leads" : available.length > 0 ? `View ${available.length} Available Demo${available.length === 1 ? "" : "s"}` : "View My Demos"}
        </Link>
      </div>
    </>
  );
}
