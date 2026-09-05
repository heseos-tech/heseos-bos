'use client';
// Shared quotation builder modal — used by Admin (components/admin/QuotationsPage.jsx), the
// Sales Engineer panel (components/employee/SalesEngineerPanel.jsx) and the Team App mobile
// lead screen (components/team/LeadDetailScreen.jsx), per the access scope decided for this
// feature (Admin + Sales Engineers can build/send quotations).
//
// Deliberately styled with its own qb-* classes (app/globals.css) rather than any surface's own
// theme (Admin's admin.css vs. globals.css's MARG-ported tokens for Employee/Team) — this
// component is mounted from three different route trees that don't all load the same
// stylesheet, so it can't depend on any of their theme-specific classes/variables and still
// look right (or look at all) everywhere. It also collapses into a bottom sheet on narrow
// screens (see the max-width: 560px rule in globals.css), so the same component works as a
// desktop modal on Admin and a mobile sheet on the Team App without a separate variant.
//
// Pick products from the catalogue (app/api/products) into a cart with qty/discount per line,
// or skip the catalogue entirely and just type a one-off amount — either way the SERVER (the
// 'quotation' PATCH type in app/api/leads/[id]/route.js) computes the authoritative
// subtotal/discount/total, never trusting a client-sent number. What's shown here while
// building is a live preview of that same math, so the number never surprises anyone at submit.
import { useMemo, useState } from 'react';
import Portal from './Portal';
import { useApiResource } from '@/lib/useApiResource';
import { IconSearch, IconX, IconProducts, IconDownload, IconWhatsApp } from '@/components/admin/icons';

