"use client";
// Team app -> Accounts (role "accounts"; admins can open it too): the phone version of the Accounts
// desktop panel (components/employee/AccountsPanel.jsx).
//   Orders  — every order with payment status and details; the only action is "Mark paid".
//   Payouts — the partner / installer payout ledger: see what is pending and settle it
//             (status, method, UTR/reference). Recording a brand-new payout stays on the desktop.
// Same endpoints as the desktop: /api/admin/orders[/id], /api/admin/payouts[/id].
import { useMemo, useState } from "react";
import { ScreenHeader } from "@/components/partner/ui";
import { useEmployeeSession } from "@/components/team/ui";
import { IconSearch } from "@/components/admin/icons";
import { useApiResource, invalidate } from "@/lib/useApiResource";

const ORDERS_URL = "/api/admin/orders";
const PAYOUTS_URL = "/api/admin/payouts";
const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const day = (iso) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const STATUS_LABEL = { placed: "Placed", confirmed: "Confirmed", packed: "Packed", shipped: "Dispatched", delivered: "Delivered", installed: "Installation Done", cancelled: "Cancelled" };
const inputStyle = { width: "100%", background: "var(--hp-surface)", color: "#fff", border: "1.5px solid var(--hp-border)", borderRadius: "var(--hp-r)", padding: "10px 12px", fontSize: 14 };
const btn = { border: "none", borderRadius: "var(--hp-r)", padding: "11px 14px", fontWeight: 700, fontSize: 14, background: "var(--hp-orange)", color: "#fff", cursor: "pointer" };

