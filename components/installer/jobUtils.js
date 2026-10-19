'use client';
// Shared helpers for the Installer app screens.
import { useApiResource, invalidate } from '@/lib/useApiResource';

export const JOBS_URL = '/api/installer/jobs';

export function useJobs() {
  const { data, loading, refresh } = useApiResource(JOBS_URL, { pollMs: 20000 });
  const d = Array.isArray(data) ? {} : (data || {});
  return { available: d.available || [], mine: d.mine || [], loading, refresh };
}

export async function jobAction(action, job) {
  const res = await fetch(JOBS_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, kind: job.kind, id: job.id }) });
  const data = await res.json().catch(() => ({}));
  await invalidate(JOBS_URL);
  return res.ok ? { ok: true } : { ok: false, error: data.error || 'Something went wrong — try again' };
}

export const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const digits = (p) => String(p || '').replace(/\D/g, '');
export const telHref = (p) => { const d = digits(p); return `tel:${d.length === 10 ? '+91' : '+'}${d}`; };
export const waHref = (p) => { const d = digits(p); return `https://wa.me/${d.length === 10 ? `91${d}` : d}`; };
export const mapsHref = (addr) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr || '')}`;

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function fmtDate(ymd) {
  if (!ymd) return '';
  return new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
export function dueTag(ymd) { const t = todayStr(); return ymd < t ? 'overdue' : ymd === t ? 'today' : ''; }

const ORDER_STAGE = { confirmed: 'Product being packed', packed: 'Product packed', shipped: 'Product on its way', delivered: 'Product delivered — ready to install', installed: 'Installed' };
export function stageLabel(job) {
  if (job.kind === 'order') return ORDER_STAGE[job.stage] || '';
  return job.done ? 'Installed' : 'Converted deal — ready to install';
}
export const kindLabel = (job) => (job.kind === 'order' ? 'Door-lock order' : 'Smart-home project');
