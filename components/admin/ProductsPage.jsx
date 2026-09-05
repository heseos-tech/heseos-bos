'use client';
// Admin -> Products: Heseos's own product catalogue (SKU, name, category, price, photos).
// Feeds the quotation builder's product picker (components/admin/QuotationsPage.jsx and
// components/employee/SalesEngineerPanel.jsx) and, down the line, a customer/partner/employee-
// facing catalogue view — see app/api/products/route.js's header for the access rules.
import { useMemo, useState } from 'react';
import { PRODUCT_CATEGORY, PRODUCT_CATEGORY_LABEL } from '@/lib/formOptions';
import { StatCard, Modal } from './ui';
import { IconSearch, IconPlus, IconProducts, IconTrash, IconUpload, IconDownload, IconX } from './icons';
import { useApiResource, invalidate } from '@/lib/useApiResource';
import { parseCsv, toCsv, downloadCsv } from '@/lib/csv';

const PRODUCTS_URL = '/api/products';
const MAX_PHOTOS = 8;
const MAX_DIM = 1100; // px, longest side after client-side downscale
const JPEG_QUALITY = 0.82;

const TEMPLATE_COLUMNS = [
  { key: 'sku', label: 'SKU' },
  { key: 'name', label: 'Name' },
  { key: 'category', label: 'Category' },
  { key: 'price', label: 'Price' },
  { key: 'unit', label: 'Unit' },
  { key: 'description', label: 'Description' },
  { key: 'active', label: 'Active' },
];

// A CSV template with the exact columns app/api/products/bulk-import/route.js expects, plus two
// example rows using real category codes — so a spreadsheet edited from this file matches on
// re-upload without any guessing about column names or valid category values.
function downloadTemplate() {
  const example = [
    { sku: 'HES-TP-4G', name: '4-Gang Touch Panel Switch', category: 'touch_panel_switches', price: 2500, unit: 'piece', description: 'Capacitive touch wall switch, 4 gang', active: 'true' },
    { sku: 'HES-DL-01', name: 'Smart Fingerprint Door Lock', category: 'smart_door_locks', price: 8500, unit: 'piece', description: 'Fingerprint + PIN smart door lock', active: 'true' },
  ];
  downloadCsv('heseos-products-template.csv', toCsv(example, TEMPLATE_COLUMNS));
}

// Mirrors app/api/products/bulk-import/route.js's server-side validateRow exactly, so the preview
// table's error column matches what the server will actually accept — the server re-validates
// regardless, this is purely for fast feedback before the user submits.
function validateImportRow(r) {
  const name = String(r.name || '').trim();
  const sku = String(r.sku || '').trim();
  if (!name || !sku) return 'Name and SKU are required';
  const category = String(r.category || '').trim();
  if (category && !PRODUCT_CATEGORY.some((c) => c.v === category)) return `Unknown category "${category}"`;
  const rawPrice = String(r.price ?? '').trim();
  if (rawPrice) {
    const price = Number(rawPrice);
    if (!Number.isFinite(price) || price < 0) return "Price must be a non-negative number, or blank";
  }
  return null;
}