function Search({ value, onChange, placeholder }) {
  return (
    <div className="hp-input-wrap" style={{ margin: "0 0 10px" }}>
      <span className="hp-input-icon"><IconSearch size={17} /></span>
      <input className="hp-input" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function OrdersView() {
  const { data: orders, loading, refresh } = useApiResource(ORDERS_URL, { pollMs: 20000 });
  const [tab, setTab] = useState("unpaid");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState("");
  const flash = (m) => { setToast(m); setTimeout(() => setToast(""), 3500); };
  const group = (o) => (o.status === "cancelled" ? "cancelled" : o.paymentStatus === "paid" ? "paid" : "unpaid");

  const counts = useMemo(() => {
    const c = { unpaid: 0, paid: 0, cancelled: 0, all: orders.length };
    for (const o of orders) c[group(o)] += 1;
    return c;
  }, [orders]);
  const toCollect = useMemo(() => orders.filter((o) => group(o) === "unpaid").reduce((s, o) => s + (Number(o.subtotal) || 0), 0), [orders]);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return orders.filter((o) => (tab === "all" || group(o) === tab) && (!s || `${o.id} ${o.customerName || ""} ${o.phone || ""}`.toLowerCase().includes(s)));
  }, [orders, tab, q]);

  async function markPaid(o) {
    if (!window.confirm(`Mark ${o.id} (${money(o.subtotal)}) as paid? This records that the payment was received.`)) return;
    setBusy(o.id);
    try {
      const res = await fetch(`${ORDERS_URL}/${o.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ markPaid: true }) });
      const d = await res.json().catch(() => ({}));
      await invalidate(ORDERS_URL); refresh();
      flash(res.ok ? `${o.id} marked as paid` : d.error || "Could not save — try again");
    } catch { flash("Network problem — try again"); } finally { setBusy(""); }
  }

  return (
    <>
      <div className="hp-card" style={{ marginBottom: 10 }}>
        <div className="hp-summary-label">Amount to collect</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>{money(toCollect)}</div>
        <div className="hp-lead-meta">{counts.unpaid} unpaid order{counts.unpaid === 1 ? "" : "s"}</div>
      </div>
      <Search value={q} onChange={setQ} placeholder="Search order ID, name or phone…" />
      <div className="hp-tabs" style={{ paddingBottom: 10 }}>
        {[["unpaid", "Unpaid"], ["paid", "Paid"], ["cancelled", "Cancelled"], ["all", "All"]].map(([k, l]) => (
          <button key={k} type="button" className={`hp-tab${tab === k ? " active" : ""}`} onClick={() => setTab(k)}>{l} ({counts[k]})</button>
        ))}
      </div>
      {loading ? <div className="hp-empty"><div className="hp-empty-sub">Loading…</div></div> : rows.length === 0 ? (
        <div className="hp-empty"><div className="hp-empty-title">No orders here</div></div>
      ) : (
        <div className="hp-lead-list">
          {rows.map((o) => {
            const paid = o.paymentStatus === "paid";
            const expanded = open === o.id;
            return (
              <div key={o.id} className="hp-card" style={{ display: "block" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, cursor: "pointer" }} onClick={() => setOpen(expanded ? null : o.id)}>
                  <div>
                    <div className="hp-lead-name">{o.customerName || o.phone}</div>
                    <div className="hp-lead-meta">{o.id} · {day(o.createdAt)}</div>
                    <div className="hp-lead-meta">{STATUS_LABEL[o.status] || o.status}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 800, color: "#fff" }}>{money(o.subtotal)}</div>
                    <span className="hp-badge" style={{ color: paid ? "var(--hp-success)" : "var(--hp-warn)", background: paid ? "var(--hp-success-dim)" : "var(--hp-warn-dim)" }}><span className="hp-badge-dot" />{paid ? "Paid" : "Pending"}</span>
                  </div>
                </div>
                {expanded && (
                  <div style={{ marginTop: 10, fontSize: 13, color: "var(--hp-text-soft)", lineHeight: 1.6 }}>
                    <div>{o.phone}{o.city ? ` · ${o.city}` : ""}</div>
                    {o.deliveryAddress && <div>{o.deliveryAddress}</div>}
                    <div style={{ marginTop: 6 }}>{(o.items || []).map((it, i) => <div key={i}>{it.qty} × {it.name} — {money(it.lineTotal ?? it.price * it.qty)}</div>)}</div>
                    {paid && o.paidAt && <div style={{ marginTop: 6 }}>Paid on {day(o.paidAt)}</div>}
                    <a href={`/api/admin/orders/${o.id}/pdf?type=invoice`} style={{ display: "inline-block", marginTop: 8, color: "var(--hp-orange)", fontWeight: 700 }}>Download invoice</a>
                  </div>
                )}
                {!paid && o.status !== "cancelled" && (
                  <button type="button" style={{ ...btn, width: "100%", marginTop: 10 }} disabled={busy === o.id} onClick={() => markPaid(o)}>{busy === o.id ? "Saving…" : "Mark paid"}</button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {toast && <div className="hp-toast">{toast}</div>}
    </>
  );
}

function PayoutsView() {
  const { data: payouts, loading, refresh } = useApiResource(PAYOUTS_URL, { pollMs: 20000 });
  const { data: partners } = useApiResource("/api/admin/partners", { pollMs: 60000 });
  const pmap = useMemo(() => Object.fromEntries(partners.map((p) => [p.id, p])), [partners]);
  const [tab, setTab] = useState("pending");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);
  const [form, setForm] = useState({ status: "pending", method: "", reference: "" });
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState("");
  const flash = (m) => { setToast(m); setTimeout(() => setToast(""), 3500); };
  const nameOf = (p) => { const x = pmap[p.partnerId]; return x?.businessName || x?.name || "Unknown partner"; };

  const counts = useMemo(() => {
    const c = { pending: 0, processing: 0, paid: 0, all: payouts.length };
    for (const p of payouts) c[p.status] = (c[p.status] || 0) + 1;
    return c;
  }, [payouts]);
  const pendingAmt = useMemo(() => payouts.filter((p) => p.status !== "paid").reduce((s, p) => s + (Number(p.amount) || 0), 0), [payouts]);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return payouts
      .filter((p) => (tab === "all" || p.status === tab) && (!s || `${nameOf(p)} ${p.reference || ""} ${p.periodLabel || ""}`.toLowerCase().includes(s)))
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }, [payouts, tab, q, pmap]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggle(p) {
    if (open === p.id) { setOpen(null); return; }
    setOpen(p.id);
    setForm({ status: p.status, method: p.method || "", reference: p.reference || "" });
  }
  async function save(p) {
    setBusy(p.id);
    try {
      const res = await fetch(`${PAYOUTS_URL}/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const d = await res.json().catch(() => ({}));
      await invalidate(PAYOUTS_URL); refresh();
      if (res.ok) { setOpen(null); flash("Payout updated"); } else flash(d.error || "Could not save — try again");
    } catch { flash("Network problem — try again"); } finally { setBusy(""); }
  }

  return (
    <>
      <div className="hp-card" style={{ marginBottom: 10 }}>
        <div className="hp-summary-label">Pending settlement</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>{money(pendingAmt)}</div>
        <div className="hp-lead-meta">{counts.pending + counts.processing} payout{counts.pending + counts.processing === 1 ? "" : "s"} to settle</div>
      </div>
      <Search value={q} onChange={setQ} placeholder="Search partner or reference…" />
      <div className="hp-tabs" style={{ paddingBottom: 10 }}>
        {[["pending", "Pending"], ["processing", "Processing"], ["paid", "Paid"], ["all", "All"]].map(([k, l]) => (
          <button key={k} type="button" className={`hp-tab${tab === k ? " active" : ""}`} onClick={() => setTab(k)}>{l} ({counts[k] || 0})</button>
        ))}
      </div>
      {loading ? <div className="hp-empty"><div className="hp-empty-sub">Loading…</div></div> : rows.length === 0 ? (
        <div className="hp-empty"><div className="hp-empty-title">No payouts here</div></div>
      ) : (
        <div className="hp-lead-list">
          {rows.map((p) => {
            const paid = p.status === "paid";
            return (
              <div key={p.id} className="hp-card" style={{ display: "block" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, cursor: "pointer" }} onClick={() => toggle(p)}>
                  <div>
                    <div className="hp-lead-name">{nameOf(p)}</div>
                    <div className="hp-lead-meta">{p.periodLabel || "—"} · {day(p.createdAt)}</div>
                    {p.reference && <div className="hp-lead-meta">Ref: {p.reference}</div>}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 800, color: "#fff" }}>{money(p.amount)}</div>
                    <span className="hp-badge" style={{ color: paid ? "var(--hp-success)" : "var(--hp-warn)", background: paid ? "var(--hp-success-dim)" : "var(--hp-warn-dim)" }}><span className="hp-badge-dot" />{p.status[0].toUpperCase() + p.status.slice(1)}</span>
                  </div>
                </div>
                {open === p.id && (
                  <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                    {paid ? (
                      <div className="hp-lead-meta">Paid {day(p.paidAt)}{p.method ? ` via ${p.method}` : ""}{p.reference ? ` · ${p.reference}` : ""}</div>
                    ) : (
                      <>
                        <select style={inputStyle} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                          <option value="pending">Pending</option><option value="processing">Processing</option><option value="paid">Paid</option>
                        </select>
                        <input style={inputStyle} placeholder="Method (Bank transfer, UPI, Cash)" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} />
                        <input style={inputStyle} placeholder="Reference / UTR number" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
                        <button type="button" style={btn} disabled={busy === p.id} onClick={() => save(p)}>{busy === p.id ? "Saving…" : form.status === "paid" ? "Save & mark paid" : "Save"}</button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {toast && <div className="hp-toast">{toast}</div>}
    </>
  );
}

export default function AccountsScreen() {
  const employee = useEmployeeSession();
  const [mode, setMode] = useState("orders");
  if (employee && !["accounts", "admin"].includes(employee.role)) {
    return (
      <>
        <ScreenHeader title="Accounts" backHref="/team/home" />
        <div className="hp-empty"><div className="hp-empty-title">Not available</div><div className="hp-empty-sub">This screen is for the Accounts team.</div></div>
      </>
    );
  }
  return (
    <>
      <ScreenHeader title="Accounts" backHref="/team/home" />
      <div className="hp-tabs" style={{ paddingBottom: 10 }}>
        <button type="button" className={`hp-tab${mode === "orders" ? " active" : ""}`} onClick={() => setMode("orders")}>Orders</button>
        <button type="button" className={`hp-tab${mode === "payouts" ? " active" : ""}`} onClick={() => setMode("payouts")}>Payouts</button>
      </div>
      {mode === "orders" ? <OrdersView /> : <PayoutsView />}
    </>
  );
}
