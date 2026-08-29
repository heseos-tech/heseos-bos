"use client";
// Team-app Lead Detail — the one screen that carries every action: pre-sales logs contact
// outcomes and schedules demos; sales engineers claim open demos, send/revise quotations, and
// log the final outcome. All actions PATCH the exact same /api/leads/[id] endpoint the desktop
// PresalesPanel/SalesEngineerPanel already use (type: contact | scheduleDemo | quotation |
// demoOutcome | claim) — this screen is a new face on the same business logic, not a fork of it.
import { useEffect, useState, useCallback } from "react";
import { Avatar, ScreenHeader, Button } from "@/components/partner/ui";
import { IconPhone, IconMapPin, IconBuilding, IconWallet, IconCalendar, IconSource, IconNote } from "@/components/partner/icons";
import { fmtDate, fmtDateTime } from "@/lib/date";
import { stageOf, displayStatus, subUpdateOf, needsReschedule, CONTACT_STAGES, DEMO_OUTCOMES } from "@/lib/leadStage";
import { PRODUCT_INTEREST, PROPERTY_TYPE, TIMELINE, LEAD_SOURCES, budgetOptionsFor } from "@/lib/formOptions";

const PI_LABEL = Object.fromEntries(PRODUCT_INTEREST.map((p) => [p.v, p.l]));
const PT_LABEL = Object.fromEntries(PROPERTY_TYPE.map((p) => [p.v, p.l]));
const TL_LABEL = Object.fromEntries(TIMELINE.map((t) => [t.v, t.l]));
function budgetLabel(propertyType, budget) {
  return budgetOptionsFor(propertyType).find((b) => b.v === budget)?.l || budget || "—";
}
function norm(s) { return String(s || "").trim().toLowerCase(); }