// Downscales + re-encodes an image file to a capped-size JPEG data URL entirely client-side —
// keeps a product row from ballooning in the database (base64 is the storage strategy for now;
// see app/api/products/route.js) while still looking sharp in a catalogue card or a quotation
// PDF, which never render an image anywhere near full camera resolution anyway.
function fileToCompressedDataUrl(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.onload = () => {
      img.onerror = () => reject(new Error('Could not decode image'));
      img.onload = () => {
        const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export default function ProductsPage() {
  const { data: products, loading, refresh } = useApiResource(PRODUCTS_URL);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('all');
  const [modal, setModal] = useState(null); // { type: 'add' } | { type: 'edit', product } | { type: 'view', product }
  const [notice, setNotice] = useState('');

  function flash(msg) { setNotice(msg); setTimeout(() => setNotice(''), 3000); }
  function load() { invalidate(PRODUCTS_URL); refresh(); }

  const activeCount = products.filter((p) => p.active !== false).length;
  const categoriesUsed = new Set(products.map((p) => p.category).filter(Boolean)).size;

  const filtered = useMemo(() => products.filter((p) => {
    if (status === 'active' && p.active === false) return false;
    if (status === 'inactive' && p.active !== false) return false;
    if (category !== 'all' && p.category !== category) return false;
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      if (!(`${p.name} ${p.sku}`.toLowerCase().includes(s))) return false;
    }
    return true;
  }), [products, status, category, q]);

  async function toggleActive(p) {
    await fetch(`${PRODUCTS_URL}/${p.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !(p.active !== false) }) });
    load();
  }

  async function remove(p) {
    if (!window.confirm(`Remove "${p.name}" from the catalogue? This can't be undone.`)) return;
    await fetch(`${PRODUCTS_URL}/${p.id}`, { method: 'DELETE' });
    setModal(null);
    load();
    flash('Product removed');
  }

  return (
    <>
      <div className="adm-page-head">
        <div><h1 className="adm-h1">Products</h1><p className="adm-page-sub">Your catalogue of SKUs, pricing and photos — feeds the quotation builder, and a customer/partner-facing catalogue down the line</p></div>
        <div className="adm-page-head-actions">
          <button className="adm-chip-btn" onClick={downloadTemplate}><IconDownload size={15} /> Download Template</button>
          <button className="adm-chip-btn" onClick={() => setModal({ type: 'import' })}><IconUpload size={15} /> Bulk Import</button>
          <button className="adm-btn-primary" onClick={() => setModal({ type: 'add' })}><IconPlus size={15} /> Add Product</button>
        </div>
      </div>

      {notice && <div className="adm-notice">{notice}</div>}

      <div className="adm-stat-row">
        <StatCard label="Total Products" value={products.length} Icon={IconProducts} tone="orange" />
        <StatCard label="Active" value={activeCount} Icon={IconProducts} tone="green" />
        <StatCard label="Categories in Use" value={categoriesUsed} Icon={IconProducts} tone="purple" />
      </div>

      <div className="adm-card">
        <div className="adm-toolbar">
          <div className="adm-search adm-search--inline"><IconSearch size={16} /><input placeholder="Search by product name or SKU…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">All Categories</option>
            {PRODUCT_CATEGORY.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All Status</option><option value="active">Active</option><option value="inactive">Inactive</option>
          </select>
        </div>

        <div className="prod-grid">
          {loading ? (
            <div className="adm-empty">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="adm-empty">{products.length === 0 ? 'No products yet — add your first one to start building the catalogue.' : 'No products match these filters.'}</div>
          ) : filtered.map((p) => {
            const cover = p.photos?.[0]?.dataUrl;
            return (
              <div key={p.id} className={`prod-card${p.active === false ? ' prod-card--inactive' : ''}`} onClick={() => setModal({ type: 'view', product: p })}>
                <div className="prod-card-photo">
                  {cover ? <img src={cover} alt={p.name} /> : <div className="prod-card-photo-placeholder"><IconProducts size={28} /></div>}
                  {p.active === false && <span className="prod-card-badge">Inactive</span>}
                </div>
                <div className="prod-card-body">
                  <div className="prod-card-name">{p.name}</div>
                  <div className="prod-card-sub">{p.sku} {p.category ? `· ${PRODUCT_CATEGORY_LABEL[p.category] || p.category}` : ''}</div>
                  <div className="prod-card-price">{p.price != null ? `₹${Number(p.price).toLocaleString('en-IN')}` : 'Price on request'}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {modal?.type === 'add' && <ProductModal onClose={() => setModal(null)} onDone={() => { setModal(null); load(); flash('Product added'); }} />}
      {modal?.type === 'edit' && <ProductModal product={modal.product} onClose={() => setModal(null)} onDone={() => { setModal(null); load(); flash('Product updated'); }} />}
      {modal?.type === 'view' && (
        <ViewProductModal
          product={modal.product}
          onClose={() => setModal(null)}
          onEdit={() => setModal({ type: 'edit', product: modal.product })}
          onDelete={() => remove(modal.product)}
          onToggleActive={() => toggleActive(modal.product).then(() => setModal(null))}
        />
      )}
      {modal?.type === 'import' && (
        <ImportModal onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />
      )}
    </>
  );
}

function ViewProductModal({ product, onClose, onEdit, onDelete, onToggleActive }) {
  const photos = product.photos || [];
  return (
    <Modal title={product.name} sub={`${product.sku}${product.category ? ' · ' + (PRODUCT_CATEGORY_LABEL[product.category] || product.category) : ''}`} onClose={onClose}>
      {photos.length > 0 && (
        <div className="prod-view-photos">
          {photos.map((ph) => <img key={ph.id} src={ph.dataUrl} alt={ph.name || product.name} />)}
        </div>
      )}
      <div className="adm-detail-grid">
        <div><span className="adm-detail-label">Price</span>{product.price != null ? `₹${Number(product.price).toLocaleString('en-IN')}` : 'Price on request'}</div>
        <div><span className="adm-detail-label">Unit</span>{product.unit || 'piece'}</div>
        <div><span className="adm-detail-label">Status</span>{product.active !== false ? 'Active' : 'Inactive'}</div>
      </div>
      {product.description && <p className="prod-view-desc">{product.description}</p>}
      <div className="lf-actions">
        <button className="lf-btn-back" onClick={onDelete}><IconTrash size={14} /> Delete</button>
        <button className="adm-chip-btn" onClick={onToggleActive}>{product.active !== false ? 'Deactivate' : 'Activate'}</button>
        <button className="lf-btn-next" onClick={onEdit}>Edit</button>
      </div>
    </Modal>
  );
}

function ProductModal({ product = null, onClose, onDone }) {
  const editing = !!product;
  const [sku, setSku] = useState(product?.sku || '');
  const [name, setName] = useState(product?.name || '');
  const [category, setCategory] = useState(product?.category || PRODUCT_CATEGORY[0].v);
  const [price, setPrice] = useState(product?.price ?? '');
  const [unit, setUnit] = useState(product?.unit || 'piece');
  const [description, setDescription] = useState(product?.description || '');
  const [photos, setPhotos] = useState(product?.photos || []);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleFiles(fileList) {
    const files = Array.from(fileList || []).slice(0, MAX_PHOTOS - photos.length);
    if (!files.length) return;
    setUploading(true);
    setError('');
    try {
      const added = [];
      for (const file of files) {
        if (!file.type.startsWith('image/')) continue;
        const dataUrl = await fileToCompressedDataUrl(file);
        added.push({ id: `ph_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`, name: file.name, dataUrl });
      }
      setPhotos((prev) => [...prev, ...added].slice(0, MAX_PHOTOS));
    } catch (e) {
      setError('Could not process one of the photos — try a different image.');
    } finally {
      setUploading(false);
    }
  }

  function removePhoto(id) { setPhotos((prev) => prev.filter((p) => p.id !== id)); }
  function makeCover(id) { setPhotos((prev) => { const found = prev.find((p) => p.id === id); return found ? [found, ...prev.filter((p) => p.id !== id)] : prev; }); }

  async function submit() {
    setError(''); setSaving(true);
    try {
      const body = { sku, name, category, price: price === '' ? null : Number(price), unit, description, photos };
      const url = editing ? `${'/api/products'}/${product.id}` : '/api/products';
      const res = await fetch(url, { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      onDone();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  return (
    <Modal title={editing ? 'Edit product' : 'Add product'} sub="Shows up in the quotation builder's product picker" onClose={onClose}>
      <div className="lf-field"><label className="lf-label">Product name</label><input className="lf-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 4-Gang Touch Panel Switch" /></div>
      <div className="lf-field"><label className="lf-label">SKU</label><input className="lf-input" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="e.g. HES-TP-4G" /></div>
      <div className="lf-field">
        <label className="lf-label">Category</label>
        <select className="lf-input" value={category} onChange={(e) => setCategory(e.target.value)}>
          {PRODUCT_CATEGORY.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
        </select>
      </div>
      <div className="lf-field-row">
        <div className="lf-field"><label className="lf-label">Price (₹)</label><input className="lf-input" type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Leave blank for 'on request'" /></div>
        <div className="lf-field"><label className="lf-label">Unit</label><input className="lf-input" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="piece, set, point…" /></div>
      </div>
      <div className="lf-field"><label className="lf-label">Description</label><textarea className="lf-input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="A line or two a customer would read on a quotation" /></div>

      <div className="lf-field">
        <label className="lf-label">Photos ({photos.length}/{MAX_PHOTOS}) — first photo is the cover image</label>
        <div className="prod-photo-grid">
          {photos.map((ph) => (
            <div key={ph.id} className="prod-photo-thumb" onClick={() => makeCover(ph.id)} title="Click to make cover photo">
              <img src={ph.dataUrl} alt={ph.name} />
              <button type="button" className="prod-photo-remove" onClick={(e) => { e.stopPropagation(); removePhoto(ph.id); }}><IconX size={12} /></button>
              {photos[0]?.id === ph.id && <span className="prod-photo-cover-tag">Cover</span>}
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <label className="prod-photo-add">
              <IconUpload size={18} />
              <span>{uploading ? 'Processing…' : 'Add photo'}</span>
              <input type="file" accept="image/*" multiple hidden disabled={uploading} onChange={(e) => handleFiles(e.target.files)} />
            </label>
          )}
        </div>
      </div>

      {error && <div className="lf-error">{error}</div>}
      <div className="lf-actions">
        <button className="lf-btn-back" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="lf-btn-next" onClick={submit} disabled={saving || uploading || !name || !sku}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Add product'}</button>
      </div>
    </Modal>
  );
}

function ImportModal({ onClose, onDone }) {
  const [rows, setRows] = useState([]); // parsed rows, each tagged with _error
  const [fileName, setFileName] = useState('');
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null); // { created, updated, errors }

  const validCount = useMemo(() => rows.filter((r) => !r._error).length, [rows]);
  const errorCount = rows.length - validCount;

  function handleFile(file) {
    if (!file) return;
    setFileName(file.name);
    setError('');
    setResult(null);
    setRows([]);
    setParsing(true);
    const reader = new FileReader();
    reader.onerror = () => { setError('Could not read that file'); setParsing(false); };
    reader.onload = () => {
      try {
        const parsed = parseCsv(String(reader.result));
        if (parsed.length === 0) setError('No data rows found in that file');
        else setRows(parsed.map((r) => ({ ...r, _error: validateImportRow(r) })));
      } catch (e) {
        setError('Could not parse that file as CSV');
      } finally {
        setParsing(false);
      }
    };
    reader.readAsText(file);
  }

  async function submit() {
    const good = rows.filter((r) => !r._error).map(({ _error, ...r }) => r);
    if (good.length === 0) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/products/bulk-import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows: good }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      setResult(data);
    } catch (e) { setError(e.message); } finally { setSubmitting(false); }
  }

  if (result) {
    return (
      <Modal title="Import complete" sub={fileName} onClose={onClose} wide>
        <div className="adm-detail-grid">
          <div><span className="adm-detail-label">Created</span>{result.created}</div>
          <div><span className="adm-detail-label">Updated</span>{result.updated}</div>
          <div><span className="adm-detail-label">Errors</span>{result.errors.length}</div>
        </div>
        {result.errors.length > 0 && (
          <div className="adm-table-scroll" style={{ marginTop: 12 }}>
            <table className="adm-table">
              <thead><tr><th>Row</th><th>Error</th></tr></thead>
              <tbody>{result.errors.map((e, i) => <tr key={i}><td>{e.row}</td><td>{e.error}</td></tr>)}</tbody>
            </table>
          </div>
        )}
        <div className="lf-actions">
          <button className="lf-btn-next" onClick={onDone}>Done</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Bulk import products" sub="Upload a CSV — see Download Template for the expected columns" onClose={onClose} wide>
      <div className="lf-field">
        <label className="lf-label">CSV file</label>
        <input type="file" accept=".csv,text/csv" onChange={(e) => handleFile(e.target.files?.[0])} disabled={parsing || submitting} />
      </div>

      {error && <div className="lf-error">{error}</div>}

      {rows.length > 0 && (
        <>
          <div className="adm-detail-grid" style={{ marginBottom: 12 }}>
            <div><span className="adm-detail-label">Rows found</span>{rows.length}</div>
            <div><span className="adm-detail-label">Valid</span>{validCount}</div>
            <div><span className="adm-detail-label">Errors</span>{errorCount}</div>
          </div>
          <div className="adm-table-scroll" style={{ maxHeight: 320 }}>
            <table className="adm-table">
              <thead><tr><th>SKU</th><th>Name</th><th>Category</th><th>Price</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} style={r._error ? { background: 'rgba(255,132,132,0.08)' } : undefined}>
                    <td>{r.sku}</td>
                    <td>{r.name}</td>
                    <td>{r.category || '—'}</td>
                    <td>{r.price || '—'}</td>
                    <td>{r._error ? <span style={{ color: '#ff8484' }}>{r._error}</span> : 'OK'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="lf-actions">
        <button className="lf-btn-back" onClick={onClose} disabled={submitting}>Cancel</button>
        <button className="lf-btn-next" onClick={submit} disabled={submitting || parsing || validCount === 0}>
          {submitting ? 'Importing…' : `Import ${validCount || ''} product${validCount === 1 ? '' : 's'}`}
        </button>
      </div>
    </Modal>
  );
}