export function currency(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

// Mirrors the server-side computation in app/api/leads/[id]/route.js exactly, so the preview
// shown while building never disagrees with what actually gets saved.
export function computeQuoteTotals(lines, extraDiscount) {
  const subtotal = lines.reduce((s, l) => s + (Number(l.price) || 0) * (Number(l.qty) || 0), 0);
  const lineDiscounts = lines.reduce((s, l) => s + Math.max(0, Number(l.discount) || 0), 0);
  const extra = Math.max(0, Number(extraDiscount) || 0);
  const discountTotal = lineDiscounts + extra;
  const total = Math.max(0, subtotal - discountTotal);
  return { subtotal, discountTotal, total };
}

function latestRevision(lead) {
  const revs = Array.isArray(lead.quotationRevisions) ? lead.quotationRevisions : [];
  return revs.length ? revs[revs.length - 1] : null;
}

export default function QuotationBuilderModal({ lead, onClose, onDone }) {
  const { data: products, loading: productsLoading } = useApiResource('/api/products');
  const [pq, setPq] = useState('');
  const last = useMemo(() => latestRevision(lead), [lead]);
  const [lines, setLines] = useState(() => (last?.items?.length
    ? last.items.map((it, i) => ({ ...it, _key: `${it.productId || it.sku || 'line'}_${i}` }))
    : []));
  const [manualAmount, setManualAmount] = useState(() => (last && !last.items?.length ? (last.amount ?? '') : ''));
  const [extraDiscount, setExtraDiscount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState('');
  const revisions = Array.isArray(lead.quotationRevisions) ? lead.quotationRevisions : [];

  const activeProducts = useMemo(() => products.filter((p) => p.active !== false), [products]);
  const filteredProducts = useMemo(() => {
    if (!pq.trim()) return activeProducts;
    const s = pq.trim().toLowerCase();
    return activeProducts.filter((p) => `${p.name} ${p.sku}`.toLowerCase().includes(s));
  }, [activeProducts, pq]);

  const totals = useMemo(() => computeQuoteTotals(lines, extraDiscount), [lines, extraDiscount]);

  function addProduct(p) {
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === p.id);
      if (existing) return prev.map((l) => (l.productId === p.id ? { ...l, qty: (Number(l.qty) || 0) + 1 } : l));
      return [...prev, { _key: `${p.id}_${Date.now()}`, productId: p.id, sku: p.sku, name: p.name, price: p.price ?? 0, qty: 1, discount: 0 }];
    });
  }
  function updateLine(key, field, value) {
    setLines((prev) => prev.map((l) => (l._key === key ? { ...l, [field]: value } : l)));
  }
  function removeLine(key) {
    setLines((prev) => prev.filter((l) => l._key !== key));
  }

  async function submit() {
    setError('');
    setSaving(true);
    try {
      let body;
      if (lines.length > 0) {
        body = {
          type: 'quotation',
          items: lines.map((l) => ({ productId: l.productId || null, sku: l.sku || '', name: l.name || '', price: Number(l.price) || 0, qty: Number(l.qty) || 0, discount: Math.max(0, Number(l.discount) || 0) })),
          extraDiscount: extraDiscount === '' ? 0 : Math.max(0, Number(extraDiscount) || 0),
          note,
        };
      } else {
        body = { type: 'quotation', amount: manualAmount !== '' ? Number(manualAmount) : null, note };
      }
      const res = await fetch(`/api/leads/${lead.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to save quotation');
      onDone(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function sendOnWhatsApp() {
    setSendMsg('');
    setSending(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/quotation-pdf/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not send the quotation on WhatsApp');
      setSendMsg('Sent on WhatsApp ✓');
    } catch (e) {
      setSendMsg(e.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <Portal>
      <div className="qb-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="qb-modal-card">
          <div className="qb-modal-head">
            <div>
              <div className="qb-modal-title">{revisions.length ? `Revise quotation (v${revisions.length + 1})` : 'Build quotation'}</div>
              <div className="qb-modal-sub">{lead.name} · {lead.phone}</div>
            </div>
            <button className="qb-modal-close" onClick={onClose}><IconX size={18} /></button>
          </div>

          {revisions.length > 0 && (
            <div className="qb-share-row">
              <a className="qb-btn-outline" href={`/api/leads/${lead.id}/quotation-pdf`}><IconDownload size={14} /> Download last PDF</a>
              <button type="button" className="qb-btn-outline" onClick={sendOnWhatsApp} disabled={sending}><IconWhatsApp size={14} /> {sending ? 'Sending…' : 'Send on WhatsApp'}</button>
              {sendMsg && <span className="qb-share-msg">{sendMsg}</span>}
            </div>
          )}

          <div className="qb-layout">
            <div>
              <div className="qb-search"><IconSearch size={16} /><input placeholder="Search products by name or SKU…" value={pq} onChange={(e) => setPq(e.target.value)} /></div>
              <div className="qb-product-list">
                {productsLoading ? (
                  <div className="qb-empty">Loading catalogue…</div>
                ) : filteredProducts.length === 0 ? (
                  <div className="qb-empty">{activeProducts.length === 0 ? 'No products in the catalogue yet — add some in Admin → Products.' : 'No products match.'}</div>
                ) : filteredProducts.map((p) => (
                  <div className="qb-product-row" key={p.id}>
                    {p.photos?.[0]?.dataUrl
                      ? <img className="qb-product-thumb" src={p.photos[0].dataUrl} alt={p.name} />
                      : <div className="qb-product-thumb-placeholder"><IconProducts size={18} /></div>}
                    <div className="qb-product-info">
                      <div className="qb-product-name">{p.name}</div>
                      <div className="qb-product-meta">{p.sku} · {p.price != null ? currency(p.price) : 'Price on request'}</div>
                    </div>
                    <button type="button" className="qb-add-btn" onClick={() => addProduct(p)}>+</button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              {lines.length === 0 ? (
                <>
                  <div className="qb-empty-lines">No line items added — pick products on the left, or enter a one-off amount below.</div>
                  <div className="lf-field"><label className="lf-label">Amount (₹)</label><input className="lf-input" type="number" min="0" value={manualAmount} onChange={(e) => setManualAmount(e.target.value)} placeholder="e.g. 185000" /></div>
                </>
              ) : (
                <>
                  <div className="qb-line qb-line-head">
                    <span>Item</span><span>Qty</span><span>Price</span><span>Disc.</span><span></span>
                  </div>
                  {lines.map((l) => (
                    <div className="qb-line" key={l._key}>
                      <div>
                        <div className="qb-line-name">{l.name}</div>
                        {l.sku && <div className="qb-line-sku">{l.sku}</div>}
                        <div className="qb-line-total">= {currency(Math.max(0, (Number(l.price) || 0) * (Number(l.qty) || 0) - (Number(l.discount) || 0)))}</div>
                      </div>
                      <input className="qb-line-qty" type="number" min="0" value={l.qty} onChange={(e) => updateLine(l._key, 'qty', e.target.value)} />
                      <input className="qb-line-price" type="number" min="0" value={l.price} onChange={(e) => updateLine(l._key, 'price', e.target.value)} />
                      <input className="qb-line-discount" type="number" min="0" value={l.discount} onChange={(e) => updateLine(l._key, 'discount', e.target.value)} />
                      <button type="button" className="qb-line-remove" onClick={() => removeLine(l._key)}><IconX size={14} /></button>
                    </div>
                  ))}
                  <div className="lf-field" style={{ marginTop: 12 }}>
                    <label className="lf-label">Extra discount (₹, optional)</label>
                    <input className="lf-input" type="number" min="0" value={extraDiscount} onChange={(e) => setExtraDiscount(e.target.value)} placeholder="Flat amount off the whole quotation" />
                  </div>
                </>
              )}

              <div className="lf-field"><label className="lf-label">Note (optional)</label><input className="lf-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Valid for 15 days" /></div>

              {lines.length > 0 && (
                <div className="qb-totals">
                  <div className="qb-totals-row"><span>Subtotal</span><span>{currency(totals.subtotal)}</span></div>
                  <div className="qb-totals-row"><span>Discount</span><span>-{currency(totals.discountTotal)}</span></div>
                  <div className="qb-totals-row qb-total-final"><span>Total</span><span>{currency(totals.total)}</span></div>
                </div>
              )}

              {error && <div className="lf-error">{error}</div>}
              <div className="qb-actions">
                <button className="qb-btn-outline" onClick={onClose} disabled={saving}>Cancel</button>
                <button className="qb-btn-primary" onClick={submit} disabled={saving || (lines.length === 0 && manualAmount === '')}>
                  {saving ? 'Saving…' : revisions.length ? 'Save Revision' : 'Send Quotation'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