export default function TeamLeadDetailScreen({ employee, lead: initialLead }) {
  const [lead, setLead] = useState(initialLead);
  const [sheet, setSheet] = useState(null); // 'contact' | 'schedule' | 'quotation' | 'outcome'
  const [claiming, setClaiming] = useState(false);
  const [notice, setNotice] = useState("");

  const isPresales = employee.role === "presales";
  const isSE = employee.role === "sales_engineer";

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/leads/${initialLead.id}`);
      if (res.ok) setLead(await res.json());
    } catch { /* keep showing the last known state */ }
  }, [initialLead.id]);

  useEffect(() => {
    const t = setInterval(refresh, 15000);
    return () => clearInterval(t);
  }, [refresh]);

  function flash(msg) { setNotice(msg); setTimeout(() => setNotice(""), 4000); }

  const status = displayStatus(lead);
  const sub = subUpdateOf(lead);
  const isAvailableToMe = isSE && lead.demoScheduledAt && !lead.salesEngineerId && norm(lead.city) === norm(employee.location);
  const isMineSE = isSE && lead.salesEngineerId === employee.id;
  const canPresalesAct = isPresales && lead.assignedTo === employee.id && stageOf(lead) === "New Lead";
  const canEngineerAct = isMineSE && stageOf(lead) === "Demo Scheduled";

  async function acceptLead() {
    setClaiming(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "claim" }) });
      const data = await res.json();
      if (!res.ok) {
        flash(res.status === 409 ? "Too slow — someone else just claimed this lead." : (data.error || "Could not claim this lead."));
        refresh();
        return;
      }
      setLead(data);
      flash("This lead is now yours.");
    } finally {
      setClaiming(false);
    }
  }

  const history = Array.isArray(lead.history) && lead.history.length ? lead.history : [{ at: lead.createdAt, event: "Lead Created", by: "System", note: "" }];
  const revisions = Array.isArray(lead.quotationRevisions) ? lead.quotationRevisions : [];

  const summary = [
    { icon: <IconBuilding size={16} />, label: "Property Type", val: PT_LABEL[lead.propertyType] || "—" },
    { icon: <IconWallet size={16} />, label: "Budget Range", val: budgetLabel(lead.propertyType, lead.budget) },
    { icon: <IconCalendar size={16} />, label: "Timeline", val: TL_LABEL[lead.timeline] || "—" },
    { icon: <IconSource size={16} />, label: "Source", val: LEAD_SOURCES[lead.source] || lead.source || "—" },
  ];

  return (
    <>
      <ScreenHeader title="Lead Details" backHref="/team/leads" />

      <div className="hp-detail-hero">
        <Avatar name={lead.name} size="lg" />
        <div style={{ flex: 1 }}>
          <div className="hp-detail-name">{lead.name}</div>
          <div className="hp-detail-id">Lead ID: {lead.id}</div>
          <div style={{ marginTop: 6 }}>
            {isAvailableToMe ? (
              <span className="hp-badge" style={{ color: "#38bdf8", background: "var(--hp-info-dim)" }}><span className="hp-badge-dot" />Open — unclaimed</span>
            ) : (
              <span className="hp-badge" style={{ color: status.c, background: status.bg }}><span className="hp-badge-dot" />{status.label}</span>
            )}
          </div>
          {sub && <div className="hp-lead-meta" style={{ color: "var(--hp-warn)", marginTop: 4 }}>{sub.label}</div>}
        </div>
      </div>

      <div className="hp-detail-line"><IconPhone size={16} /> {lead.phone}</div>
      <div className="hp-detail-line"><IconMapPin size={16} /> {lead.city}</div>

      {(lead.productInterest || []).length > 0 && (
        <div className="hp-detail-line">{(lead.productInterest || []).map((p) => PI_LABEL[p] || p).join(", ")}</div>
      )}

      <div className="hp-card" style={{ marginTop: 18 }}>
        <div className="hp-card-title">Requirement Summary</div>
        {summary.map((s) => (
          <div key={s.label} className="hp-summary-row">
            <span className="hp-summary-label" style={{ display: "flex", alignItems: "center", gap: 8 }}>{s.icon} {s.label}</span>
            <span className="hp-summary-val">{s.val}</span>
          </div>
        ))}
      </div>

      {lead.demoScheduledAt && (
        <div className="hp-card">
          <div className="hp-card-title">Demo Visit</div>
          <div className="hp-summary-row"><span className="hp-summary-label">Date &amp; Time</span><span className="hp-summary-val">{fmtDate(lead.demoDate)} · {lead.demoTime}</span></div>
          <div className="hp-summary-row"><span className="hp-summary-label">Address</span><span className="hp-summary-val">{lead.demoAddress}</span></div>
        </div>
      )}

      {revisions.length > 0 && (
        <div className="hp-card">
          <div className="hp-card-title">Quotation</div>
          <div className="hp-summary-row"><span className="hp-summary-label">Current Amount</span><span className="hp-summary-val">{lead.quotationAmount != null ? `₹${lead.quotationAmount}` : "—"}</span></div>
          <div className="hp-timeline" style={{ marginTop: 10 }}>
            {revisions.slice().reverse().map((r) => (
              <div key={r.revision} className="hp-timeline-item">
                <div className="hp-timeline-rail"><span className="hp-timeline-dot" /><span className="hp-timeline-line" /></div>
                <div>
                  <div className="hp-timeline-event">v{r.revision} · {r.amount != null ? `₹${r.amount}` : "no amount"}</div>
                  <div className="hp-timeline-meta">{fmtDateTime(r.at)} {r.by ? `· ${r.by}` : ""}</div>
                  {r.note && <div className="hp-timeline-note">{r.note}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {lead.finalPrice != null && (
        <div className="hp-card" style={{ background: "var(--hp-success-dim)", border: "1px solid var(--hp-success)" }}>
          <div className="hp-summary-row" style={{ borderBottom: "none" }}>
            <span className="hp-summary-label" style={{ color: "var(--hp-success)", fontWeight: 700 }}>Final Price</span>
            <span className="hp-summary-val" style={{ color: "var(--hp-success)", fontSize: 16 }}>₹{lead.finalPrice}</span>
          </div>
        </div>
      )}

      {lead.notes && (
        <div className="hp-card">
          <div className="hp-card-title" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}><IconNote size={16} /> Notes</div>
          <div className="hp-summary-label" style={{ lineHeight: 1.6 }}>{lead.notes}</div>
        </div>
      )}

      <div className="hp-card">
        <div className="hp-card-title">Activity Timeline</div>
        <div className="hp-timeline">
          {history.slice().reverse().map((h, i) => (
            <div key={i} className="hp-timeline-item">
              <div className="hp-timeline-rail"><span className={`hp-timeline-dot${i === 0 ? " done" : ""}`} /><span className="hp-timeline-line" /></div>
              <div>
                <div className="hp-timeline-event">{h.event}</div>
                <div className="hp-timeline-meta">{fmtDateTime(h.at)} {h.by ? `· ${h.by}` : ""}</div>
                {h.note && <div className="hp-timeline-note">{h.note}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="hp-cta-block" style={{ paddingBottom: 24, display: "flex", flexDirection: "column", gap: 10 }}>
        {isAvailableToMe && (
          <Button block onClick={acceptLead} disabled={claiming}>{claiming ? "Claiming…" : "Accept Lead"}</Button>
        )}
        {canPresalesAct && (
          <>
            <Button block variant="outline" onClick={() => setSheet("contact")}>Log Contact Outcome</Button>
            <Button block onClick={() => setSheet("schedule")}>Schedule Demo</Button>
          </>
        )}
        {canEngineerAct && (
          <>
            <Button block variant="outline" onClick={() => setSheet("quotation")}>{lead.quotationSentAt ? "Revise Quotation" : "Send Quotation"}</Button>
            <Button block onClick={() => setSheet("outcome")}>{needsReschedule(lead) ? "Reschedule Demo" : "Mark Demo Outcome"}</Button>
          </>
        )}
      </div>

      {notice && <div className="hp-toast">{notice}</div>}

      {sheet && (
        <TeamActionSheet
          type={sheet}
          lead={lead}
          onClose={() => setSheet(null)}
          onDone={(updated) => { setSheet(null); if (updated) setLead(updated); else refresh(); }}
        />
      )}
    </>
  );
}

function TeamActionSheet({ type, lead, onClose, onDone }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [contactStage, setContactStage] = useState("follow_up");
  const [followUpAt, setFollowUpAt] = useState("");
  const [note, setNote] = useState("");

  const [demoAddress, setDemoAddress] = useState(lead.demoAddress || "");
  const [demoDate, setDemoDate] = useState(lead.demoDate || "");
  const [demoTime, setDemoTime] = useState(lead.demoTime || "");

  const [amount, setAmount] = useState(lead.quotationAmount || "");
  const [quoteNote, setQuoteNote] = useState("");

  const [outcome, setOutcome] = useState(needsReschedule(lead) ? lead.demoOutcome : "");
  const [finalPrice, setFinalPrice] = useState(lead.quotationAmount || "");

  const revisions = Array.isArray(lead.quotationRevisions) ? lead.quotationRevisions : [];

  async function submit() {
    setError("");
    setSubmitting(true);
    try {
      let body;
      if (type === "contact") {
        body = { type: "contact", contactStage, note, followUpAt: followUpAt || null };
      } else if (type === "schedule") {
        if (!demoAddress || !demoDate || !demoTime) { setError("Address, date and time are all required."); setSubmitting(false); return; }
        body = { type: "scheduleDemo", demoAddress, demoDate, demoTime };
      } else if (type === "quotation") {
        body = { type: "quotation", amount: amount ? Number(amount) : null, note: quoteNote };
      } else if (type === "outcome") {
        if (!outcome) { setError("Choose an outcome."); setSubmitting(false); return; }
        if (outcome === "converted" && !finalPrice) { setError("Enter the final price to mark this Converted."); setSubmitting(false); return; }
        body = {
          type: "demoOutcome",
          demoOutcome: outcome,
          note,
          ...(outcome === "converted" ? { finalPrice: Number(finalPrice) } : {}),
          ...(demoDate && demoTime ? { demoDate, demoTime, demoAddress } : {}),
        };
      }
      const res = await fetch(`/api/leads/${lead.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      onDone(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="hp-sheet-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="hp-sheet">
        <div className="hp-sheet-handle" />

        {type === "contact" && (
          <>
            <div className="hp-sheet-title">Log contact outcome</div>
            <div className="hp-sheet-sub">{lead.name} · {lead.phone}</div>
            <div className="hp-pill-grid">
              {CONTACT_STAGES.filter((c) => c.key !== "qualified").map((c) => (
                <button key={c.key} type="button" className={`hp-pill${contactStage === c.key ? " active" : ""}`} onClick={() => setContactStage(c.key)}>{c.label}</button>
              ))}
            </div>
            {contactStage === "follow_up" && (
              <div className="hp-field" style={{ marginTop: 14 }}>
                <label className="hp-field-label">Follow up at</label>
                <div className="hp-input-wrap"><input className="hp-input" type="datetime-local" value={followUpAt} onChange={(e) => setFollowUpAt(e.target.value)} /></div>
              </div>
            )}
            <div className="hp-field" style={{ marginTop: 14 }}>
              <label className="hp-field-label">Note (optional)</label>
              <div className="hp-input-wrap"><input className="hp-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Any context for the next call" /></div>
            </div>
          </>
        )}

        {type === "schedule" && (
          <>
            <div className="hp-sheet-title">Schedule demo</div>
            <div className="hp-sheet-sub">{lead.name} · {lead.phone} · {lead.city}</div>
            <div className="hp-field"><label className="hp-field-label">Demo address</label><div className="hp-input-wrap"><input className="hp-input" value={demoAddress} onChange={(e) => setDemoAddress(e.target.value)} placeholder="Full address for the visit" /></div></div>
            <div className="hp-field"><label className="hp-field-label">Date</label><div className="hp-input-wrap"><input className="hp-input" type="date" value={demoDate} onChange={(e) => setDemoDate(e.target.value)} /></div></div>
            <div className="hp-field"><label className="hp-field-label">Time</label><div className="hp-input-wrap"><input className="hp-input" type="time" value={demoTime} onChange={(e) => setDemoTime(e.target.value)} /></div></div>
          </>
        )}

        {type === "quotation" && (
          <>
            <div className="hp-sheet-title">{revisions.length ? "Revise quotation" : "Send quotation"}</div>
            <div className="hp-sheet-sub">{lead.name} · {lead.phone}</div>
            <div className="hp-field">
              <label className="hp-field-label">{revisions.length ? "New amount (₹)" : "Amount (₹, optional)"}</label>
              <div className="hp-input-wrap"><input className="hp-input" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 185000" /></div>
            </div>
            <div className="hp-field">
              <label className="hp-field-label">Reason for {revisions.length ? "revision" : "this quote"} (optional)</label>
              <div className="hp-input-wrap"><input className="hp-input" value={quoteNote} onChange={(e) => setQuoteNote(e.target.value)} placeholder="e.g. Reduced after negotiation" /></div>
            </div>
          </>
        )}

        {type === "outcome" && (
          <>
            <div className="hp-sheet-title">{needsReschedule(lead) ? "Reschedule demo" : "Mark demo outcome"}</div>
            <div className="hp-sheet-sub">{lead.name} · {fmtDate(lead.demoDate)} {lead.demoTime}</div>
            <div className="hp-pill-grid">
              {DEMO_OUTCOMES.map((d) => (
                <button key={d.key} type="button" className={`hp-pill${outcome === d.key ? " active" : ""}`} onClick={() => setOutcome(d.key)}>{d.label}</button>
              ))}
            </div>
            {(outcome === "out_of_station" || outcome === "future_demo") && (
              <>
                <div className="hp-field" style={{ marginTop: 14 }}><label className="hp-field-label">New date</label><div className="hp-input-wrap"><input className="hp-input" type="date" value={demoDate} onChange={(e) => setDemoDate(e.target.value)} /></div></div>
                <div className="hp-field"><label className="hp-field-label">New time</label><div className="hp-input-wrap"><input className="hp-input" type="time" value={demoTime} onChange={(e) => setDemoTime(e.target.value)} /></div></div>
                <div className="hp-field"><label className="hp-field-label">Address (if changed)</label><div className="hp-input-wrap"><input className="hp-input" value={demoAddress} onChange={(e) => setDemoAddress(e.target.value)} /></div></div>
              </>
            )}
            {outcome === "converted" && (
              <div className="hp-field" style={{ marginTop: 14 }}>
                <label className="hp-field-label">Final price (₹) — after negotiation</label>
                <div className="hp-input-wrap"><input className="hp-input" type="number" value={finalPrice} onChange={(e) => setFinalPrice(e.target.value)} placeholder="The price the deal actually closed at" /></div>
                {lead.quotationAmount != null && <div className="hp-hint">Last quoted: ₹{lead.quotationAmount}</div>}
              </div>
            )}
            <div className="hp-field" style={{ marginTop: 14 }}>
              <label className="hp-field-label">Note (optional)</label>
              <div className="hp-input-wrap"><input className="hp-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Any context" /></div>
            </div>
          </>
        )}

        {error && <div className="hp-error">{error}</div>}

        <div className="hp-sheet-actions">
          <Button block variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button block onClick={submit} disabled={submitting}>{submitting ? "Saving…" : "Save"}</Button>
        </div>
      </div>
    </div>
  );
}

