"use client";
// Team app → Cards Not Opened (pre-sales only): customers who were sent the WhatsApp landing-page card
// and never opened it, with the call outcome (Dead / Call Again / Follow up / Out of Location / Success)
// and who is calling. Same data + API as the desktop panel (components/employee/CardFollowups.jsx).
import { useMemo, useState } from "react";
import Link from "next/link";
import { IconLeads } from "@/components/partner/icons";
import { useCardFollowups, cardWhen, cardWaLink } from "@/components/employee/CardFollowups";
import { CARD_STATUSES, cardStatusOf, cardFollowupKey } from "@/lib/cardFollowupStatus";

const PAGE_LABEL = { door_lock: "Door Lock", smart_home: "Smart Home" };
const selectStyle = { width: "100%", background: "var(--hp-surface)", color: "#fff", border: "1.5px solid var(--hp-border)", borderRadius: "var(--hp-r)", padding: "10px 12px", fontSize: 14 };

export default function CardFollowupsScreen({ employee }) {
  const { rows, loading, followups, callers, me, saving, error, save, statusOf } = useCardFollowups();
  const [filter, setFilter] = useState("pending");

  const counts = useMemo(() => {
    const c = { all: rows.length, pending: 0 };
    for (const s of CARD_STATUSES) c[s.key] = 0;
    for (const r of rows) { const st = statusOf(r.phone); if (st) c[st] += 1; else c.pending += 1; }
    return c;
  }, [rows, followups]); // eslint-disable-line react-hooks/exhaustive-deps
  const tabs = [{ key: "pending", label: "To call" }, ...CARD_STATUSES.map((s) => ({ key: s.key, label: s.label })), { key: "all", label: "All" }];
  const list = rows.filter((r) => { const st = statusOf(r.phone); return filter === "pending" ? !st : filter === "all" || st === filter; });

  if (employee?.role !== "presales" && employee?.role !== "admin") return null;

  return (
    <>
      <div className="hp-header" style={{ paddingBottom: 4 }}>
        <div className="hp-header-title" style={{ fontSize: 21, fontWeight: 800 }}>Cards Not Opened</div>
        <Link href="/team/home" className="hp-view-all">Back</Link>
      </div>
      <div className="hp-tabs">
        {tabs.map((t) => (
          <button key={t.key} className={`hp-tab${filter === t.key ? " active" : ""}`} onClick={() => setFilter(t.key)}>{t.label} ({counts[t.key] || 0})</button>
        ))}
      </div>
      {error && <div className="hp-error">{error}</div>}
      {loading ? (
        <div className="hp-empty"><div className="hp-empty-sub">Loading…</div></div>
      ) : list.length === 0 ? (
        <div className="hp-empty">
          <div className="hp-empty-icon"><IconLeads size={24} /></div>
          <div className="hp-empty-title">Nothing here</div>
          <div className="hp-empty-sub">{filter === "pending" ? "Everyone has been called or opened the card." : "Try a different tab."}</div>
        </div>
      ) : (
        <div className="hp-lead-list">
          {list.map((r) => {
            const key = cardFollowupKey(r.phone);
            const rec = followups[key];
            const callerId = rec?.callerId || me?.id || "";
            const st = cardStatusOf(rec?.status);
            const busy = saving === key;
            return (
              <div key={`${r.phone}${r.page}`} className="hp-card" style={{ display: "block" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div>
                    <div className="hp-lead-name">{r.phone}</div>
                    <div className="hp-lead-meta">{PAGE_LABEL[r.page] || r.page} · sent {cardWhen(r.sentAt)}</div>
                  </div>
                  {st && <span className="hp-badge" style={{ color: st.color, background: st.bg }}><span className="hp-badge-dot" />{st.label}</span>}
                </div>
                <div style={{ display: "flex", gap: 8, margin: "10px 0" }}>
                  <a className="hp-badge" href={`tel:${r.phone}`} style={{ color: "#38bdf8", background: "var(--hp-info-dim)", padding: "8px 14px" }}>Call</a>
                  <a className="hp-badge" href={cardWaLink(r.phone)} target="_blank" rel="noreferrer" style={{ color: "#22c55e", background: "rgba(34,197,94,.14)", padding: "8px 14px" }}>WhatsApp</a>
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  <select style={selectStyle} value={rec?.status || ""} disabled={busy} onChange={(e) => save(r.phone, e.target.value, callerId)}>
                    <option value="">Select status…</option>
                    {CARD_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                  <select style={selectStyle} value={callerId} disabled={busy || callers.length === 0} onChange={(e) => save(r.phone, rec?.status || "", e.target.value)}>
                    {callers.length === 0 && <option value="">Who is calling</option>}
                    {callers.map((c) => <option key={c.id} value={c.id}>Caller: {c.name}</option>)}
                  </select>
                </div>
                {rec?.updatedAt && <div className="hp-lead-meta" style={{ marginTop: 6 }}>Updated {cardWhen(rec.updatedAt)} by {rec.updatedByName}</div>}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
