// Admin-controlled product catalogue categories — feeds the Category dropdowns on Admin ->
// Products, the quotation builder's product picker, and the partner-facing catalogue
// (components/partner/CatalogueScreen.jsx). Mirrors lib/cities.js's pattern, except each
// category needs both a stable slug (`v`, stored on every product's `category` field and never
// changed once picked) and a human label (`l`) instead of a single plain string.
//
// Storage: a single row in the `settings` table, id 'product_categories'. Shape:
// { categories: { v: string, l: string }[] }. The first read auto-seeds the row with Heseos's
// original built-in category list below, so every product already saved against one of those
// slugs keeps resolving to the same label with zero migration — after that the DB row is the
// only source of truth and DEFAULT_CATEGORIES is never consulted again.

import { dbGetById, dbInsert } from '@/lib/db';

const SETTINGS_ID = 'product_categories';

const DEFAULT_CATEGORIES = [
  { v: 'touch_panel_switches', l: 'Touch Panel Switches' },
  { v: 'smart_door_locks',     l: 'Smart Door Locks' },
  { v: 'smart_lights',         l: 'Smart Lights' },
  { v: 'smart_curtains',       l: 'Smart Curtains' },
  { v: 'video_door_phone',     l: 'Video Door Phone' },
  { v: 'scene_controller',     l: 'Scene Controller Panels' },
  { v: 'security_camera',      l: 'Security Cameras' },
  { v: 'sensors',              l: 'Sensors' },
  { v: 'hub_controller',       l: 'Hub / Controller' },
  { v: 'accessories',          l: 'Accessories' },
  { v: 'other',                l: 'Other' },
];

function norm(s) {
  return String(s || '').trim().toLowerCase();
}

// Turns a free-typed label into a stable slug for the `category` field products actually
// store: lowercase, non-alphanumerics collapsed to single underscores, trimmed of leading/
// trailing ones. "Fans & Ventilation" -> "fans_ventilation".
function slugify(label) {
  return String(label || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export async function getProductCategories() {
  const row = await dbGetById('settings', SETTINGS_ID);
  if (Array.isArray(row?.categories)) return row.categories;
  // No row yet — seed it once so the built-in list becomes real, editable data instead of
  // living only in code.
  await dbInsert('settings', SETTINGS_ID, { id: SETTINGS_ID, categories: DEFAULT_CATEGORIES, updatedAt: new Date().toISOString() });
  return DEFAULT_CATEGORIES;
}

export async function addProductCategory(label) {
  const clean = String(label || '').trim();
  if (!clean) throw new Error('Category name is required');
  const existing = await getProductCategories();
  if (existing.some((c) => norm(c.l) === norm(clean))) return existing; // already there
  let slug = slugify(clean) || 'category';
  // Guard against a slug collision from two different labels that slugify the same way (e.g.
  // "Smart Lights" vs "smart-lights") — append a numeric suffix until it's unique.
  if (existing.some((c) => c.v === slug)) {
    let n = 2;
    while (existing.some((c) => c.v === `${slug}_${n}`)) n++;
    slug = `${slug}_${n}`;
  }
  const next = [...existing, { v: slug, l: clean }];
  await dbInsert('settings', SETTINGS_ID, { id: SETTINGS_ID, categories: next, updatedAt: new Date().toISOString() });
  return next;
}

// No check against products currently using this category — same simplicity tradeoff
// lib/cities.js's removeCity makes. A product left pointing at a removed slug still displays
// fine everywhere (PRODUCT_CATEGORY_LABEL-style lookups already fall back to the raw value),
// it just won't match "All Categories" filters that rely on the live list any more.
export async function removeProductCategory(v) {
  const existing = await getProductCategories();
  const next = existing.filter((c) => c.v !== v);
  await dbInsert('settings', SETTINGS_ID, { id: SETTINGS_ID, categories: next, updatedAt: new Date().toISOString() });
  return next;
}
