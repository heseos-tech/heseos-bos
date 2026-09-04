'use client';
// Partner-facing product catalogue — read-only browse of Heseos's product catalogue
// (app/api/products, the same data Admin's Products tab manages and the quotation builder
// picks from), so a partner can show real photos, pricing and specs to a customer right from
// their phone instead of describing a product from memory. Reached from the Dashboard's
// "Browse Catalogue" card (not a bottom-nav tab — the nav is already full at five slots), same
// pattern as Share & Earn (components/partner/ReferAndEarnScreen.jsx).
//
// Only ACTIVE products come back for a partner (app/api/products/route.js filters them out
// server-side) — a product an admin has paused isn't ready to be shown to a customer yet.
import { useMemo, useState } from 'react';
import { ScreenHeader } from './ui';
import { IconSearch, IconProducts, IconWhatsApp, IconX } from '@/components/admin/icons';
import { PRODUCT_CATEGORY, PRODUCT_CATEGORY_LABEL } from '@/lib/formOptions';
import { useApiResource } from '@/lib/useApiResource';

function currency(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

export default function CatalogueScreen({ backHref = '/partner/home' }) {
  const { data: products, loading } = useApiResource('/api/products');
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('all');
  const [viewing, setViewing] = useState(null);

  const categoriesUsed = useMemo(() => {
    const used = new Set(products.map((p) => p.category).filter(Boolean));
    return PRODUCT_CATEGORY.filter((c) => used.has(c.v));
  }, [products]);

  const filtered = useMemo(() => products.filter((p) => {
    if (category !== 'all' && p.category !== category) return false;
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      if (!(`${p.name} ${p.sku}`.toLowerCase().includes(s))) return false;
    }
    return true;
  }), [products, category, q]);

  return (
    <>
      <ScreenHeader title="Product Catalogue" backHref={backHref} />

      <div className="hp-search-wrap">
        <div className="hp-input-wrap">
          <span className="hp-input-icon"><IconSearch size={17} /></span>
          <input className="hp-input" placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {categoriesUsed.length > 0 && (
        <div className="hp-tabs">
          <button type="button" className={`hp-tab${category === 'all' ? ' active' : ''}`} onClick={() => setCategory('all')}>All</button>
          {categoriesUsed.map((c) => (
            <button key={c.v} type="button" className={`hp-tab${category === c.v ? ' active' : ''}`} onClick={() => setCategory(c.v)}>{c.l}</button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="hp-empty"><div className="hp-empty-sub">Loading…</div></div>
      ) : filtered.length === 0 ? (
        <div className="hp-empty">
          <div className="hp-empty-icon"><IconProducts size={24} /></div>
          <div className="hp-empty-title">{products.length === 0 ? 'No products yet' : 'No products match'}</div>
          <div className="hp-empty-sub">{products.length === 0 ? 'Check back once the Heseos team adds products to the catalogue.' : 'Try a different search or category.'}</div>
        </div>
      ) : (
        <div className="hp-cat-grid">
          {filtered.map((p) => {
            const cover = p.photos?.[0]?.dataUrl;
            return (
              <button type="button" key={p.id} className="hp-cat-card" onClick={() => setViewing(p)}>
                <div className="hp-cat-photo">{cover ? <img src={cover} alt={p.name} /> : <IconProducts size={26} />}</div>
                <div className="hp-cat-body">
                  <div className="hp-cat-name">{p.name}</div>
                  <div className="hp-cat-meta">{p.category ? PRODUCT_CATEGORY_LABEL[p.category] || p.category : p.sku}</div>
                  <div className="hp-cat-price">{p.price != null ? currency(p.price) : 'Price on request'}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {viewing && <ProductDetailSheet product={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}

function ProductDetailSheet({ product, onClose }) {
  const photos = product.photos || [];
  const shareText = [
    `*${product.name}*`,
    product.sku ? `SKU: ${product.sku}` : null,
    product.price != null ? `Price: ${currency(product.price)}${product.unit ? ` / ${product.unit}` : ''}` : null,
    product.description || null,
    '',
    '— Shared via Heseos',
  ].filter(Boolean).join('\n');

  return (
    <div className="hp-sheet-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="hp-sheet">
        <div className="hp-sheet-handle" />
        <div className="hp-sheet-title">{product.name}</div>
        <div className="hp-sheet-sub">{product.sku}{product.category ? ` · ${PRODUCT_CATEGORY_LABEL[product.category] || product.category}` : ''}</div>

        {photos.length > 0 && (
          <div className="hp-cat-detail-photos" style={{ padding: '4px 0 16px' }}>
            {photos.map((ph) => <img key={ph.id} src={ph.dataUrl} alt={ph.name || product.name} />)}
          </div>
        )}

        <div className="hp-summary-row">
          <span className="hp-summary-label">Price</span>
          <span className="hp-summary-val">{product.price != null ? `${currency(product.price)}${product.unit ? ` / ${product.unit}` : ''}` : 'On request'}</span>
        </div>

        {product.description && <p className="hp-cat-detail-desc" style={{ padding: '14px 0 0' }}>{product.description}</p>}

        <div className="hp-sheet-actions">
          <button type="button" className="hp-btn hp-btn-outline hp-btn-block" onClick={onClose}><IconX size={16} /> Close</button>
          <a
            className="hp-btn hp-btn-primary hp-btn-block"
            href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <IconWhatsApp size={16} /> Share
          </a>
        </div>
      </div>
    </div>
  );
}
